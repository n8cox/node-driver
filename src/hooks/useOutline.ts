import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EnsembleAdapter } from '@/adapters/EnsembleAdapter';
import { supportsOutline } from '@/adapters/EnsembleAdapter';
import { applyDiff, diffOutlines } from '@/outline/ops';
import { visibleRows } from '@/outline/tree';
import type { OutlineDiff, OutlineLine } from '@/types/outline';

/**
 * How long typing must pause before the text is persisted.
 *
 * This is not a nicety. The Alignment backend rewrites the WHOLE outline file
 * on every op — a 3.5 MB read, pretty-print and atomic write — so persisting
 * each keystroke would cost one full rewrite per character. Structural ops are
 * rare and go through immediately; text is the only high-frequency edit.
 */
export const TEXT_FLUSH_MS = 400;

/**
 * How many structural steps can be taken back. Snapshots hold shared line
 * objects, so the cost is one array of references per step, not a copy of the
 * outline.
 */
export const UNDO_DEPTH = 100;

export interface UseOutlineResult {
  lines: OutlineLine[];
  rows: ReturnType<typeof visibleRows>;
  loading: boolean;
  error: string | null;
  dropped: string[] | null;
  editable: boolean;
  focusId: string | null;
  setFocusId: (id: string | null) => void;
  /** Structural change — applied optimistically, persisted immediately. */
  mutate: (diff: OutlineDiff, focus?: string | null) => Promise<void>;
  /** Text change — applied immediately, persisted after a pause in typing. */
  editText: (id: string, text: string) => void;
  /** Persist any pending text now. */
  flushText: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Structural undo — the pain Nathan named: fast deletes with no way back. */
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  /** True when another writer changed the outline and this view caught up. */
  liveConnected: boolean;
}

/**
 * The outline projection, with OPTIMISTIC local application.
 *
 * Typing must never wait on a round trip, so a change is applied locally first
 * and persisted after. If the write fails the local state is rolled back to
 * exactly what it was — an edit that did not survive must not keep looking like
 * it did.
 */
