import type { PulseCard, PulseCardInput } from '@/types';

export function createCard(input: PulseCardInput, now = new Date()): PulseCard {
  const title = input.title.trim();
  const note = input.note.trim();
  if (!title) {
    throw new Error('Title is required');
  }
  if (note.length > 120) {
    throw new Error('Note must be 120 characters or fewer');
  }

  return {
    id: crypto.randomUUID(),
    title,
    status: input.status,
    note,
    updatedAt: now.toISOString(),
  };
}

export function updateCard(card: PulseCard, input: PulseCardInput, now = new Date()): PulseCard {
  const title = input.title.trim();
  const note = input.note.trim();
  if (!title) {
    throw new Error('Title is required');
  }
  if (note.length > 120) {
    throw new Error('Note must be 120 characters or fewer');
  }

  return {
    ...card,
    title,
    status: input.status,
    note,
    updatedAt: now.toISOString(),
  };
}

export function sortCards(cards: PulseCard[]): PulseCard[] {
  return [...cards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
