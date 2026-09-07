import { describe, expect, it, vi } from 'vitest';
import {
  ALIGNMENT_LOCAL_IDENTITY,
  extractFacetEntries,
  inventPurpose,
  mapBodyState,
  mapFacetEntries,
  mapMainDriver,
  mapMainDrivers,
  mapRoleKind,
  sortDriversByRole,
  type AlignmentFacetEntry,
  type AlignmentMainDriver,
} from '@/adapters/alignmentMapper';
import { HttpAdapter, HttpAdapterError } from '@/adapters/HttpAdapter';
import type { DriverNode } from '@/types/ensemble';

const SAMPLE_MAIN_DRIVERS: AlignmentMainDriver[] = [
  {
    id: 'motor-bot',
    name: 'n8n Bot',
    roleKind: 'bot',
    state: 'running',
    driving: false,
    activity: 'Polling ingest queue',
  },
  {
    id: 'human-01',
    name: 'Nathan',
    roleKind: 'human',
    state: 'present',
    engagement: 'focused',
    driving: true,
    activity: 'Reviewing synthesis draft',
  },
  {
    id: 'hem-claude',
    name: 'Claude',
    roleKind: 'hemisphere',
    state: 'active',
    engagement: 'deep',
    driving: false,
    activity: 'Drafting architecture matrix',
  },
  {
    id: 'conn-ollama',
    name: 'Ollama',
    roleKind: 'connection',
    state: 'connected',
    driving: false,
    activity: 'Idle — model loaded',
  },
];

const SAMPLE_FACET: AlignmentFacetEntry[] = [
  {
    id: 'facet-1',
    label: 'Context ingest',
    detail: '12 documents indexed',
    source: 'complete',
  },
  {
    id: 'facet-2',
    label: 'Matrix draft',
    detail: 'Row 4 of 7 — latency tradeoffs',
    source: 'in progress',
  },
];

describe('alignmentMapper', () => {
  it('maps bot roleKind to motor', () => {
    expect(mapRoleKind('bot')).toBe('motor');
    expect(mapRoleKind('human')).toBe('human');
    expect(mapRoleKind('hemisphere')).toBe('hemisphere');
    expect(mapRoleKind('connection')).toBe('connection');
  });

  it('maps flat state fields to bodyState', () => {
    const body = mapBodyState({
      state: 'active',
      engagement: 'deep',
      driving: true,
      activity: 'Working on task',
    });
    expect(body).toEqual({
      state: 'active',
      engagement: 'deep',
      driving: true,
      activityLine: 'Working on task',
    });
  });

  it('omits empty engagement from bodyState', () => {
    const body = mapBodyState({ state: 'idle', engagement: '', activity: 'none' });
    expect(body.engagement).toBeUndefined();
    expect(body.activityLine).toBe('none');
  });

  it('invents purpose from role and activity', () => {
    expect(inventPurpose('human', 'Reviewing draft')).toContain('Reviewing draft');
    expect(inventPurpose('motor', undefined, 'Cron Bot')).toContain('Cron Bot');
  });

  it('maps a main driver with hasChildren true', () => {
    const node = mapMainDriver(SAMPLE_MAIN_DRIVERS[0]);
    expect(node.role).toBe('motor');
    expect(node.hasChildren).toBe(true);
    expect(node.children).toBeUndefined();
    expect(node.bodyState.activityLine).toBe('Polling ingest queue');
  });

  it('orders main drivers human → hemisphere → connection → motor', () => {
    const drivers = mapMainDrivers(SAMPLE_MAIN_DRIVERS);
    expect(drivers.map((d) => d.role)).toEqual([
      'human',
      'hemisphere',
      'connection',
      'motor',
    ]);
  });

  it('sortDriversByRole reorders an arbitrary list', () => {
    const shuffled: DriverNode[] = [
      { id: 'm', name: 'M', purpose: 'p', role: 'motor', bodyState: { state: 'x', activityLine: '' } },
      { id: 'h', name: 'H', purpose: 'p', role: 'human', bodyState: { state: 'x', activityLine: '' } },
    ];
    expect(sortDriversByRole(shuffled).map((d) => d.role)).toEqual(['human', 'motor']);
  });

  it('maps facet entries to child DriverNodes inheriting parent role', () => {
    const children = mapFacetEntries(SAMPLE_FACET, 'hemisphere');
    expect(children).toHaveLength(2);
    expect(children[0].name).toBe('Context ingest');
    expect(children[0].role).toBe('hemisphere');
    expect(children[0].bodyState.activityLine).toBe('12 documents indexed');
    expect(children[0].bodyState.state).toBe('complete');
  });

  it('extractFacetEntries handles array and wrapped children', () => {
    expect(extractFacetEntries(SAMPLE_FACET)).toEqual(SAMPLE_FACET);
    expect(extractFacetEntries({ children: SAMPLE_FACET })).toEqual(SAMPLE_FACET);
    expect(extractFacetEntries(null)).toEqual([]);
  });

  it('exports static Alignment local identity', () => {
    expect(ALIGNMENT_LOCAL_IDENTITY.id).toBe('alignment-local');
    expect(ALIGNMENT_LOCAL_IDENTITY.name).toBe('Rayla');
  });
});

