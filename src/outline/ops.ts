/**
 * The outline editing grammar, as PURE functions.
 *
 * Every operation takes the current lines and returns an `OutlineDiff` — the
 * exact `{ upsert, remove }` shape `POST /api/driver/op` accepts. Nothing here
 * touches React, the network, or the clock unless you hand it a clock. That is
 * deliberate: this grammar is the part that must be right, so it is the part
 * that is testable without a browser or a server.
 *
 * Grammar ported from the live DriverCanvas (Nathan's spec 2026-06-12, QoL pass
 * 2026-06-13):
 *   Enter                sibling below — or first child when the subtree is open
 *   Enter (empty, nested) outdent, the double-Enter list idiom
 *   Tab / Shift-Tab      indent / outdent
 *   Backspace (empty)    delete, promoting any children into the freed slot
 *   Backspace (at start) merge into the previous line
 *   Alt+Shift+Up/Down    reorder among siblings
 */
import type { OutlineDiff, OutlineLine } from '@/types/outline';
import { childrenOf, descendantIds, hasChildren } from '@/outline/tree';

const EMPTY: OutlineDiff = { upsert: [], remove: [] };

export interface OpContext {
  /** Author stamped on newly created lines. */
  author: string;
  /** Injectable so tests are deterministic. */
  makeId?: () => string;
  now?: () => number;
}

