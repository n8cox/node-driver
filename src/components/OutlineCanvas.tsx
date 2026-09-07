import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clipSubtree,
  clipToText,
  cycleStatus,
  indent,
  insertClip,
  insertSibling,
  mergeIntoPrev,
  moveNode,
  outdent,
  parseIndentedText,
  removeEmpty,
  removeSubtree,
  toggleCollapse,
  type ClippedLine,
} from '@/outline/ops';
import { ancestorIds, nextVisible, previousVisible, searchRows } from '@/outline/tree';
import type { OutlineRow } from '@/types/outline';
import type { UseOutlineResult } from '@/hooks/useOutline';

/** Status glyph per line state. Moon phases carry progress; the rest are markers. */
const GLYPH: Record<string, string> = {
  new: '○',
  crescent: '◔',
  quarter: '◑',
  half: '◑',
  gibbous: '◕',
  full: '●',
  done: '✓',
  flag: '⚑',
  note: '·',
  blocked: '✗',
  failed: '✗',
};

export interface OutlineCanvasProps {
  outline: UseOutlineResult;
  /** Author stamped on lines this window creates. */
  author: string;
}

/**
 * The OUTLINE projection — bullets that edit like an outliner.
 *
 * Editing grammar comes first (Nathan's spec, 2026-06-12); the canvas
 * behaviours grow into this space afterwards. Every keystroke maps to a pure op
 * in `@/outline/ops`, so the behaviour under test and the behaviour on screen
 * are the same function.
 */
