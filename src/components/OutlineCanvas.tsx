import { useEffect, useRef } from 'react';
import {
  indent,
  insertSibling,
  mergeIntoPrev,
  moveNode,
  outdent,
  removeEmpty,
  toggleCollapse,
} from '@/outline/ops';
import { nextVisible, previousVisible } from '@/outline/tree';
import type { OutlineLine, OutlineRow } from '@/types/outline';
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
 * behaviours grow into this space afterwards. Every keystroke maps to a pure
 * op in `@/outline/ops`, so the behaviour under test and the behaviour on
 * screen are the same function.
 */
export function OutlineCanvas({ outline, author }: OutlineCanvasProps) {
  const { lines, rows, loading, error, dropped, editable, focusId, setFocusId, mutate, editText } =
    outline;
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());
  // Where to put the caret after a merge — the junction, not the end of the line.
  const pendingCaret = useRef<{ id: string; at: number } | null>(null);

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

  if (!editable) {
    return (
      <div className="outline-empty">
        This adapter serves the roster only — it does not expose the outline projection.
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return <div className="outline-empty">Loading outline…</div>;
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, row: OutlineRow) => {
    const { line } = row;
    const el = e.currentTarget;
    const text = el.value;
    const caretAtStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const caretAtEnd = el.selectionStart === text.length && el.selectionEnd === text.length;

    if (e.key === 'Enter') {
      e.preventDefault();
      // Enter on an empty nested line lifts it out a level — the double-Enter
      // idiom every list editor shares.
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

    if (e.key === 'Backspace' && caretAtStart) {
      const d = mergeIntoPrev(lines, line.id);
      if (!d.mergedInto) return; // declined — fall through to native behaviour
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
      // On a wrapped bullet the arrows belong to the text; only cross to another
      // bullet once the caret is already at the edge.
      if ((e.key === 'ArrowUp' && !caretAtStart) || (e.key === 'ArrowDown' && !caretAtEnd)) return;
      const target =
        e.key === 'ArrowDown' ? nextVisible(rows, line.id) : previousVisible(rows, line.id);
      if (!target) return;
      e.preventDefault();
      setFocusId(target.id);
    }
  };

  return (
    <div className="outline" role="tree" aria-label="Outline">
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

      {rows.length === 0 && <div className="outline-empty">Outline is empty.</div>}

      {rows.map((row) => (
        <OutlineRowView
          key={row.line.id}
          row={row}
          lines={lines}
          focused={focusId === row.line.id}
          registerInput={(el) => {
            if (el) inputs.current.set(row.line.id, el);
            else inputs.current.delete(row.line.id);
          }}
          onFocus={() => setFocusId(row.line.id)}
          onKeyDown={(e) => onKeyDown(e, row)}
          onChange={(text) => editText(row.line.id, text)}
          onToggle={() => void mutate(toggleCollapse(lines, row.line.id), row.line.id)}
        />
      ))}
    </div>
  );
}

interface RowViewProps {
  row: OutlineRow;
  lines: readonly OutlineLine[];
  focused: boolean;
  registerInput: (el: HTMLTextAreaElement | null) => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onChange: (text: string) => void;
  onToggle: () => void;
}

function OutlineRowView({
  row,
  focused,
  registerInput,
  onFocus,
  onKeyDown,
  onChange,
  onToggle,
}: RowViewProps) {
  const { line, depth, hasChildren } = row;

  return (
    <div
      className={`outline-row${focused ? ' outline-row-focused' : ''}`}
      style={{ paddingLeft: `${depth * 22}px` }}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? !line.collapsed : undefined}
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

      <span className="outline-bullet" title={line.status ?? 'new'}>
        {GLYPH[line.status ?? 'new'] ?? '○'}
      </span>

      <textarea
        ref={registerInput}
        className="outline-text"
        value={line.text}
        rows={1}
        spellCheck={false}
        aria-label={line.text || 'Empty line'}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange(e.target.value)}
      />

      <span className="outline-author">{line.author}</span>
    </div>
  );
}
