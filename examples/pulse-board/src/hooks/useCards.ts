import { useCallback, useEffect, useState } from 'react';
import { createCard, sortCards, updateCard } from '@/lib/cards';
import { clearCards, loadCards, saveCards } from '@/lib/storage';
import type { PulseCard, PulseCardInput } from '@/types';

export function useCards() {
  const [cards, setCards] = useState<PulseCard[]>(() => sortCards(loadCards()));

  useEffect(() => {
    if (cards.length === 0) {
      clearCards();
    } else {
      saveCards(cards);
    }
  }, [cards]);

  const addCard = useCallback((input: PulseCardInput) => {
    const next = createCard(input);
    setCards((prev) => sortCards([next, ...prev]));
    return next;
  }, []);

  const editCard = useCallback((id: string, input: PulseCardInput) => {
    setCards((prev) => {
      const index = prev.findIndex((card) => card.id === id);
      if (index === -1) return prev;
      const updated = updateCard(prev[index], input);
      const next = [...prev];
      next[index] = updated;
      return sortCards(next);
    });
  }, []);

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((card) => card.id !== id));
  }, []);

  const resetBoard = useCallback(() => {
    clearCards();
    setCards([]);
  }, []);

  return { cards, addCard, editCard, removeCard, resetBoard };
}
