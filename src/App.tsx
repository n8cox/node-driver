import { useEffect, useMemo, useState } from 'react';
import { IdentityStrip } from '@/components/IdentityStrip';
import { OutlineCanvas } from '@/components/OutlineCanvas';
import { Roster } from '@/components/Roster';
import { resolveAdapter, type AdapterSelection } from '@/config/adapter';
import { supportsOutline } from '@/adapters/EnsembleAdapter';
import { useEnsemble } from '@/hooks/useEnsemble';
import { useKeyboardRefresh } from '@/hooks/useKeyboardRefresh';
import { useOutline } from '@/hooks/useOutline';
import { countMainDriving } from '@/lib/rosterSummary';
import { SampleAdapter } from '@/adapters/SampleAdapter';

/**
 * Two projections of ONE node space (Nathan's design law, 2026-07-01):
 * the OUTLINE is the node graph linearized to be read and edited; the ROSTER is
 * the same space grouped by who is driving. The outline leads, because the
 * outline is the working surface.
 */
type Projection = 'outline' | 'roster';

export function App() {
  const [selection, setSelection] = useState<AdapterSelection | null>(null);

  // Connect on open: use a live backend when one answers, demo data when not,
  // and say which. A desktop app that opens onto an error is not a primary
  // interface.
  useEffect(() => {
    let cancelled = false;
    void resolveAdapter().then((resolved) => {
      if (!cancelled) setSelection(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!selection) return <Connecting />;
  return <Workspace key={selection.label} selection={selection} />;
}

function Connecting() {
  return (
    <div className="app">
      <IdentityStrip identity={null} loading onRefresh={() => {}} source="connecting…" />
      <main className="main">
        <div className="outline-empty">Looking for a live ensemble…</div>
      </main>
    </div>
  );
}

function Workspace({ selection }: { selection: AdapterSelection }) {
  const adapter = selection.adapter;
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
        source={selection.label}
        fellBack={selection.fellBack}
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
            ? 'Enter: new line · Tab/⇧Tab: indent · ⌥⇧↑↓: move · ⌘Z: undo · ⌘X/C/V: subtree'
            : '↑↓: move · Enter: expand · R: refresh'}
        </span>
      </nav>

      {selection.fellBack && (
        <div className="outline-dropped" role="status">
          No live ensemble answered — showing demo data. Start the backend and press{' '}
          <strong>R</strong> to reconnect.
        </div>
      )}

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
        <span>Machine Intelligence Ensembles — Node Driver v0.3</span>
        <span className="footer-sep">·</span>
        <span>Outline + roster: two projections of one node space</span>
      </footer>
    </div>
  );
}

/** Re-exported so tests can construct the offline app directly. */
export { SampleAdapter };
