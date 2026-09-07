import { useCallback, useMemo, type RefObject } from 'react';
import { DriverNodeRow } from '@/components/DriverNodeRow';
import { useRosterKeyboard } from '@/hooks/useRosterKeyboard';
import { nodeHasExpandableChildren } from '@/hooks/useEnsemble';
import { flattenVisibleNodes } from '@/lib/flattenVisibleNodes';
import { countMainDriving } from '@/lib/rosterSummary';
import type { DriverNode } from '@/types/ensemble';

interface RosterProps {
  drivers: DriverNode[];
  loading: boolean;
  expandedIds: ReadonlySet<string>;
  expandingIds: ReadonlySet<string>;
  expandErrors: ReadonlyMap<string, string>;
  onToggleExpand: (nodeId: string, hasChildren: boolean) => void;
}

const SKELETON_ROWS = 5;

function RosterSkeleton() {
  return (
    <div className="roster-list roster-list--loading" aria-hidden="true">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div key={i} className="roster-skeleton-row">
          <span className="roster-skeleton-expand" />
          <div className="roster-skeleton-body">
            <span className="roster-skeleton-line roster-skeleton-line--title" />
            <span className="roster-skeleton-line roster-skeleton-line--meta" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Roster({
  drivers,
  loading,
  expandedIds,
  expandingIds,
  expandErrors,
  onToggleExpand,
}: RosterProps) {
  const drivingCount = useMemo(() => countMainDriving(drivers), [drivers]);

  const visibleNodes = useMemo(
    () => flattenVisibleNodes(drivers, expandedIds),
    [drivers, expandedIds],
  );

  const focusableIds = useMemo(() => visibleNodes.map((node) => node.id), [visibleNodes]);

  const handleKeyboardToggle = useCallback(
    (nodeId: string) => {
      const node = visibleNodes.find((n) => n.id === nodeId);
      if (!node) return;
      const canExpand = nodeHasExpandableChildren(node, new Set(expandedIds));
      if (canExpand) onToggleExpand(nodeId, canExpand);
    },
    [visibleNodes, expandedIds, onToggleExpand],
  );

  const { rosterRef } = useRosterKeyboard({
    focusableIds,
    onToggleExpand: handleKeyboardToggle,
    enabled: !loading && drivers.length > 0,
  });

  if (loading) {
    return (
      <section className="roster" aria-busy="true" aria-label="Roster loading">
        <header className="roster-header">
          <h2>Roster</h2>
          <span className="roster-meta roster-meta--loading">loading main drivers…</span>
        </header>
        <RosterSkeleton />
      </section>
    );
  }

  if (drivers.length === 0) {
    return (
      <section className="roster" aria-label="Roster empty">
        <header className="roster-header">
          <h2>Roster</h2>
          <span className="roster-meta">0 main drivers</span>
        </header>
        <div className="roster-empty" role="status">
          <p className="roster-empty-title">No main drivers in this ensemble</p>
          <p className="roster-empty-hint">
            The adapter returned an empty roster. Check your adapter configuration or refresh to
            retry.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="roster" ref={rosterRef as RefObject<HTMLElement>}>
      <header className="roster-header">
        <h2>Roster</h2>
        <span className="roster-meta">
          {drivers.length} main driver{drivers.length === 1 ? '' : 's'}
          {drivingCount > 0 && (
            <>
              {' '}
              · <span className="roster-driving-count">{drivingCount} driving</span>
            </>
          )}
          {' '}
          · expand for activity sub-nodes
        </span>
        <span className="roster-kbd-hint" aria-hidden="true">
          ↑↓ focus · Enter expand · R refresh
        </span>
      </header>

      <div className="roster-list" role="list">
        {drivers.map((node) => (
          <DriverNodeRow
            key={node.id}
            node={node}
            depth={0}
            expandedIds={expandedIds}
            expandingIds={expandingIds}
            expandErrors={expandErrors}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </div>
    </section>
  );
}
