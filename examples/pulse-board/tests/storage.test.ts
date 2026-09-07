import { beforeEach, describe, expect, it } from 'vitest';
import { createCard } from '@/lib/cards';
import { clearCards, loadCards, saveCards } from '@/lib/storage';
import { STORAGE_KEY } from '@/types';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('storage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('returns empty array when nothing stored', () => {
    expect(loadCards(storage)).toEqual([]);
  });

  it('round-trips valid cards', () => {
    const card = createCard({ title: 'Worker', status: 'amber', note: 'slow' });
    saveCards([card], storage);
    const loaded = loadCards(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe('Worker');
    expect(loaded[0].status).toBe('amber');
  });

  it('filters invalid stored entries', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: '1', title: 'OK', status: 'green', note: '', updatedAt: '2026-01-01T00:00:00.000Z' },
        { id: '2', title: 'bad' },
      ]),
    );
    expect(loadCards(storage)).toHaveLength(1);
  });

  it('returns empty array for corrupt JSON', () => {
    storage.setItem(STORAGE_KEY, '{not json');
    expect(loadCards(storage)).toEqual([]);
  });

  it('clearCards removes the key', () => {
    saveCards([createCard({ title: 'X', status: 'green', note: '' })], storage);
    clearCards(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});
