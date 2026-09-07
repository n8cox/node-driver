import { describe, expect, it } from 'vitest';
import { createCard, formatUpdatedAt, sortCards, updateCard } from '@/lib/cards';
import type { PulseCard } from '@/types';

describe('createCard', () => {
  it('creates a card with trimmed fields and ISO timestamp', () => {
    const now = new Date('2026-09-07T12:00:00.000Z');
    const card = createCard(
      { title: '  API  ', status: 'green', note: '  all good  ' },
      now,
    );

    expect(card.title).toBe('API');
    expect(card.note).toBe('all good');
    expect(card.status).toBe('green');
    expect(card.updatedAt).toBe('2026-09-07T12:00:00.000Z');
    expect(card.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('rejects empty title', () => {
    expect(() => createCard({ title: '   ', status: 'amber', note: '' })).toThrow(
      /Title is required/,
    );
  });

  it('rejects note longer than 120 characters', () => {
    expect(() =>
      createCard({ title: 'X', status: 'red', note: 'a'.repeat(121) }),
    ).toThrow(/120 characters/);
  });
});

describe('updateCard', () => {
  const base: PulseCard = {
    id: 'abc',
    title: 'Old',
    status: 'green',
    note: 'old note',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('updates fields and preserves id', () => {
    const now = new Date('2026-09-07T13:00:00.000Z');
    const updated = updateCard(base, { title: 'New', status: 'red', note: 'fail' }, now);

    expect(updated.id).toBe('abc');
    expect(updated.title).toBe('New');
    expect(updated.status).toBe('red');
    expect(updated.note).toBe('fail');
    expect(updated.updatedAt).toBe('2026-09-07T13:00:00.000Z');
  });
});

describe('sortCards', () => {
  it('sorts by updatedAt descending', () => {
    const cards: PulseCard[] = [
      { id: '1', title: 'A', status: 'green', note: '', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: '2', title: 'B', status: 'green', note: '', updatedAt: '2026-06-01T00:00:00.000Z' },
    ];
    const sorted = sortCards(cards);
    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('1');
  });
});

describe('formatUpdatedAt', () => {
  it('returns a non-empty string for valid ISO input', () => {
    const formatted = formatUpdatedAt('2026-09-07T12:00:00.000Z');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
