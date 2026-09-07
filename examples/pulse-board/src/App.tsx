import { useState } from 'react';
import { Board } from '@/components/Board';
import { IdentityStrip } from '@/components/IdentityStrip';
import { useCards } from '@/hooks/useCards';
import type { PulseCard, PulseCardInput } from '@/types';

export function App() {
  const { cards, addCard, editCard, removeCard, resetBoard } = useCards();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = (input: PulseCardInput) => {
    addCard(input);
  };

  const handleEdit = (id: string, input: PulseCardInput) => {
    editCard(id, input);
    setEditingId(null);
  };

  const handleStartEdit = (card: PulseCard) => {
    setEditingId(card.id);
  };

  return (
    <div className="app">
      <IdentityStrip cardCount={cards.length} onClear={resetBoard} />

      <main className="main">
        <Board
          cards={cards}
          editingId={editingId}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onStartEdit={handleStartEdit}
          onCancelEdit={() => setEditingId(null)}
          onRemove={removeCard}
        />
      </main>

      <footer className="footer">
        <span>Pulse Board — Node Driver build lab</span>
        <span className="footer-sep">·</span>
        <span>0→ship reference exercise</span>
      </footer>
    </div>
  );
}