function idFactory(ctx: OpContext): () => string {
  return ctx.makeId ?? (() => `drv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
}

/**
 * Renumber a sibling list to 1..n under `parentId`, emitting upserts ONLY for
 * lines that actually changed — where "changed" means order OR parentage.
 *
 * Comparing parentage matters: a line promoted out of a deleted parent can keep
 * the same order number, and an order-only comparison would silently drop the
 * reparenting and leave the line pointing at an id that no longer exists.
 */
function resequenceInto(
  original: readonly OutlineLine[],
  ordered: readonly OutlineLine[],
  parentId: string | null,
): OutlineLine[] {
  const before = new Map(original.map((l) => [l.id, l]));
  const out: OutlineLine[] = [];
  ordered.forEach((line, i) => {
    const order = i + 1;
    const prev = before.get(line.id);
    const moved = !prev || prev.order !== order || (prev.parentId ?? null) !== parentId;
    if (moved) out.push({ ...line, parentId, order });
  });
  return out;
}

/** Place `moved` into `parentId`'s child list at `index`, resequencing the result. */
function spliceInto(
  lines: readonly OutlineLine[],
  moved: OutlineLine,
  parentId: string | null,
  index: number,
): OutlineLine[] {
  const siblings = childrenOf(lines, parentId).filter((l) => l.id !== moved.id);
  const next = [...siblings];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, { ...moved, parentId });
  return resequenceInto(lines, next, parentId);
}

/**
 * Enter. A sibling below `id` — unless `id` has an OPEN subtree, in which case
 * the new line becomes its first child, which is where the eye expects it.
 */
export function insertSibling(
  lines: readonly OutlineLine[],
  id: string,
  ctx: OpContext,
): OutlineDiff & { newId: string | null } {
  const cur = lines.find((l) => l.id === id);
  if (!cur) return { ...EMPTY, newId: null };

  const newId = idFactory(ctx)();
  const now = (ctx.now ?? Date.now)();
  const openSubtree = hasChildren(lines, id) && !cur.collapsed;

  const created: OutlineLine = {
    id: newId,
    parentId: openSubtree ? id : cur.parentId ?? null,
    order: 0,
    text: '',
    author: ctx.author,
    collapsed: false,
    sent: false,
    ts: now,
    status: 'new',
  };

  const parentId = created.parentId;
  const index = openSubtree
    ? 0
    : childrenOf(lines, parentId).findIndex((l) => l.id === id) + 1;

  return { upsert: spliceInto(lines, created, parentId, index), remove: [], newId };
}

/** Tab. The previous sibling adopts this line as its last child. */
export function indent(lines: readonly OutlineLine[], id: string): OutlineDiff {
  const cur = lines.find((l) => l.id === id);
  if (!cur) return EMPTY;

  const siblings = childrenOf(lines, cur.parentId ?? null);
  const i = siblings.findIndex((l) => l.id === id);
  if (i <= 0) return EMPTY; // nothing above to adopt it

  const newParent = siblings[i - 1];
  const upsert = spliceInto(lines, cur, newParent.id, childrenOf(lines, newParent.id).length);

  // A collapsed new parent would swallow the line the moment it moved.
  if (newParent.collapsed) upsert.push({ ...newParent, collapsed: false });

  return { upsert, remove: [] };
}

/** Shift-Tab. The line becomes the next sibling of its own parent. */
export function outdent(lines: readonly OutlineLine[], id: string): OutlineDiff {
  const cur = lines.find((l) => l.id === id);
  if (!cur || !cur.parentId) return EMPTY; // already at root

  const parent = lines.find((l) => l.id === cur.parentId);
  if (!parent) return EMPTY;

  const grandParentId = parent.parentId ?? null;
  const index = childrenOf(lines, grandParentId).findIndex((l) => l.id === parent.id) + 1;

  return { upsert: spliceInto(lines, cur, grandParentId, index), remove: [] };
}

/**
 * Backspace on an empty line. Children are PROMOTED into the freed slot rather
 * than deleted with their parent — an empty bullet is a container the operator
 * emptied, not a mandate to drop the subtree under it.
 */
export function removeEmpty(lines: readonly OutlineLine[], id: string): OutlineDiff {
  const cur = lines.find((l) => l.id === id);
  if (!cur) return EMPTY;

  const parentId = cur.parentId ?? null;
  const siblings = childrenOf(lines, parentId);
  const at = siblings.findIndex((l) => l.id === id);
  const kids = childrenOf(lines, id);

  const next = siblings.filter((l) => l.id !== id);
  next.splice(at, 0, ...kids.map((k) => ({ ...k, parentId })));

  return { upsert: resequenceInto(lines, next, parentId), remove: [id] };
}

/**
 * Backspace at the start of a line that still has text: append the text to the
 * previous sibling instead of letting a keystroke destroy it. Declines when the
 * line has children, because a merge would have nowhere to put them.
 */
export function mergeIntoPrev(lines: readonly OutlineLine[], id: string): OutlineDiff & { mergedInto: string | null } {
  const cur = lines.find((l) => l.id === id);
  if (!cur) return { ...EMPTY, mergedInto: null };
  if (hasChildren(lines, id)) return { ...EMPTY, mergedInto: null };

  const siblings = childrenOf(lines, cur.parentId ?? null);
  const i = siblings.findIndex((l) => l.id === id);
  if (i <= 0) return { ...EMPTY, mergedInto: null };

  const prev = siblings[i - 1];
  const merged: OutlineLine = { ...prev, text: `${prev.text}${cur.text}` };
  const next = siblings.filter((l) => l.id !== id).map((l) => (l.id === prev.id ? merged : l));

  const upsert = resequenceInto(lines, next, cur.parentId ?? null);
  if (!upsert.some((l) => l.id === prev.id)) upsert.push(merged);

  return { upsert, remove: [id], mergedInto: prev.id };
}

/** Alt+Shift+Up/Down. Reorder among siblings; the subtree travels with it. */
export function moveNode(lines: readonly OutlineLine[], id: string, delta: -1 | 1): OutlineDiff {
  const cur = lines.find((l) => l.id === id);
  if (!cur) return EMPTY;

  const siblings = childrenOf(lines, cur.parentId ?? null);
  const i = siblings.findIndex((l) => l.id === id);
  const target = i + delta;
  if (i < 0 || target < 0 || target >= siblings.length) return EMPTY;

  const next = [...siblings];
  next.splice(i, 1);
  next.splice(target, 0, cur);

  return { upsert: resequenceInto(lines, next, cur.parentId ?? null), remove: [] };
}

/** Text edit. */
export function setText(lines: readonly OutlineLine[], id: string, text: string): OutlineDiff {
  const cur = lines.find((l) => l.id === id);
  if (!cur || cur.text === text) return EMPTY;
  return { upsert: [{ ...cur, text }], remove: [] };
}

/** Fold or unfold a subtree. */
export function toggleCollapse(lines: readonly OutlineLine[], id: string): OutlineDiff {
  const cur = lines.find((l) => l.id === id);
  if (!cur || !hasChildren(lines, id)) return EMPTY;
  return { upsert: [{ ...cur, collapsed: !cur.collapsed }], remove: [] };
}

/** Delete a line and everything under it. The only op that drops a subtree. */
export function removeSubtree(lines: readonly OutlineLine[], id: string): OutlineDiff {
  const cur = lines.find((l) => l.id === id);
  if (!cur) return EMPTY;
  const doomed = [id, ...descendantIds(lines, id)];
  const survivors = childrenOf(lines, cur.parentId ?? null).filter((l) => l.id !== id);
  return { upsert: resequenceInto(lines, survivors, cur.parentId ?? null), remove: doomed };
}

/** Apply a diff to a line list — the local echo, so the UI does not wait on a round trip. */
export function applyDiff(lines: readonly OutlineLine[], diff: OutlineDiff): OutlineLine[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  for (const line of diff.upsert) byId.set(line.id, { ...byId.get(line.id), ...line });
  for (const id of diff.remove) byId.delete(id);
  return [...byId.values()];
}
