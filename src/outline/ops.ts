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
import type { OutlineDiff, OutlineLine, OutlineStatus } from '@/types/outline';
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

/**
 * An order value that sits strictly between two neighbours, or null when there
 * is no room left between them.
 *
 * Orders are sparse on purpose. Renumbering a sibling list to 1..n means one
 * `Enter` at the top level rewrites every root line — 45 lines on the live
 * outline, into a file the backend rewrites whole on every op. Taking the gap
 * between neighbours makes the ordinary insert a ONE line write, and the full
 * renumber happens only when a gap really has closed.
 */
function orderBetween(prev?: OutlineLine, next?: OutlineLine): number | null {
  const lo = prev?.order;
  const hi = next?.order;
  if (lo === undefined && hi === undefined) return 1;
  if (lo === undefined) return hi! - 1;
  if (hi === undefined) return lo + 1;
  const gap = hi - lo;
  // Below this the midpoints stop being reliably distinct in float64.
  return gap > 1e-9 ? lo + gap / 2 : null;
}

/** Place `moved` into `parentId`'s child list at `index`. */
function spliceInto(
  lines: readonly OutlineLine[],
  moved: OutlineLine,
  parentId: string | null,
  index: number,
): OutlineLine[] {
  const siblings = childrenOf(lines, parentId).filter((l) => l.id !== moved.id);
  const at = Math.max(0, Math.min(index, siblings.length));

  const order = orderBetween(siblings[at - 1], siblings[at]);
  if (order !== null) return [{ ...moved, parentId, order }];

  // Gap exhausted — fall back to renumbering this sibling list.
  const next = [...siblings];
  next.splice(at, 0, { ...moved, parentId });
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

  return { upsert: spliceInto(lines, cur, cur.parentId ?? null, target), remove: [] };
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

/**
 * The change that turns `from` into `to`, as a wire diff.
 *
 * Undo is a snapshot restore (Nathan's QoL ask, 2026-06-13: "held backspace,
 * deleted fast, no undo"), and a restore has to reach the backend as the same
 * `{ upsert, remove }` vocabulary as every other edit — so the snapshot is
 * differenced rather than sent whole. A 2,989-line outline must not be rewritten
 * because one line moved.
 */
export function diffOutlines(
  from: readonly OutlineLine[],
  to: readonly OutlineLine[],
): OutlineDiff {
  const before = new Map(from.map((l) => [l.id, l]));
  const after = new Map(to.map((l) => [l.id, l]));

  const upsert: OutlineLine[] = [];
  for (const [id, line] of after) {
    const prev = before.get(id);
    if (!prev || !sameLine(prev, line)) upsert.push(line);
  }

  const remove: string[] = [];
  for (const id of before.keys()) if (!after.has(id)) remove.push(id);

  return { upsert, remove };
}

function sameLine(a: OutlineLine, b: OutlineLine): boolean {
  return (
    a.text === b.text &&
    (a.parentId ?? null) === (b.parentId ?? null) &&
    a.order === b.order &&
    !!a.collapsed === !!b.collapsed &&
    a.status === b.status
  );
}

/** The moon-phase cycle a bullet click steps through. */
const STATUS_CYCLE: OutlineStatus[] = ['new', 'crescent', 'quarter', 'gibbous', 'full', 'done'];

/** Click the bullet to advance progress — the status cycle from the live canvas. */
export function cycleStatus(lines: readonly OutlineLine[], id: string): OutlineDiff {
  const cur = lines.find((l) => l.id === id);
  if (!cur) return EMPTY;
  const at = STATUS_CYCLE.indexOf((cur.status ?? 'new') as OutlineStatus);
  // A line carrying a marker status (note, flag, blocked) enters the cycle at
  // the start rather than being pinned outside it.
  const next = STATUS_CYCLE[(at + 1) % STATUS_CYCLE.length];
  return { upsert: [{ ...cur, status: next }], remove: [] };
}

/** One line of a subtree lifted out for the clipboard. */
export interface ClippedLine {
  depth: number;
  text: string;
  status?: OutlineStatus;
}

/** Flatten a subtree to depth-tagged lines — the clipboard's internal form. */
export function clipSubtree(lines: readonly OutlineLine[], id: string): ClippedLine[] {
  const root = lines.find((l) => l.id === id);
  if (!root) return [];

  const out: ClippedLine[] = [];
  const walk = (lineId: string, depth: number) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    out.push({ depth, text: line.text, ...(line.status ? { status: line.status } : {}) });
    for (const child of childrenOf(lines, lineId)) walk(child.id, depth + 1);
  };
  walk(id, 0);
  return out;
}