describe('HttpAdapter', () => {
  const baseUrl = 'http://127.0.0.1:3001';

  function resolvePath(url: string | URL | Request): string {
    if (typeof url === 'string') return new URL(url).pathname;
    if (url instanceof URL) return url.pathname;
    return new URL(url.url).pathname;
  }

  function mockFetch(handlers: Record<string, unknown>): typeof fetch {
    return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = resolvePath(url);
      const handler = handlers[path];
      if (handler instanceof Error) throw handler;
      if (handler === undefined) {
        return new Response('not found', { status: 404 });
      }
      const headers = init?.headers as Record<string, string> | undefined;
      if (headers?.Authorization) {
        expect(headers.Authorization).toBe('Bearer test-token');
      }
      return new Response(JSON.stringify(handler), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
  }

  it('returns static identity', async () => {
    const adapter = new HttpAdapter({ baseUrl, fetch: mockFetch({}) });
    const identity = await adapter.getIdentity();
    expect(identity).toEqual(ALIGNMENT_LOCAL_IDENTITY);
  });

  it('fetches and maps main drivers from Alignment path', async () => {
    const fetch = mockFetch({
      '/api/ensemble/main-drivers': SAMPLE_MAIN_DRIVERS,
    });
    const adapter = new HttpAdapter({ baseUrl, fetch });
    const drivers = await adapter.getMainDrivers();

    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/ensemble/main-drivers`,
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json' }),
      }),
    );
    expect(drivers[0].role).toBe('human');
    expect(drivers.find((d) => d.id === 'motor-bot')?.role).toBe('motor');
    expect(drivers.every((d) => d.hasChildren === true)).toBe(true);
  });

  it('sends Bearer token when configured', async () => {
    const fetch = mockFetch({
      '/api/ensemble/main-drivers': [],
    });
    const adapter = new HttpAdapter({ baseUrl, token: 'test-token', fetch });
    await adapter.getMainDrivers();
    expect(fetch).toHaveBeenCalled();
  });

  it('fetches facet children on expandNode', async () => {
    const fetch = mockFetch({
      '/api/ensemble/main-drivers': SAMPLE_MAIN_DRIVERS,
      '/api/ensemble/main-drivers/hem-claude/facet': SAMPLE_FACET,
    });
    const adapter = new HttpAdapter({ baseUrl, fetch });
    await adapter.getMainDrivers();
    const children = await adapter.expandNode('hem-claude');

    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/ensemble/main-drivers/hem-claude/facet`,
      expect.any(Object),
    );
    expect(children).toHaveLength(2);
    expect(children[0].name).toBe('Context ingest');
  });

  it('URL-encodes node id on expandNode', async () => {
    const fetch = mockFetch({
      '/api/ensemble/main-drivers': [
        {
          id: 'hem/sphere',
          name: 'Test',
          roleKind: 'hemisphere',
          state: 'active',
          activity: 'working',
        },
      ],
      '/api/ensemble/main-drivers/hem%2Fsphere/facet': [],
    });
    const adapter = new HttpAdapter({ baseUrl, fetch });
    await adapter.getMainDrivers();
    const children = await adapter.expandNode('hem/sphere');
    expect(children).toEqual([]);
  });

  it('throws HttpAdapterError on non-OK response', async () => {
    const failingFetch: typeof fetch = vi.fn(async () => new Response('error', { status: 503 }));
    const adapter = new HttpAdapter({ baseUrl, fetch: failingFetch });
    await expect(adapter.getMainDrivers()).rejects.toThrow(HttpAdapterError);
    await expect(adapter.getMainDrivers()).rejects.toThrow(/503/);
  });

  it('deep-clones returned drivers', async () => {
    const fetch = mockFetch({
      '/api/ensemble/main-drivers': SAMPLE_MAIN_DRIVERS,
    });
    const adapter = new HttpAdapter({ baseUrl, fetch });
    const drivers = await adapter.getMainDrivers();
    drivers[0].bodyState.state = 'mutated';
    const fresh = await adapter.getMainDrivers();
    expect(fresh[0].bodyState.state).toBe('present');
  });

  it('strips trailing slash from baseUrl', async () => {
    const fetch = mockFetch({
      '/api/ensemble/main-drivers': [],
    });
    const adapter = new HttpAdapter({ baseUrl: `${baseUrl}/`, fetch });
    await adapter.getMainDrivers();
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/api/ensemble/main-drivers`, expect.any(Object));
  });
});

describe('createAdapter runtime override', () => {
  it('prefers localStorage adapter kind over env default', async () => {
    const { createAdapter, RUNTIME_ADAPTER_KEY } = await import('@/config/adapter');
    localStorage.setItem(RUNTIME_ADAPTER_KEY, 'http');
    const adapter = createAdapter();
    const identity = await adapter.getIdentity();
    expect(identity.id).toBe('alignment-local');
    localStorage.removeItem(RUNTIME_ADAPTER_KEY);
  });
});
