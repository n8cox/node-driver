import type { EnsembleAdapter } from '@/adapters/EnsembleAdapter';
import { HttpAdapter } from '@/adapters/HttpAdapter';
import { SampleAdapter } from '@/adapters/SampleAdapter';
import type { AdapterKind } from '@/types/ensemble';

/** localStorage keys for runtime adapter override (Electron / baked builds). */
export const RUNTIME_ADAPTER_KEY = 'node-driver:adapter';
export const RUNTIME_HTTP_BASE_URL_KEY = 'node-driver:http-base-url';
export const RUNTIME_HTTP_TOKEN_KEY = 'node-driver:http-token';

const DEFAULT_HTTP_BASE_URL = 'http://127.0.0.1:3001';

interface RuntimeOverride {
  kind?: AdapterKind;
  baseUrl?: string;
  token?: string;
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

function resolveKind(runtime: RuntimeOverride): AdapterKind {
  if (runtime.kind) return runtime.kind;
  const raw = import.meta.env.VITE_ADAPTER ?? 'sample';
  return raw === 'http' ? 'http' : 'sample';
}

function resolveHttpBaseUrl(runtime: RuntimeOverride): string {
  return (
    runtime.baseUrl ??
    import.meta.env.VITE_HTTP_BASE_URL ??
    DEFAULT_HTTP_BASE_URL
  );
}

function resolveHttpToken(runtime: RuntimeOverride): string | undefined {
  return runtime.token ?? import.meta.env.VITE_HTTP_TOKEN;
}

/** Factory — selects adapter from env (default: sample) with optional localStorage override. */
export function createAdapter(): EnsembleAdapter {
  const runtime = readRuntimeOverride();
  const kind = resolveKind(runtime);

  if (kind === 'http') {
    return new HttpAdapter({
      baseUrl: resolveHttpBaseUrl(runtime),
      token: resolveHttpToken(runtime),
    });
  }

  return new SampleAdapter();
}

export function getAdapterKind(): AdapterKind {
  return resolveKind(readRuntimeOverride());
}
