/**
 * The OUTLINE projection of the node space.
 *
 * Design law (Nathan, 2026-07-01): "Node Driver is the linear expression of the
 * node graphs." The outline and the roster are two projections of ONE node
 * space — anything expressible in one must be expressible in the other.
 *
 * The outline is the SPINE: a strict tree, because outlines must edit like
 * outlines. Edges a tree cannot hold are `Correlation`s — a second class of
 * edge that lives in another dimension and is never part of the parent chain.
 */

/** Status glyph cycle — moon phases for progress, plus terminal and marker states. */
export type OutlineStatus =
  | 'new'
  | 'crescent'
  | 'quarter'
  | 'half'
  | 'gibbous'
  | 'full'
  | 'done'
  | 'flag'
  | 'note'
  | 'blocked'
  | 'failed';

/** One bullet. `parentId === null` is a root line. */
export interface OutlineLine {
  id: string;
  parentId: string | null;
  /** Sort key among siblings. Ascending. */
  order: number;
  text: string;
  author: string;
  collapsed?: boolean;
  sent?: boolean;
  ts?: number;
  status?: OutlineStatus;
  meta?: Record<string, unknown>;
}

/** An extra-dimensional edge — a correlation that the tree cannot express. */
export interface Correlation {
  id: string;
  from: string;
  to: string;
  note?: string;
}

/** A whole outline at a revision. */
export interface OutlineSnapshot {
  rev: number;
  lines: OutlineLine[];
  correlations: Correlation[];
}

/**
 * A structural change, in the wire shape the Alignment driver API accepts:
 * `POST /api/driver/op { upsert, remove }`.
 */
export interface OutlineDiff {
  upsert: OutlineLine[];
  remove: string[];
}

/** A visible row: a line plus its depth, after collapse is applied. */
export interface OutlineRow {
  line: OutlineLine;
  depth: number;
  hasChildren: boolean;
}
