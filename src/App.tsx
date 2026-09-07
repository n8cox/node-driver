import { useMemo } from 'react';
import { IdentityStrip } from '@/components/IdentityStrip';
import { Roster } from '@/components/Roster';
import { createAdapter } from '@/config/adapter';
import { useEnsemble } from '@/hooks/useEnsemble';
import { useKeyboardRefresh } from '@/hooks/useKeyboardRefresh';
import { countMainDriving } from '@/lib/rosterSummary';

export function App() {
  const adapter = useMemo(() => createAdapter(), []);
  const {
    identity,
    drivers,
    loading,
    error,
    expandedIds,
    expandingIds,
    toggleExpand,
    refresh,
  } = useEnsemble(adapter);

  const drivingCount = useMemo(() => countMainDriving(drivers), [drivers]);

  useKeyboardRefresh(() => void refresh(), !loading);

  return (
    <div className="app">
      <IdentityStrip
        identity={identity}
        loading={loading}
        drivingCount={drivingCount}
        onRefresh={() => void refresh()}
      />

      {error && (
        <div className="error-banner" role="alert">
          <span className="error-banner-text">{error}</span>
          <button
            type="button"
            className="error-retry-btn"
            onClick={() => void refresh()}
            disabled={loading}
          >
            retry
          </button>
        </div>
      )}

      <main className="main">
        <Roster
          drivers={drivers}
          loading={loading}
          expandedIds={expandedIds}
          expandingIds={expandingIds}
          onToggleExpand={(id, has) => void toggleExpand(id, has)}
        />
      </main>

      <footer className="footer">
        <span>Machine Intelligence Ensembles — Node Driver v0.1</span>
        <span className="footer-sep">·</span>
        <span>Shared H seam documented in ARCHITECTURE.md</span>
      </footer>
    </div>
  );
}
