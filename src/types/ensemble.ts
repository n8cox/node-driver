/** Role of a driver node in the ensemble roster. */
export type NodeRole = 'human' | 'hemisphere' | 'connection' | 'motor';

/** Live body-state for a node — state, optional engagement, driving flag, activity line. */
export interface BodyState {
  state: string;
  engagement?: string;
  driving?: boolean;
  activityLine: string;
}

/** A driver node in the roster. Children are lazy-loaded on expand. */
export interface DriverNode {
  id: string;
  name: string;
  purpose: string;
  role: NodeRole;
  bodyState: BodyState;
  /** True when nested activity sub-nodes exist but are not yet loaded. */
  hasChildren?: boolean;
  /** Populated after lazy expand. */
  children?: DriverNode[];
}

/** Ensemble identity shown in the identity strip. */
export interface EnsembleIdentity {
  id: string;
  name: string;
  description?: string;
}

/** Which adapter backs the UI. */
export type AdapterKind = 'sample' | 'http';
