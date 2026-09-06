import type { DriverNode, EnsembleIdentity } from '@/types/ensemble';

/**
 * Data seam between Node Driver UI and an ensemble backend.
 * Main drivers load eagerly; nested activity sub-nodes load on expand.
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
}
