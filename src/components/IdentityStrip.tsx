import { getAdapterKind } from '@/config/adapter';
import type { EnsembleIdentity } from '@/types/ensemble';

interface IdentityStripProps {
  identity: EnsembleIdentity | null;
  loading: boolean;
  drivingCount?: number;
  onRefresh: () => void;
}

export function IdentityStrip({
  identity,
  loading,
  drivingCount = 0,
  onRefresh,
}: IdentityStripProps) {
  const adapterKind = getAdapterKind();

  return (
    <header className="identity-strip">
      <div className="identity-main">
        <span className="product-label">Node Driver</span>
        {loading && !identity ? (
          <span className="identity-name muted">loading ensemble…</span>
        ) : identity ? (
          <>
            <span className="identity-name">{identity.name}</span>
            {identity.description && (
              <span className="identity-desc">{identity.description}</span>
            )}
            {drivingCount > 0 && (
              <span className="identity-driving-pill" title="Main drivers currently driving">
                {drivingCount} driving
              </span>
            )}
          </>
        ) : (
          <span className="identity-name muted">no ensemble loaded</span>
        )}
      </div>

      <div className="identity-actions">
        <span className="adapter-badge" title="Active data adapter">
          {adapterKind} adapter
        </span>
        <button
          type="button"
          className="refresh-btn"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh roster (R or F5)"
          aria-keyshortcuts="R F5"
        >
          refresh
        </button>
      </div>
    </header>
  );
}
