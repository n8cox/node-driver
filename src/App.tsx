import { useMemo, useState } from 'react';
import { IdentityStrip } from '@/components/IdentityStrip';
import { OutlineCanvas } from '@/components/OutlineCanvas';
import { Roster } from '@/components/Roster';
import { createAdapter } from '@/config/adapter';
import { supportsOutline } from '@/adapters/EnsembleAdapter';
import { useEnsemble } from '@/hooks/useEnsemble';
import { useKeyboardRefresh } from '@/hooks/useKeyboardRefresh';
import { useOutline } from '@/hooks/useOutline';
import { countMainDriving } from '@/lib/rosterSummary';

/**
 * Two projections of ONE node space (Nathan's design law, 2026-07-01):
 * the OUTLINE is the node graph linearized to be read and edited; the ROSTER is
 * the same space grouped by who is driving. The outline leads, because the
 * outline is the working surface.
 */
type Projection = 'outline' | 'roster';

export function App() {
  const adapter = useMemo(() => createAdapter(), []);
  const editable = useMemo(() => supportsOutline(adapter), [adapter]);
  const [projection, setProjection] = useState<Projection>(editable ? 'outline' : 'roster');

  const {
    identity,
    drivers,
    loading,
    error,
    expandedIds,
    expandingIds,
    expandErrors,
    toggleExpand,
    refresh,
  } = useEnsemble(adapter);

  const outline = useOutline(adapter);

  const drivingCount = useMemo(() => countMainDriving(drivers), [drivers]);

  useKeyboardRefresh(() => {
    void refresh();
    void outline.refresh();
  }, !loading);

  return (
    <div className="app">
      <IdentityStrip
        identity={identity}
        loading={loading}
        drivingCount={drivingCount}
        onRefresh={() => {
          void refresh();
          void outline.refresh();
        }}
      />

      <nav className="projection-tabs" aria-label="Projection">
        {(['outline', 'roster'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`projection-tab${projection === p ? ' projection-tab-active' : ''}`}
            aria-pressed={projection === p}
            onClick={() => setProjection(p)}
          >
            {p === 'outline' ? 'Outline' : 'Roster'}
          </button>
        ))}
        <span className="projection-hint">
          {projection === 'outline'
            ? 'Enter: new line · Tab / ⇧Tab: indent · ⌥⇧↑↓: move'
            : '↑↓: move · Enter: expand · R: refresh'}
        </span>
      </nav>

      {error && projection === 'roster' && (
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
        {projection === 'outline' ? (
          <OutlineCanvas outline={outline} author="operator" />
        ) : (
          <Roster
            drivers={drivers}
            loading={loading}
            expandedIds={expandedIds}
            expandingIds={expandingIds}
            expandErrors={expandErrors}
            onToggleExpand={(id, has) => void toggleExpand(id, has)}
          />
        )}
      </main>

      <footer className="footer">
        <span>Machine Intelligence Ensembles — Node Driver v0.2</span>
        <span className="footer-sep">·</span>
        <span>Outline + roster: two projections of one node space</span>
      </footer>
    </div>
  );
}
