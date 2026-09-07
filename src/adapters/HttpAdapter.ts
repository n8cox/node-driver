import type { EnsembleAdapter, OutlineWriteResult } from '@/adapters/EnsembleAdapter';
import type { OutlineDiff, OutlineSnapshot } from '@/types/outline';
import {
  ALIGNMENT_LOCAL_IDENTITY,
  extractFacetEntries,
  extractMainDrivers,
  mapFacetEntries,
  mapMainDrivers,
  normalizeCorrelations,
  normalizeOutlineLines,
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
  /** Explicit WebSocket origin; derived from baseUrl when omitted. */
  socketUrl?: string;
  /** Injectable WebSocket constructor for tests. */
  WebSocketImpl?: typeof WebSocket;
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
  private readonly socketUrl?: string;
  private readonly WebSocketImpl?: typeof WebSocket;
  /**
   * Revisions this client produced. A broadcast carrying one of these is our
   * own echo. Matching on the `origin` tag would not work — the Alignment app
   * tags its edits 'app' exactly as we do, so origin cannot tell us apart.
   */
  private readonly ownRevs = new Set<number>();
  private socket: WebSocket | null = null;
  private listeners = new Set<(rev: number) => void>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(options: HttpAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.fetchFn = options.fetch ?? fetch.bind(globalThis);
    this.socketUrl = options.socketUrl;
    this.WebSocketImpl = options.WebSocketImpl;
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
    // Deliberately typed loose: the live outline is years of writes from many
    // tools and is not uniform. It is normalised below rather than trusted.
    const raw = await this.request<{
      rev?: number;
      lines?: unknown;
      correlations?: unknown;
    }>('/api/driver/outline');

    return {
      rev: typeof raw?.rev === 'number' ? raw.rev : 0,
      lines: normalizeOutlineLines(raw?.lines),
      correlations: normalizeCorrelations(raw?.correlations),
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

    const rev = typeof raw?.rev === 'number' ? raw.rev : 0;
    if (rev) this.rememberOwnRev(rev);

    return {
      rev,
      ...(Array.isArray(raw?.dropped) && raw.dropped.length ? { dropped: raw.dropped } : {}),
    };
  }

  /**
   * Subscribe to outline changes made elsewhere. Reconnects on drop, because a
   * silently dead socket is the same failure as no socket at all.
   */
  onOutlineChanged(
    listener: (rev: number) => void,
    onStatus?: (connected: boolean) => void,
  ): () => void {
    this.listeners.add(listener);
    if (onStatus) this.statusListeners.add(onStatus);
    this.closed = false;
    this.ensureSocket();

    return () => {
      this.listeners.delete(listener);
      if (onStatus) this.statusListeners.delete(onStatus);
      if (this.listeners.size === 0) this.closeSocket();
    };
  }

  private announce(connected: boolean): void {
    for (const listener of this.statusListeners) listener(connected);
  }

  private rememberOwnRev(rev: number): void {
    this.ownRevs.add(rev);
    // Bounded: only the recent past can plausibly arrive as an echo.
    if (this.ownRevs.size > 64) {
      const oldest = Math.min(...this.ownRevs);
      this.ownRevs.delete(oldest);
    }
  }

  /**
   * Where the live channel lives.
   *
   * This is NOT the page origin. Under a dev server the page is served by Vite
   * and the backend is proxied only for /api — connecting to the page origin
   * reaches Vite's own HMR socket, which accepts the connection and then never
   * sends an outline event, so the app looks live and silently shows stale data.
   * WebSockets are not subject to CORS, so the backend origin is used directly.
   */
  private resolveSocketUrl(): string | null {
    if (this.socketUrl) return this.socketUrl;
    if (/^https?:/.test(this.baseUrl)) return this.baseUrl.replace(/^http/, 'ws');
    if (typeof location !== 'undefined' && location.origin.startsWith('http')) {
      return location.origin.replace(/^http/, 'ws');
    }
    return null;
  }

  private ensureSocket(): void {
    if (this.socket || this.closed) return;

    const Impl = this.WebSocketImpl ?? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    const url = this.resolveSocketUrl();

    if (!Impl || !url) {
      this.announce(false);
      return;
    }

    let socket: WebSocket;
    try {
      socket = new Impl(url);
    } catch {
      this.announce(false);
      return;
    }
    this.socket = socket;

    socket.onopen = () => this.announce(true);

    socket.onmessage = (event: MessageEvent) => {
      let payload: { type?: string; kind?: string; rev?: number };
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (payload?.type !== 'driver' || payload?.kind !== 'outline') return;
      const rev = typeof payload.rev === 'number' ? payload.rev : 0;
      if (rev && this.ownRevs.has(rev)) return; // our own write coming back
      for (const listener of this.listeners) listener(rev);
    };

    const drop = () => {
      this.socket = null;
      this.announce(false);
      if (this.closed || this.listeners.size === 0) return;
      if (this.reconnectTimer) return;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.ensureSocket();
      }, 2000);
    };

    socket.onclose = drop;
    socket.onerror = drop;
  }

  private closeSocket(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.socket?.close();
    } catch {
      /* already gone */
    }
    this.socket = null;
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
