import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EnsembleAdapter } from '@/adapters/EnsembleAdapter';
import { supportsOutline } from '@/adapters/EnsembleAdapter';
import { applyDiff } from '@/outline/ops';
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
      setLines((prev) => applyDiff(prev, diff));
      if (focus !== undefined) setFocusId(focus);
      setDropped(null);

      await persist(diff, rollback);
    },
    [adapter, flushText, persist],
  );

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
  };
}