export function OutlineCanvas({ outline, author }: OutlineCanvasProps) {
  const {
    lines,
    loading,
    error,
    dropped,
    editable,
    focusId,
    setFocusId,
    mutate,
    editText,
    undo,
    redo,
    canUndo,
    canRedo,
    liveConnected,
  } = outline;

  const inputs = useRef(new Map<string, HTMLTextAreaElement>());
  const pendingCaret = useRef<{ id: string; at: number } | null>(null);
  /** Internal clipboard — richer than text, so a copy keeps status and shape. */
  const clip = useRef<ClippedLine[]>([]);

  const [query, setQuery] = useState('');
  /** Zoom root — WorkFlowy's focus mode; null is the whole outline. */
  const [zoomId, setZoomId] = useState<string | null>(null);

  const { rows, matched } = useMemo(
    () => searchRows(lines, query, zoomId, focusId),
    [lines, query, zoomId, focusId],
  );

  const trail = useMemo(
    () => (zoomId ? [...ancestorIds(lines, zoomId)].reverse() : []),
    [lines, zoomId],
  );
  const zoomLine = zoomId ? lines.find((l) => l.id === zoomId) ?? null : null;

  // A zoom root that was deleted must not strand the view on an empty screen.
  useEffect(() => {
    if (zoomId && !lines.some((l) => l.id === zoomId)) setZoomId(null);
  }, [lines, zoomId]);

  useEffect(() => {
    if (!focusId) return;
    const el = inputs.current.get(focusId);
    if (!el) return;
    el.focus();
    const pending = pendingCaret.current;
    if (pending && pending.id === focusId) {
      el.setSelectionRange(pending.at, pending.at);
      pendingCaret.current = null;
    }
  }, [focusId, rows]);

  const doPaste = useCallback(
    async (id: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const el = e.currentTarget;
      const multiline = /\r|\n/.test(text.trim());
      const emptyLine = el.value === '';

      // A single-line paste into a line with text is ordinary text editing.
      if (!multiline && !emptyLine) return;
      if (!text.trim()) return;

      e.preventDefault();
      const parsed = parseIndentedText(text);
      if (parsed.length === 0) return;

      // Pasting into an empty bullet should fill it, not leave a blank above.
      if (emptyLine && parsed.length >= 1) {
        editText(id, parsed[0].text);
        const rest = parsed.slice(1).map((c) => ({ ...c, depth: Math.max(0, c.depth - 1) }));
        if (rest.length === 0) return;
        const d = insertClip(lines, id, rest, { author });
        await mutate(d, d.firstId ?? id);
        return;
      }

      const d = insertClip(lines, id, parsed, { author });
      await mutate(d, d.firstId ?? id);
    },
    [author, editText, lines, mutate],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, row: OutlineRow) => {
      const { line } = row;
      const el = e.currentTarget;
      const text = el.value;
      const caretAtStart = el.selectionStart === 0 && el.selectionEnd === 0;
      const caretAtEnd = el.selectionStart === text.length && el.selectionEnd === text.length;
      const noSelection = el.selectionStart === el.selectionEnd;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        void (e.shiftKey ? redo() : undo());
        return;
      }

      // Subtree clipboard, but only when no text is selected — with a selection
      // these belong to the text, which is the rule every outliner follows.
      if (mod && !e.shiftKey && noSelection && ['c', 'x', 'C', 'X'].includes(e.key)) {
        e.preventDefault();
        clip.current = clipSubtree(lines, line.id);
        void navigator.clipboard?.writeText(clipToText(clip.current)).catch(() => {});
        if (e.key.toLowerCase() === 'x') {
          const prev = previousVisible(rows, line.id);
          void mutate(removeSubtree(lines, line.id), prev?.id ?? null);
        }
        return;
      }

      if (mod && !e.shiftKey && noSelection && (e.key === 'v' || e.key === 'V')) {
        // Prefer the internal clip: it carries status and exact shape. With none,
        // fall through so the native paste event handles outside text.
        if (clip.current.length === 0) return;
        e.preventDefault();
        const d = insertClip(lines, line.id, clip.current, { author });
        void mutate(d, d.firstId ?? line.id);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (text === '' && line.parentId != null) {
          void mutate(outdent(lines, line.id), line.id);
          return;
        }
        const d = insertSibling(lines, line.id, { author });
        void mutate(d, d.newId);
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        void mutate(e.shiftKey ? outdent(lines, line.id) : indent(lines, line.id), line.id);
        return;
      }

      if (e.key === 'Backspace' && text === '') {
        e.preventDefault();
        const prev = previousVisible(rows, line.id);
        void mutate(removeEmpty(lines, line.id), prev?.id ?? null);
        return;
      }

      if (e.key === 'Backspace' && caretAtStart && noSelection) {
        const d = mergeIntoPrev(lines, line.id);
        if (!d.mergedInto) return;
        e.preventDefault();
        const prevLine = lines.find((l) => l.id === d.mergedInto);
        pendingCaret.current = { id: d.mergedInto, at: prevLine?.text.length ?? 0 };
        void mutate(d, d.mergedInto);
        return;
      }

      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.altKey && e.shiftKey) {
        e.preventDefault();
        void mutate(moveNode(lines, line.id, e.key === 'ArrowDown' ? 1 : -1), line.id);
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if ((e.key === 'ArrowUp' && !caretAtStart) || (e.key === 'ArrowDown' && !caretAtEnd)) return;
        const target =
          e.key === 'ArrowDown' ? nextVisible(rows, line.id) : previousVisible(rows, line.id);
        if (!target) return;
        e.preventDefault();
        setFocusId(target.id);
        return;
      }

      if (e.key === 'Escape' && zoomId) {
        e.preventDefault();
        setZoomId(null);
      }
    },
    [author, lines, mutate, redo, rows, setFocusId, undo, zoomId],
  );

  if (!editable) {
    return (
      <div className="outline-empty">
        This adapter serves the roster only — it does not expose the outline projection.
      </div>
    );
  }

  return (
    <div className="outline-pane">
      <div className="outline-bar">
        <input
          className="outline-search"
          type="search"
          value={query}
          placeholder="Search outline…"
          aria-label="Search outline"
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <span className="outline-count">
            {matched.size} match{matched.size === 1 ? '' : 'es'}
          </span>
        )}

        <div className="outline-bar-actions">
          <button type="button" onClick={() => void undo()} disabled={!canUndo} title="Undo (⌘Z)">
            undo
          </button>
          <button
            type="button"
            onClick={() => void redo()}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
          >
            redo
          </button>
          <span className={`outline-live${liveConnected ? ' outline-live-on' : ''}`}>
            {liveConnected ? 'live' : 'manual refresh'}
          </span>
        </div>
      </div>

      {zoomLine && (
        <div className="outline-trail">
          <button type="button" onClick={() => setZoomId(null)}>
            all
          </button>
          {trail.map((id) => (
            <button key={id} type="button" onClick={() => setZoomId(id)}>
              {(lines.find((l) => l.id === id)?.text ?? id).slice(0, 28) || '—'}
            </button>
          ))}
          <span className="outline-trail-here">{zoomLine.text || '—'}</span>
          <span className="outline-trail-hint">Esc to zoom out</span>
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          <span className="error-banner-text">{error}</span>
        </div>
      )}
      {dropped && dropped.length > 0 && (
        <div className="outline-dropped" role="status">
          The backend refused {dropped.length} line{dropped.length === 1 ? '' : 's'}:{' '}
          {dropped.join(', ')}
        </div>
      )}

      <div className="outline" role="tree" aria-label="Outline">
        {loading && rows.length === 0 && <div className="outline-empty">Loading outline…</div>}
        {!loading && rows.length === 0 && (
          <div className="outline-empty">{query ? 'No matches.' : 'Outline is empty.'}</div>
        )}

        {rows.map((row) => (
          <OutlineRowView
            key={row.line.id}
            row={row}
            focused={focusId === row.line.id}
            isMatch={matched.has(row.line.id)}
            registerInput={(el) => {
              if (el) inputs.current.set(row.line.id, el);
              else inputs.current.delete(row.line.id);
            }}
            onFocus={() => setFocusId(row.line.id)}
            onKeyDown={(e) => onKeyDown(e, row)}
            onPaste={(e) => void doPaste(row.line.id, e)}
            onChange={(text) => editText(row.line.id, text)}
            onToggle={() => void mutate(toggleCollapse(lines, row.line.id), row.line.id)}
            onCycle={() => void mutate(cycleStatus(lines, row.line.id), row.line.id)}
            onZoom={() => setZoomId(row.line.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface RowViewProps {
  row: OutlineRow;
  focused: boolean;
  isMatch: boolean;
  registerInput: (el: HTMLTextAreaElement | null) => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onChange: (text: string) => void;
  onToggle: () => void;
  onCycle: () => void;
  onZoom: () => void;
}

function OutlineRowView({
  row,
  focused,
  isMatch,
  registerInput,
  onFocus,
  onKeyDown,
  onPaste,
  onChange,
  onToggle,
  onCycle,
  onZoom,
}: RowViewProps) {
  const { line, depth, hasChildren } = row;

  return (
    <div
      className={`outline-row${focused ? ' outline-row-focused' : ''}${
        isMatch ? ' outline-row-match' : ''
      }`}
      style={{ paddingLeft: `${depth * 22}px` }}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? !line.collapsed : undefined}
      data-line-id={line.id}
    >
      <button
        type="button"
        className="outline-chevron"
        onClick={onToggle}
        disabled={!hasChildren}
        aria-label={hasChildren ? (line.collapsed ? 'Expand' : 'Collapse') : 'No children'}
        tabIndex={-1}
      >
        {hasChildren ? (line.collapsed ? '▸' : '▾') : ''}
      </button>

      <button
        type="button"
        className="outline-bullet"
        onClick={onCycle}
        onDoubleClick={onZoom}
        title={`${line.status ?? 'new'} — click to advance, double-click to zoom in`}
        aria-label={`Status ${line.status ?? 'new'}`}
        tabIndex={-1}
      >
        {GLYPH[line.status ?? 'new'] ?? '○'}
      </button>

      <textarea
        ref={registerInput}
        className="outline-text"
        value={line.text}
        rows={1}
        spellCheck={false}
        aria-label={line.text || 'Empty line'}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onChange={(e) => onChange(e.target.value)}
      />

      <span className="outline-author">{line.author}</span>
    </div>
  );
}
