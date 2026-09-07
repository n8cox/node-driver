/**
 * The desktop escape hatch for cross-origin backend calls.
 *
 * In a packaged Electron build the renderer runs at a `file://` origin, so it
 * cannot fetch the local backend: the request is cross-origin, and a JSON POST
 * needs a preflight the Express server never answers. The main process has no
 * such restriction, so it relays. This module presents that relay as an
 * ordinary `fetch`, which keeps the adapter identical in both environments.
 */

export interface DesktopBridgeResponse {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}

export interface DesktopBridge {
  platform: string;
  request?: (options: {
    path: string;
    method?: string;
    body?: string | null;
    token?: string | null;
  }) => Promise<DesktopBridgeResponse>;
  backendUrl?: () => Promise<string>;
}

/** The bridge, or null when running in a plain browser. */
export function getDesktopBridge(): DesktopBridge | null {
  const bridge = (globalThis as { nodeDriverDesktop?: DesktopBridge }).nodeDriverDesktop;
  return bridge && typeof bridge.request === 'function' ? bridge : null;
}

/** True when a relay is available — i.e. this is the desktop app. */
export function hasDesktopBridge(): boolean {
  return getDesktopBridge() !== null;
}

/**
 * A `fetch` that routes through the main process. Only the path is forwarded;
 * the main process owns the backend origin, so the renderer cannot redirect the
 * relay at another host.
 */
export function createBridgeFetch(): typeof fetch {
  const bridge = getDesktopBridge();
  if (!bridge?.request) throw new Error('no desktop bridge available');

  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // Accept a full URL or a bare path; forward only path + query.
    let path = raw;
    try {
      const parsed = new URL(raw, 'http://bridge.invalid');
      path = `${parsed.pathname}${parsed.search}`;
    } catch {
      /* already a path */
    }

    const token =
      init?.headers && 'Authorization' in (init.headers as Record<string, string>)
        ? String((init.headers as Record<string, string>).Authorization).replace(/^Bearer\s+/, '')
        : null;

    const result = await bridge.request!({
      path,
      method: (init?.method ?? 'GET').toUpperCase(),
      body: typeof init?.body === 'string' ? init.body : null,
      token,
    });

    if (!result.ok && result.status === 0) {
      // A transport failure, not an HTTP error — surface it the way fetch does
      // so the adapter's error path stays one path.
      throw new TypeError(result.error ?? 'desktop bridge request failed');
    }

    return new Response(result.body, {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}
