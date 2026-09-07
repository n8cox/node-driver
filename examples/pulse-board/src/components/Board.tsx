import { CardForm } from '@/components/CardForm';
import { StatusCard } from '@/components/StatusCard';
import type { PulseCard, PulseCardInput } from '@/types';

interface BoardProps {
  cards: PulseCard[];
  editingId: string | null;
  onAdd: (input: PulseCardInput) => void;
  onEdit: (id: string, input: PulseCardInput) => void;
  onStartEdit: (card: PulseCard) => void;
  onCancelEdit: () => void;
  onRemove: (id: string) => void;
}

export function Board({
  cards,
  editingId,
  onAdd,
  onEdit,
  onStartEdit,
  onCancelEdit,
  onRemove,
}: BoardProps) {
  const editingCard = editingId ? cards.find((card) => card.id === editingId) : undefined;

  return (
    <section className="board">
      <header className="board-header">
        <h2>Cards</h2>
        <span className="board-meta">{cards.length} active</span>
      </header>

      <div className="board-grid">
        {cards.map((card) =>
          editingId === card.id && editingCard ? (
            <div key={card.id} className="board-edit-panel">
              <CardForm
                initial={{
                  title: editingCard.title,
                  status: editingCard.status,
                  note: editingCard.note,
                }}
                submitLabel="Save"
                onSubmit={(input) => onEdit(card.id, input)}
                onCancel={onCancelEdit}
              />
            </div>
          ) : (
            <StatusCard key={card.id} card={card} onEdit={onStartEdit} onRemove={onRemove} />
          ),
        )}

        {!editingId && (
          <div className="board-add-panel" data-testid="add-card-panel">
            <CardForm submitLabel="Add card" onSubmit={onAdd} submitTestId="add-card-submit" />
          </div>
        )}
      </div>

      {cards.length === 0 && !editingId && (
        <p className="board-empty">No cards yet — add one above.</p>
      )}
    </section>
  );
}
