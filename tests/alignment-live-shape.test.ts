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
import {
  extractFacetEntries,
  extractMainDrivers,
  mapBodyState,
  normalizeCorrelations,
  normalizeOutlineLines,
} from '@/adapters/alignmentMapper';
import { searchRows } from '@/outline/tree';

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

describe('malformed lines from the real outline', () => {
  // Captured shapes that exist in the live 2,989-line outline: 3 lines with no
  // text, 7 with no order, 525 with no author. Search crashed the whole view on
  // the first of these until the boundary normalised them.
  const MESSY = [
    { id: 'study-140-fm20-hysteresis', parentId: 'study-140' },
    { id: 'no-author', parentId: null, order: 2, text: 'has text, no author' },
    { id: 'bad-parent', parentId: 42, order: 3, text: 'numeric parent' },
    { id: '', order: 4, text: 'no id at all' },
    null,
    'not an object',
  ];

  it('fills the gaps rather than dropping usable lines', () => {
    const lines = normalizeOutlineLines(MESSY);
    expect(lines.map((l) => l.id)).toEqual([
      'study-140-fm20-hysteresis',
      'no-author',
      'bad-parent',
    ]);
    expect(lines[0].text).toBe('');
    expect(lines[0].author).toBe('unknown');
    expect(Number.isFinite(lines[0].order)).toBe(true);
    expect(lines[2].parentId).toBeNull(); // a non-string parent is no parent
  });

  it('search survives a line with no text', () => {
    const lines = normalizeOutlineLines(MESSY);
    expect(() => searchRows(lines, 'text')).not.toThrow();
    expect([...searchRows(lines, 'has text').matched]).toEqual(['no-author']);
  });

  it('keeps only correlations naming both ends', () => {
    expect(
      normalizeCorrelations([
        { id: 'c1', from: 'a', to: 'b' },
        { id: 'c2', from: 'a' },
        null,
      ]).map((c) => c.id),
    ).toEqual(['c1']);
  });

  it('getOutline normalises what the adapter returns', async () => {
    const adapter = new HttpAdapter({
      baseUrl: '',
      fetch: stubFetch({ rev: 7, lines: MESSY, correlations: 'nope' }),
    });
    const snapshot = await adapter.getOutline();
    expect(snapshot.rev).toBe(7);
    expect(snapshot.lines).toHaveLength(3);
    expect(snapshot.correlations).toEqual([]);
    expect(snapshot.lines.every((l) => typeof l.text === 'string')).toBe(true);
  });
});
