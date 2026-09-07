import { formatUpdatedAt } from '@/lib/cards';
import type { PulseCard } from '@/types';
import { STATUS_LABELS } from '@/types';

interface StatusCardProps {
  card: PulseCard;
  onEdit: (card: PulseCard) => void;
  onRemove: (id: string) => void;
}

export function StatusCard({ card, onEdit, onRemove }: StatusCardProps) {
  return (
    <article className={`status-card status-${card.status}`} data-testid="status-card">
      <div className="status-card-top">
        <span className={`status-dot status-dot-${card.status}`} aria-hidden="true" />
        <h3 className="status-title">{card.title}</h3>
        <span className={`status-badge status-badge-${card.status}`}>
          {STATUS_LABELS[card.status]}
        </span>
      </div>

      <p className="status-note">{card.note || '—'}</p>

      <div className="status-meta">
        <time dateTime={card.updatedAt}>{formatUpdatedAt(card.updatedAt)}</time>
        <div className="status-actions">
          <button type="button" className="btn btn-ghost" onClick={() => onEdit(card)}>
            Edit
          </button>
          <button type="button" className="btn btn-ghost btn-danger" onClick={() => onRemove(card.id)}>
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}
