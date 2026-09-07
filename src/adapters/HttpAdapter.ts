import type { EnsembleAdapter, OutlineWriteResult } from '@/adapters/EnsembleAdapter';
import type { Correlation, OutlineDiff, OutlineLine, OutlineSnapshot } from '@/types/outline';
import {
  ALIGNMENT_LOCAL_IDENTITY,
  extractFacetEntries,
  extractMainDrivers,
  mapFacetEntries,
  mapMainDrivers,
  type AlignmentFacetEntry,
  type AlignmentMainDriver,
  type AlignmentMainDriversResponse,
} from '@/adapters/alignmentMapper';
import type { DriverNode, EnsembleIdentity, NodeRole } from '@/types/ensemble';

export interface HttpAdapterOptions {
  /** Base URL of the Alignment ensemble API, e.g. http://127.0.0.1:3001 */
  baseUrl: string;
  /** Optional bearer token. */
  token?: string;
  /** Injectable fetch for tests. */
  fetch?: typeof fetch;
}

/**
 * HTTP adapter — fetches live roster data from Alignment ensemble API.
 *
 * Endpoints:
 *   GET  {baseUrl}/api/ensemble/main-drivers            roster projection
 *   GET  {baseUrl}/api/ensemble/main-drivers/:id/facet  roster children
 *   GET  {baseUrl}/api/driver/outline                   outline projection
 *   POST {baseUrl}/api/driver/op                        outline writes
 *
 * Identity is static until Alignment exposes a dedicated endpoint.
 */
export class HttpAdapter implements EnsembleAdapter {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchFn: typeof fetch;
  private readonly parentRoles = new Map<string, NodeRole>();

  constructor(options: HttpAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.fetchFn = options.fetch ?? fetch.bind(globalThis);
  }

  async getIdentity(): Promise<EnsembleIdentity> {
    return { ...ALIGNMENT_LOCAL_IDENTITY };
  }

  async getMainDrivers(): Promise<DriverNode[]> {
    const raw = await this.request<AlignmentMainDriver[] | AlignmentMainDriversResponse>(
      '/api/ensemble/main-drivers',
    );
    const drivers = mapMainDrivers(extractMainDrivers(raw));
    this.parentRoles.clear();
    for (const driver of drivers) {
      this.parentRoles.set(driver.id, driver.role);
    }
    return drivers.map(cloneDriverNode);
  }

  async expandNode(nodeId: string): Promise<DriverNode[]> {
    const raw = await this.request<
      | AlignmentFacetEntry[]
      | { subNodes?: AlignmentFacetEntry[]; children?: AlignmentFacetEntry[] }
    >(`/api/ensemble/main-drivers/${encodeURIComponent(nodeId)}/facet`);
    const entries = extractFacetEntries(raw);
    const parentRole = this.parentRoles.get(nodeId) ?? 'motor';
    return mapFacetEntries(entries, parentRole).map(cloneDriverNode);
  }

  /** The outline projection — the same node space, linearized to be read. */
  async getOutline(): Promise<OutlineSnapshot> {
    const raw = await this.request<{
      rev?: number;
      lines?: OutlineLine[];
      correlations?: Correlation[];
    }>('/api/driver/outline');

    return {
      rev: typeof raw?.rev === 'number' ? raw.rev : 0,
      lines: Array.isArray(raw?.lines) ? raw.lines : [],
      correlations: Array.isArray(raw?.correlations) ? raw.correlations : [],
    };
  }

  /**
   * Write a structural change. `origin: 'app'` tags this window as the writer so
   * the server's broadcast does not echo our own edit back at us as remote news.
   */
  async applyOutlineDiff(diff: OutlineDiff): Promise<OutlineWriteResult> {
    const raw = await this.request<{ ok?: boolean; rev?: number; dropped?: string[] }>(
      '/api/driver/op',
      {
        method: 'POST',
        body: JSON.stringify({ upsert: diff.upsert, remove: diff.remove, origin: 'app' }),
      },
    );

    return {
      rev: typeof raw?.rev === 'number' ? raw.rev : 0,
      ...(Array.isArray(raw?.dropped) && raw.dropped.length ? { dropped: raw.dropped } : {}),
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    if (init?.body) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, { ...init, headers });
    } catch (cause) {
      throw new HttpAdapterError(
        `HttpAdapter request failed for ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause },
      );
    }

    if (!response.ok) {
      throw new HttpAdapterError(
        `HttpAdapter received HTTP ${response.status} from ${this.baseUrl}${path}`,
      );
    }

    return response.json() as Promise<T>;
  }
}

function cloneDriverNode(node: DriverNode): DriverNode {
  return {
    ...node,
    bodyState: { ...node.bodyState },
    ...(node.children !== undefined
      ? { children: node.children.map(cloneDriverNode) }
      : {}),
  };
}

export class HttpAdapterError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'HttpAdapterError';
  }
}

/** @deprecated Use HttpAdapterError — kept for existing imports. */
export class HttpAdapterNotConfiguredError extends HttpAdapterError {
  constructor(message: string) {
    super(message);
    this.name = 'HttpAdapterNotConfiguredError';
  }
}
