import type { PulseCard } from '@/types';
import { STORAGE_KEY } from '@/types';

export function loadCards(storage: Storage = localStorage): PulseCard[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidCard);
  } catch {
    return [];
  }
}

export function saveCards(cards: PulseCard[], storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function clearCards(storage: Storage = localStorage): void {
  storage.removeItem(STORAGE_KEY);
}

function isValidCard(value: unknown): value is PulseCard {
  if (!value || typeof value !== 'object') return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.id === 'string' &&
    typeof card.title === 'string' &&
    (card.status === 'green' || card.status === 'amber' || card.status === 'red') &&
    typeof card.note === 'string' &&
    typeof card.updatedAt === 'string'
  );
}
