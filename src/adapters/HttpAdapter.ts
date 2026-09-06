import type { EnsembleAdapter } from '@/adapters/EnsembleAdapter';
import type { DriverNode, EnsembleIdentity } from '@/types/ensemble';

export interface HttpAdapterOptions {
  /** Base URL of the ensemble HTTP API, e.g. https://localhost:8787 */
  baseUrl: string;
  /** Optional bearer token — not required for stub usage. */
  token?: string;
}

/**
 * HTTP adapter stub — defines the remote contract without requiring a live backend.
 *
 * Expected endpoints (not implemented here):
 *   GET  {baseUrl}/ensemble/identity
 *   GET  {baseUrl}/ensemble/drivers
 *   GET  {baseUrl}/ensemble/drivers/:id/children
 */
export class HttpAdapter implements EnsembleAdapter {
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor(options: HttpAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
  }

  async getIdentity(): Promise<EnsembleIdentity> {
    return this.notImplemented('getIdentity', `${this.baseUrl}/ensemble/identity`);
  }

  async getMainDrivers(): Promise<DriverNode[]> {
    return this.notImplemented('getMainDrivers', `${this.baseUrl}/ensemble/drivers`);
  }

  async expandNode(nodeId: string): Promise<DriverNode[]> {
    return this.notImplemented(
      'expandNode',
      `${this.baseUrl}/ensemble/drivers/${encodeURIComponent(nodeId)}/children`,
    );
  }

  private async notImplemented<T>(method: string, url: string): Promise<T> {
    const authNote = this.token ? ' Bearer token is configured.' : '';
    throw new HttpAdapterNotConfiguredError(
      `HttpAdapter.${method} is a stub — no backend at ${url}.${authNote} ` +
        'Use VITE_ADAPTER=sample or implement the HTTP endpoints.',
    );
  }
}

export class HttpAdapterNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HttpAdapterNotConfiguredError';
  }
}
