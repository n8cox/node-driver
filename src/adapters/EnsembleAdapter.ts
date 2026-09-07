import type { DriverNode, EnsembleIdentity } from '@/types/ensemble';
import type { OutlineDiff, OutlineSnapshot } from '@/types/outline';

/** Result of writing a structural change. `rev` is the outline revision after the write. */
export interface OutlineWriteResult {
  rev: number;
  /** Ids the backend refused to write (guarded or fenced lines), if any. */
  dropped?: string[];
}

/**
 * Data seam between Node Driver UI and an ensemble backend.
 *
 * TWO PROJECTIONS OF ONE NODE SPACE (Nathan's design law, 2026-07-01):
 *   - the ROSTER projection — `getMainDrivers` / `expandNode`
 *   - the OUTLINE projection — `getOutline` / `applyOutlineDiff`
 *
 * The outline pair is optional so an adapter can serve a read-only roster
 * without pretending to be editable. Guard with `supportsOutline`.
 */
export interface EnsembleAdapter {
  /** Ensemble identity for the identity strip. */
  getIdentity(): Promise<EnsembleIdentity>;

  /** Top-level main drivers only — no nested children unless already cached. */
  getMainDrivers(): Promise<DriverNode[]>;

  /**
   * Lazy-load nested activity sub-nodes for a driver.
   * Returns an empty array when the node has no children.
   */
  expandNode(nodeId: string): Promise<DriverNode[]>;

  /** The outline projection: the whole node space linearized to be read. */
  getOutline?(): Promise<OutlineSnapshot>;

  /** Write a structural change produced by the outline grammar. */
  applyOutlineDiff?(diff: OutlineDiff): Promise<OutlineWriteResult>;
}

/** An adapter that can serve AND write the outline projection. */
export type OutlineCapableAdapter = EnsembleAdapter &
  Required<Pick<EnsembleAdapter, 'getOutline' | 'applyOutlineDiff'>>;

/** True when this adapter offers the editable outline projection. */
export function supportsOutline(adapter: EnsembleAdapter): adapter is OutlineCapableAdapter {
  return typeof adapter.getOutline === 'function' && typeof adapter.applyOutlineDiff === 'function';
}