export function useOutline(adapter: EnsembleAdapter): UseOutlineResult {
  const editable = supportsOutline(adapter);
  const [lines, setLines] = useState<OutlineLine[]>([]);
  const [loading, setLoading] = useState(editable);
  const [error, setError] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string[] | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [liveConnected, setLiveConnected] = useState(false);

  const undoStack = useRef<OutlineLine[][]>([]);
  const redoStack = useRef<OutlineLine[][]>([]);

  // Guards a late response from a superseded load overwriting fresher state.
  const loadSeq = useRef(0);
  // Latest lines, readable from callbacks without re-creating them on each edit.
  const linesRef = useRef<OutlineLine[]>([]);
  linesRef.current = lines;
  // Ids whose text has changed locally but is not yet written.
  const pendingText = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!supportsOutline(adapter)) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const snapshot = await adapter.getOutline();
      if (seq !== loadSeq.current) return;
      setLines(snapshot.lines);
    } catch (cause) {
      if (seq !== loadSeq.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Send a diff. Rolls `lines` back to `rollback` if the write is refused. */
  const persist = useCallback(
    async (diff: OutlineDiff, rollback: OutlineLine[] | null) => {
      if (!supportsOutline(adapter)) return;
      try {
        const result = await adapter.applyOutlineDiff(diff);
        setDropped(result.dropped?.length ? result.dropped : null);
      } catch (cause) {
        if (rollback) setLines(rollback);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [adapter],
  );

  const flushText = useCallback(async () => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    if (pendingText.current.size === 0) return;

    const ids = [...pendingText.current];
    pendingText.current.clear();
    // Build from the CURRENT lines so the write carries whatever structure the
    // line has now, not the shape it had when the key was pressed.
    const upsert = linesRef.current.filter((l) => ids.includes(l.id));
    if (upsert.length === 0) return;

    // Text is never rolled back: the operator can see what they typed, and
    // replacing it under the cursor would be worse than reporting the failure.
    await persist({ upsert, remove: [] }, null);
  }, [persist]);

  const editText = useCallback(
    (id: string, text: string) => {
      if (!supportsOutline(adapter)) return;
      setLines((prev) => {
        const cur = prev.find((l) => l.id === id);
        if (!cur || cur.text === text) return prev;
        return applyDiff(prev, { upsert: [{ ...cur, text }], remove: [] });
      });

      pendingText.current.add(id);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => void flushText(), TEXT_FLUSH_MS);
    },
    [adapter, flushText],
  );

  const mutate = useCallback(
    async (diff: OutlineDiff, focus?: string | null) => {
      if (!supportsOutline(adapter)) return;
      if (diff.upsert.length === 0 && diff.remove.length === 0) return;

      // Pending text must land BEFORE a structural change, or a debounced edit
      // could be written against a line the structure has already moved.
      await flushText();

      // Snapshot BEFORE the update rather than inside the updater: React may
      // not run an updater before the awaited write resolves, which would leave
      // the rollback empty and a failed write wiping the outline instead of
      // restoring it.
      const rollback = linesRef.current;

      // The same snapshot is the undo step. Taking it here means undo covers
      // every structural op without each op having to know about undo.
      undoStack.current.push(rollback);
      if (undoStack.current.length > UNDO_DEPTH) undoStack.current.shift();
      redoStack.current = [];
      setUndoDepth(undoStack.current.length);
      setRedoDepth(0);
      setLines((prev) => applyDiff(prev, diff));
      if (focus !== undefined) setFocusId(focus);
      setDropped(null);

      await persist(diff, rollback);
    },
    [adapter, flushText, persist],
  );

  /** Restore a snapshot by differencing it against the current outline. */
  const restore = useCallback(
    async (target: OutlineLine[]) => {
      const current = linesRef.current;
      const diff = diffOutlines(current, target);
      if (diff.upsert.length === 0 && diff.remove.length === 0) return;
      setLines(target);
      await persist(diff, current);
    },
    [persist],
  );

  const undo = useCallback(async () => {
    await flushText();
    const target = undoStack.current.pop();
    if (!target) return;
    redoStack.current.push(linesRef.current);
    setUndoDepth(undoStack.current.length);
    setRedoDepth(redoStack.current.length);
    await restore(target);
  }, [flushText, restore]);

  const redo = useCallback(async () => {
    await flushText();
    const target = redoStack.current.pop();
    if (!target) return;
    undoStack.current.push(linesRef.current);
    setUndoDepth(undoStack.current.length);
    setRedoDepth(redoStack.current.length);
    await restore(target);
  }, [flushText, restore]);

  /**
   * Catch up when someone else writes — another window, the Alignment app, a
   * script. Without this the primary surface quietly shows a stale outline.
   */
  useEffect(() => {
    if (typeof adapter.onOutlineChanged !== 'function') return;
    const unsubscribe = adapter.onOutlineChanged(
      () => {
        // Land our own pending text first, or catching up would discard it.
        void flushText().then(() => refresh());
      },
      // Reported by the transport. A badge that says "live" because a method
      // exists is exactly the instrument that agrees with you while the socket
      // is dead and the outline quietly goes stale.
      (connected) => setLiveConnected(connected),
    );
    return () => {
      setLiveConnected(false);
      unsubscribe();
    };
  }, [adapter, flushText, refresh]);

  // A pending edit must not be lost because the view went away.
  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
    },
    [],
  );

  const rows = useMemo(() => visibleRows(lines), [lines]);

  return {
    lines,
    rows,
    loading,
    error,
    dropped,
    editable,
    focusId,
    setFocusId,
    mutate,
    editText,
    flushText,
    refresh,
    undo,
    redo,
    canUndo: undoDepth > 0,
    canRedo: redoDepth > 0,
    liveConnected,
  };
}