/** Render clipped lines as indented plain text, so it pastes into any app. */
export function clipToText(clip: readonly ClippedLine[]): string {
  return clip.map((c) => `${'  '.repeat(c.depth)}${c.text}`).join('\n');
}

/**
 * Parse indented plain text into clipped lines.
 *
 * This is what makes pasting a list from ANY source work — the most-used
 * clipboard need in the QoL study. Indentation is measured against the shallowest
 * line so a block copied from the middle of a document keeps its shape.
 */
export function parseIndentedText(text: string): ClippedLine[] {
  const raw = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (raw.length === 0) return [];

  const measure = (line: string) => {
    const match = /^[\t ]*/.exec(line)?.[0] ?? '';
    // A tab is one level; spaces are counted in pairs, which matches how both
    // outliners and hand-indented text tend to be written.
    return match.replace(/\t/g, '  ').length;
  };

  const indents = raw.map(measure);
  const base = Math.min(...indents);
  // Map distinct indent widths to consecutive depths so 4-space and 2-space
  // sources both nest one level per step.
  const widths = [...new Set(indents.map((i) => i - base))].sort((a, b) => a - b);

  return raw.map((line, i) => ({
    depth: widths.indexOf(indents[i] - base),
    text: line.trim(),
  }));
}

/**
 * Insert a clipped subtree after `afterId` (or as its first child when its
 * subtree is open), preserving relative nesting.
 */
export function insertClip(
  lines: readonly OutlineLine[],
  afterId: string,
  clip: readonly ClippedLine[],
  ctx: OpContext,
): OutlineDiff & { firstId: string | null } {
  const anchor = lines.find((l) => l.id === afterId);
  if (!anchor || clip.length === 0) return { ...EMPTY, firstId: null };

  const makeId = idFactory(ctx);
  const now = (ctx.now ?? Date.now)();
  const openSubtree = hasChildren(lines, afterId) && !anchor.collapsed;
  const rootParent = openSubtree ? afterId : anchor.parentId ?? null;

  // Depth → the id of the most recent line at that depth, so children attach
  // to the right ancestor as the clip is walked in order.
  const parentAtDepth = new Map<number, string | null>([[0, rootParent]]);
  const created: OutlineLine[] = [];

  clip.forEach((entry, i) => {
    const parentId = parentAtDepth.get(entry.depth) ?? rootParent;
    const line: OutlineLine = {
      id: makeId(),
      parentId,
      order: 0,
      text: entry.text,
      author: ctx.author,
      collapsed: false,
      sent: false,
      ts: now + i,
      status: entry.status ?? 'new',
    };
    created.push(line);
    parentAtDepth.set(entry.depth + 1, line.id);
  });

  // Place the clip's roots after the anchor; deeper lines already point at their
  // parent and simply need sequential order.
  const roots = created.filter((l) => l.parentId === rootParent);
  const siblings = childrenOf(lines, rootParent);
  const at = openSubtree ? 0 : siblings.findIndex((l) => l.id === afterId) + 1;
  const next = [...siblings];
  next.splice(Math.max(0, Math.min(at, next.length)), 0, ...roots);

  const upsert = resequenceInto(lines, next, rootParent);
  const placed = new Set(upsert.map((l) => l.id));
  for (const line of created) if (!placed.has(line.id)) upsert.push(line);

  return { upsert, remove: [], firstId: created[0]?.id ?? null };
}
