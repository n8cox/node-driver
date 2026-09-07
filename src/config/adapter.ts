import type { EnsembleAdapter } from '@/adapters/EnsembleAdapter';
import { HttpAdapter } from '@/adapters/HttpAdapter';
import { SampleAdapter } from '@/adapters/SampleAdapter';
import { createBridgeFetch, getDesktopBridge, hasDesktopBridge } from '@/lib/desktopBridge';
import type { AdapterKind } from '@/types/ensemble';

/** localStorage keys for runtime adapter override (Electron / baked builds). */
export const RUNTIME_ADAPTER_KEY = 'node-driver:adapter';
export const RUNTIME_HTTP_BASE_URL_KEY = 'node-driver:http-base-url';
export const RUNTIME_HTTP_TOKEN_KEY = 'node-driver:http-token';

const DEFAULT_HTTP_BASE_URL = 'http://127.0.0.1:3001';

/** How long to wait for a backend to answer before falling back to demo data. */
const PROBE_TIMEOUT_MS = 1500;

interface RuntimeOverride {
  kind?: AdapterKind;
  baseUrl?: string;
  token?: string;
}

/** Where the roster and outline are coming from, for the identity strip. */
export interface AdapterSelection {
  adapter: EnsembleAdapter;
  kind: AdapterKind;
  /** Short human-readable source, e.g. "live · 127.0.0.1:3001" or "demo data". */
  label: string;
  /** Set when a live backend was wanted but not reachable. */
  fellBack: boolean;
}

function readRuntimeOverride(): RuntimeOverride {
  if (typeof localStorage === 'undefined') return {};
  try {
    const kind = localStorage.getItem(RUNTIME_ADAPTER_KEY);
    return {
      kind: kind === 'http' || kind === 'sample' ? kind : undefined,
      baseUrl: localStorage.getItem(RUNTIME_HTTP_BASE_URL_KEY) ?? undefined,
      token: localStorage.getItem(RUNTIME_HTTP_TOKEN_KEY) ?? undefined,
    };
  } catch {
    return {};
  }
}

function envKind(): AdapterKind | 'auto' {
  const raw = import.meta.env.VITE_ADAPTER;
  if (raw === 'http') return 'http';
  if (raw === 'sample') return 'sample';
  return 'auto';
}

function resolveHttpBaseUrl(runtime: RuntimeOverride): string {
  // In the desktop app the main process owns the origin, so the renderer uses
  // bare paths and the bridge supplies the host.
  if (hasDesktopBridge()) return '';
  const configured = runtime.baseUrl ?? import.meta.env.VITE_HTTP_BASE_URL;
  return configured ?? DEFAULT_HTTP_BASE_URL;
}

function resolveHttpToken(runtime: RuntimeOverride): string | undefined {
  return runtime.token ?? import.meta.env.VITE_HTTP_TOKEN;
}

/**
 * The origin of the live WebSocket.
 *
 * Under the dev server the page origin is Vite, whose own HMR socket will happily
 * accept a connection and never deliver an outline event — so the backend origin
 * is named explicitly. WebSockets are not blocked by CORS, so this connects
 * directly even though HTTP has to be proxied.
 */
function resolveSocketUrl(runtime: RuntimeOverride, backendOrigin?: string): string | undefined {
  const explicit = backendOrigin ?? '';
  const base = runtime.baseUrl ?? import.meta.env.VITE_HTTP_BASE_URL ?? '';
  const proxied = import.meta.env.VITE_HTTP_PROXY_TARGET ?? '';
  const origin = [explicit, base, proxied].find((o) => /^https?:/.test(o));
  return origin ? origin.replace(/^http/, 'ws') : undefined;
}

function makeHttpAdapter(runtime: RuntimeOverride, backendOrigin?: string): HttpAdapter {
  const socketUrl = resolveSocketUrl(runtime, backendOrigin);
  return new HttpAdapter({
    baseUrl: resolveHttpBaseUrl(runtime),
    token: resolveHttpToken(runtime),
    ...(socketUrl ? { socketUrl } : {}),
    ...(hasDesktopBridge() ? { fetch: createBridgeFetch() } : {}),
  });
}

/** The desktop main process owns the backend origin; ask it. */
async function desktopBackendOrigin(): Promise<string | undefined> {
  const bridge = getDesktopBridge();
  if (!bridge?.backendUrl) return undefined;
  try {
    return (await bridge.backendUrl()) || undefined;
  } catch {
    return undefined;
  }
}

function sourceLabel(runtime: RuntimeOverride): string {
  if (hasDesktopBridge()) return 'live · desktop bridge';
  const base = resolveHttpBaseUrl(runtime);
  if (!base) return 'live · same origin';
  try {
    return `live · ${new URL(base).host}`;
  } catch {
    return `live · ${base}`;
  }
}

/** Synchronous factory — honours explicit config only. Kept for existing callers. */
export function createAdapter(): EnsembleAdapter {
  const runtime = readRuntimeOverride();
  const kind = runtime.kind ?? (envKind() === 'http' ? 'http' : 'sample');
  return kind === 'http' ? makeHttpAdapter(runtime) : new SampleAdapter();
}

/**
 * Pick an adapter, PROVING the choice rather than assuming it.
 *
 * An explicit setting is always honoured. With no setting the app probes for a
 * live backend and uses it when one answers, otherwise it falls back to demo
 * data and says so — so the desktop app opens onto real work when Alignment is
 * running, and still opens onto something usable when it is not.
 */
export async function resolveAdapter(): Promise<AdapterSelection> {
  const runtime = readRuntimeOverride();
  const explicit = runtime.kind ?? (envKind() === 'auto' ? undefined : (envKind() as AdapterKind));

  if (explicit === 'sample') {
    return { adapter: new SampleAdapter(), kind: 'sample', label: 'demo data', fellBack: false };
  }

  const backendOrigin = await desktopBackendOrigin();
  const adapter = makeHttpAdapter(runtime, backendOrigin);
  const reachable = await probe(adapter);

  if (reachable) {
    return { adapter, kind: 'http', label: sourceLabel(runtime), fellBack: false };
  }

  if (explicit === 'http') {
    // Asked for live explicitly: do NOT silently swap in demo data — the error
    // surface should say the backend is unreachable.
    return { adapter, kind: 'http', label: sourceLabel(runtime), fellBack: false };
  }

  return { adapter: new SampleAdapter(), kind: 'sample', label: 'demo data', fellBack: true };
}

async function probe(adapter: EnsembleAdapter): Promise<boolean> {
  try {
    await withTimeout(adapter.getMainDrivers(), PROBE_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('probe timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

export function getAdapterKind(): AdapterKind {
  const runtime = readRuntimeOverride();
  return runtime.kind ?? (envKind() === 'http' ? 'http' : 'sample');
}
