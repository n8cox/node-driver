import type { OutlineLine, OutlineRow } from '@/types/outline';

/** Children of a parent, in sibling order (ties broken by ts, then id, so sorts are stable). */
export function childrenOf(lines: readonly OutlineLine[], parentId: string | null): OutlineLine[] {
  return lines
    .filter((l) => (l.parentId ?? null) === parentId)
    .sort((a, b) => a.order - b.order || (a.ts ?? 0) - (b.ts ?? 0) || a.id.localeCompare(b.id));
}

/** True when the line has at least one child. */
export function hasChildren(lines: readonly OutlineLine[], id: string): boolean {
  return lines.some((l) => (l.parentId ?? null) === id);
}

/**
 * Flatten to the rows a reader actually sees: depth-first, skipping the
 * subtrees of collapsed lines. This is the linearization the design law names.
 */
export function visibleRows(lines: readonly OutlineLine[], rootId: string | null = null): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const seen = new Set<string>();

  const walk = (parentId: string | null, depth: number) => {
    for (const line of childrenOf(lines, parentId)) {
      // A cycle would otherwise hang the render; a malformed parent chain is
      // data we may receive, not an invariant we can assume.
      if (seen.has(line.id)) continue;
      seen.add(line.id);
      const kids = hasChildren(lines, line.id);
      rows.push({ line, depth, hasChildren: kids });
      if (kids && !line.collapsed) walk(line.id, depth + 1);
    }
  };

  walk(rootId, 0);
  return rows;
}

/** Every descendant id of `id`, deepest-last. Used for subtree removal. */
export function descendantIds(lines: readonly OutlineLine[], id: string): string[] {
  const out: string[] = [];
  const walk = (parentId: string) => {
    for (const child of childrenOf(lines, parentId)) {
      out.push(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

/** The line immediately above `id` in visible order, or null at the top. */
export function previousVisible(rows: readonly OutlineRow[], id: string): OutlineLine | null {
  const i = rows.findIndex((r) => r.line.id === id);
  return i > 0 ? rows[i - 1].line : null;
}

/** The line immediately below `id` in visible order, or null at the bottom. */
export function nextVisible(rows: readonly OutlineRow[], id: string): OutlineLine | null {
  const i = rows.findIndex((r) => r.line.id === id);
  return i >= 0 && i < rows.length - 1 ? rows[i + 1].line : null;
}

/** Every ancestor id of `id`, nearest first. */
export function ancestorIds(lines: readonly OutlineLine[], id: string): string[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const out: string[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id)?.parentId ?? null;
  while (cur && byId.has(cur) && !seen.has(cur)) {
    out.push(cur);
    seen.add(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return out;
}

/**
 * Rows matching `query`, each shown WITH its ancestors so a hit is never a line
 * without context. Collapse is ignored while searching — a fold must not hide a
 * result — and the matched lines are reported so the view can mark them.
 */
export function searchRows(
  lines: readonly OutlineLine[],
  query: string,
  rootId: string | null = null,
  alwaysKeep: string | null = null,
): { rows: OutlineRow[]; matched: Set<string> } {
  const needle = query.trim().toLowerCase();
  if (!needle) return { rows: visibleRows(lines, rootId), matched: new Set() };

  const matched = new Set<string>();
  for (const line of lines) {
    // `?? ''` is not decoration: the live outline contains lines with no text.
    if ((line.text ?? '').toLowerCase().includes(needle)) matched.add(line.id);
  }

  const keep = new Set<string>(matched);
  for (const id of matched) for (const a of ancestorIds(lines, id)) keep.add(a);

  // A line the user is EDITING must never be filtered away. A new line is empty,
  // so it matches nothing — hiding it left the caret on the previous row, and
  // the next keystroke overwrote a line the user never meant to touch.
  if (alwaysKeep && lines.some((l) => l.id === alwaysKeep)) {
    keep.add(alwaysKeep);
    for (const a of ancestorIds(lines, alwaysKeep)) keep.add(a);
  }

  const rows: OutlineRow[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const line of childrenOf(lines, parentId)) {
      if (!keep.has(line.id) || seen.has(line.id)) continue;
      seen.add(line.id);
      rows.push({ line, depth, hasChildren: hasChildren(lines, line.id) });
      walk(line.id, depth + 1);
    }
  };
  walk(rootId, 0);

  return { rows, matched };
}
