import type { EnsembleAdapter } from '@/adapters/EnsembleAdapter';
import { HttpAdapter } from '@/adapters/HttpAdapter';
import { SampleAdapter } from '@/adapters/SampleAdapter';
import type { AdapterKind } from '@/types/ensemble';

function resolveKind(): AdapterKind {
  const raw = import.meta.env.VITE_ADAPTER ?? 'sample';
  return raw === 'http' ? 'http' : 'sample';
}

/** Factory — selects adapter from VITE_ADAPTER env (default: sample). */
export function createAdapter(): EnsembleAdapter {
  const kind = resolveKind();

  if (kind === 'http') {
    const baseUrl = import.meta.env.VITE_HTTP_BASE_URL ?? 'http://localhost:8787';
    const token = import.meta.env.VITE_HTTP_TOKEN;
    return new HttpAdapter({ baseUrl, token });
  }

  return new SampleAdapter();
}

export function getAdapterKind(): AdapterKind {
  return resolveKind();
}
