import type { PulseCardInput, PulseStatus } from '@/types';
import { STATUS_LABELS } from '@/types';

interface CardFormProps {
  initial?: PulseCardInput;
  submitLabel: string;
  submitTestId?: string;
  onSubmit: (input: PulseCardInput) => void;
  onCancel?: () => void;
}

const EMPTY: PulseCardInput = { title: '', status: 'green', note: '' };

export function CardForm({ initial = EMPTY, submitLabel, submitTestId, onSubmit, onCancel }: CardFormProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get('title') ?? '');
    const status = String(data.get('status') ?? 'green') as PulseStatus;
    const note = String(data.get('note') ?? '');

    if (status !== 'green' && status !== 'amber' && status !== 'red') return;

    try {
      onSubmit({ title, status, note });
      if (!initial.title) form.reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid input';
      window.alert(message);
    }
  };

  return (
    <form className="card-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label className="form-label" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          className="form-input"
          defaultValue={initial.title}
          placeholder="Service name"
          required
          maxLength={80}
          autoComplete="off"
        />
      </div>

      <div className="form-row form-row-inline">
        <label className="form-label" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          name="status"
          className="form-select"
          defaultValue={initial.status}
        >
          {(Object.keys(STATUS_LABELS) as PulseStatus[]).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label className="form-label" htmlFor="note">
          Note
        </label>
        <input
          id="note"
          name="note"
          className="form-input"
          defaultValue={initial.note}
          placeholder="One-line status note"
          maxLength={120}
          autoComplete="off"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" data-testid={submitTestId}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
