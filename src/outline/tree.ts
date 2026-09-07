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
