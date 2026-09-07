import type { EnsembleAdapter } from '@/adapters/EnsembleAdapter';
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
 *   GET  {baseUrl}/api/ensemble/main-drivers
 *   GET  {baseUrl}/api/ensemble/main-drivers/:id/facet
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

  private async request<T>(path: string): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, { headers });
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
