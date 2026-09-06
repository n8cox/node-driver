import { useMemo } from 'react';
import { IdentityStrip } from '@/components/IdentityStrip';
import { Roster } from '@/components/Roster';
import { createAdapter } from '@/config/adapter';
import { useEnsemble } from '@/hooks/useEnsemble';

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

  return (
    <div className="app">
      <IdentityStrip identity={identity} loading={loading} onRefresh={() => void refresh()} />

      {error && (
        <div className="error-banner" role="alert">
          {error}
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
