/**
 * Regression tests for the SHAPES the live Alignment server actually sends.
 *
 * The fixtures below are verbatim captures from `http://127.0.0.1:3001` on
 * 2026-09-07. The original wiring was tested only against hand-written mocks
 * that assumed a bare array and a `children` key; the live API sends a
 * `{ drivers: [...] }` envelope and a `{ subNodes: [...] }` facet, so the
 * roster rendered empty and every expand returned nothing.
 *
 * These run offline. The optional live section at the bottom skips when no
 * server is listening, so OSS CI stays green.
 */
import { describe, expect, it } from 'vitest';
import { HttpAdapter } from '@/adapters/HttpAdapter';
import { extractFacetEntries, extractMainDrivers, mapBodyState } from '@/adapters/alignmentMapper';

/** Verbatim capture: GET /api/ensemble/main-drivers */
const LIVE_ROSTER = {
  ts: 1788788874866,
  primaryId: 'hemisphere-claude',
  drivers: [
    {
      id: 'hemisphere-claude',
      name: 'Opus 5',
      roleKind: 'hemisphere',
      state: 'driving',
      engagement: null,
      driving: true,
      activity: 'operating claude-opus-5',
      sources: ['docs/model-totem.json', 'docs/.usage-state.json'],
    },
    {
      id: 'hemisphere-cursor',
      name: 'Cursor · grok-4.5',
      roleKind: 'hemisphere',
      state: 'stale',
      engagement: 0,
      driving: false,
      activity: 'wake FULL · limb ok · slot cursor-grok-4-5',
      sources: ['docs/cursor-bindings.json'],
    },
    {
      id: 'human-nathan',
      name: 'Nathan',
      roleKind: 'human',
      state: 'idle',
      engagement: null,
      driving: false,
      activity: 'away — driver presence stale',
      sources: ['docs/.driver-presence.json'],
    },
    {
      id: 'bot-grok-bot',
      name: 'Grok Bot',
      roleKind: 'bot',
      state: 'stale',
      engagement: null,
      driving: false,
      activity: 'grok-bot seat stale — re-run wake:cursor',
      sources: ['docs/.operating-seat-cursor.json'],
    },
  ],
} as const;

/** Verbatim capture: GET /api/ensemble/main-drivers/bot-grok-bot/facet */
const LIVE_FACET = {
  ok: true,
  driverId: 'bot-grok-bot',
  name: 'Grok Bot',
  subNodes: [
    { id: 'mode', label: 'mode', detail: 'grok-bot chat surface', source: 'docs/.operating-seat-cursor.json' },
    { id: 'limb', label: 'limb', detail: 'SDK parked — chat is animator', source: 'docs/.operating-seat-cursor.json' },
    { id: 'setBy', label: 'setBy', detail: 'grok-bot', source: 'docs/.operating-seat-cursor.json' },
  ],
  ts: 1788789111547,
} as const;

function stubFetch(body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('live Alignment payload shapes', () => {
  it('unwraps the { drivers } roster envelope', () => {
    expect(extractMainDrivers(LIVE_ROSTER as never)).toHaveLength(4);
  });

  it('still accepts a bare roster array', () => {
    expect(extractMainDrivers(LIVE_ROSTER.drivers as never)).toHaveLength(4);
  });

  it('unwraps the { subNodes } facet envelope', () => {
    expect(extractFacetEntries(LIVE_FACET as never)).toHaveLength(3);
  });

  it('still accepts a { children } facet envelope', () => {
    expect(extractFacetEntries({ children: [...LIVE_FACET.subNodes] } as never)).toHaveLength(3);
  });

  it('drops null engagement instead of rendering the string "null"', () => {
    expect(mapBodyState({ state: 'driving', engagement: null, activity: 'x' }).engagement).toBeUndefined();
  });

  it('keeps a numeric zero engagement', () => {
    expect(mapBodyState({ state: 'stale', engagement: 0, activity: 'x' }).engagement).toBe('0');
  });

  it('getMainDrivers renders the real roster, human first', async () => {
    const adapter = new HttpAdapter({ baseUrl: 'http://127.0.0.1:3001', fetch: stubFetch(LIVE_ROSTER) });
    const drivers = await adapter.getMainDrivers();
    expect(drivers).toHaveLength(4);
    expect(drivers[0].role).toBe('human');
    expect(drivers.every((d) => d.bodyState.engagement !== 'null')).toBe(true);
  });

  it('expandNode returns the real facet children', async () => {
    const adapter = new HttpAdapter({ baseUrl: 'http://127.0.0.1:3001', fetch: stubFetch(LIVE_FACET) });
    const kids = await adapter.expandNode('bot-grok-bot');
    expect(kids).toHaveLength(3);
    expect(kids[0].name).toBe('mode');
  });
});
