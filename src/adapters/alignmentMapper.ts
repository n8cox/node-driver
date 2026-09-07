import type { BodyState, DriverNode, EnsembleIdentity, NodeRole } from '@/types/ensemble';

/** roleKind values from Alignment main-drivers roster. */
export type AlignmentRoleKind = 'human' | 'hemisphere' | 'connection' | 'bot';

/** Single main driver from GET /api/ensemble/main-drivers. */
export interface AlignmentMainDriver {
  id: string;
  name: string;
  roleKind: AlignmentRoleKind;
  state: string;
  /** Live API sends a number, or null when the driver reports no engagement. */
  engagement?: string | number | null;
  driving?: boolean;
  activity?: string;
  sources?: string[];
}

/** Envelope returned by GET /api/ensemble/main-drivers. */
export interface AlignmentMainDriversResponse {
  ts?: number;
  primaryId?: string;
  drivers?: AlignmentMainDriver[];
}

/** Single facet child from GET /api/ensemble/main-drivers/:id/facet. */
export interface AlignmentFacetEntry {
  id: string;
  label: string;
  detail?: string;
  source?: string;
}

/** Static identity until Alignment exposes a dedicated identity endpoint. */
export const ALIGNMENT_LOCAL_IDENTITY: EnsembleIdentity = {
  id: 'alignment-local',
  name: 'Rayla',
  description: 'Nathan Cox local ensemble · Alignment :3001',
};

const ROLE_ORDER: Record<NodeRole, number> = {
  human: 0,
  hemisphere: 1,
  connection: 2,
  motor: 3,
};

/** Map Alignment roleKind to Node Driver role (bot → motor). */
export function mapRoleKind(roleKind: AlignmentRoleKind | string): NodeRole {
  if (roleKind === 'bot') return 'motor';
  if (roleKind === 'human' || roleKind === 'hemisphere' || roleKind === 'connection') {
    return roleKind;
  }
  return 'motor';
}

/** Derive a purpose line from role and activity when Alignment does not supply one. */
export function inventPurpose(role: NodeRole, activity?: string, name?: string): string {
  const activityHint = activity?.trim();
  switch (role) {
    case 'human':
      return activityHint
        ? `Directs ensemble priorities — ${activityHint}`
        : 'Directs ensemble priorities';
    case 'hemisphere':
      return activityHint
        ? `Reasoning hemisphere — ${activityHint}`
        : `${name ?? 'Hemisphere'} — structured reasoning`;
    case 'connection':
      return activityHint
        ? `Model connection — ${activityHint}`
        : `${name ?? 'Connection'} — inference endpoint`;
    case 'motor':
      return activityHint
        ? `Motor process — ${activityHint}`
        : `${name ?? 'Motor'} — process execution`;
  }
}

/** Flat Alignment state fields → BodyState. */
export function mapBodyState(raw: Pick<AlignmentMainDriver, 'state' | 'engagement' | 'driving' | 'activity'>): BodyState {
  const body: BodyState = {
    state: raw.state,
    activityLine: raw.activity ?? '',
  };
  if (raw.engagement !== undefined && raw.engagement !== null && raw.engagement !== '') {
    body.engagement = String(raw.engagement);
  }
  if (raw.driving !== undefined) {
    body.driving = raw.driving;
  }
  return body;
}

/** Map one Alignment main driver to a top-level DriverNode (no pre-loaded children). */
export function mapMainDriver(raw: AlignmentMainDriver): DriverNode {
  const role = mapRoleKind(raw.roleKind);
  return {
    id: raw.id,
    name: raw.name,
    purpose: inventPurpose(role, raw.activity, raw.name),
    role,
    bodyState: mapBodyState(raw),
    hasChildren: true,
  };
}

/** Map and sort main drivers: human → hemisphere → connection → motor. */
export function mapMainDrivers(raw: AlignmentMainDriver[]): DriverNode[] {
  return sortDriversByRole(raw.map(mapMainDriver));
}

/** Map facet entries to nested activity DriverNodes. */
export function mapFacetEntry(entry: AlignmentFacetEntry, parentRole: NodeRole): DriverNode {
  const detail = entry.detail?.trim();
  const source = entry.source?.trim();
  const activityLine = detail || source || entry.label;
  return {
    id: entry.id,
    name: entry.label,
    purpose: detail || source || inventPurpose(parentRole, activityLine, entry.label),
    role: parentRole,
    bodyState: {
      state: source || 'active',
      activityLine,
    },
  };
}

export function mapFacetEntries(entries: AlignmentFacetEntry[], parentRole: NodeRole): DriverNode[] {
  return entries.map((entry) => mapFacetEntry(entry, parentRole));
}

/** Sort roster rows by canonical role order. */
export function sortDriversByRole(drivers: DriverNode[]): DriverNode[] {
  return [...drivers].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}

/** Normalize facet response — array, { subNodes: [...] } (live), or { children: [...] }. */
export function extractFacetEntries(
  payload:
    | AlignmentFacetEntry[]
    | { subNodes?: AlignmentFacetEntry[]; children?: AlignmentFacetEntry[] }
    | null
    | undefined,
): AlignmentFacetEntry[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.subNodes)) return payload.subNodes;
  if (payload && Array.isArray(payload.children)) return payload.children;
  return [];
}

/** Normalize roster response — { drivers: [...] } (live) or a bare array. */
export function extractMainDrivers(
  payload: AlignmentMainDriver[] | AlignmentMainDriversResponse | null | undefined,
): AlignmentMainDriver[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.drivers)) return payload.drivers;
  return [];
}
