import { DriverNodeRow } from '@/components/DriverNodeRow';
import type { DriverNode } from '@/types/ensemble';

interface RosterProps {
  drivers: DriverNode[];
  loading: boolean;
  expandedIds: ReadonlySet<string>;
  expandingIds: ReadonlySet<string>;
  onToggleExpand: (nodeId: string, hasChildren: boolean) => void;
}

export function Roster({
  drivers,
  loading,
  expandedIds,
  expandingIds,
  onToggleExpand,
}: RosterProps) {
  if (loading) {
    return (
      <section className="roster" aria-busy="true">
        <header className="roster-header">
          <h2>Roster</h2>
          <span className="roster-meta">loading main drivers…</span>
        </header>
      </section>
    );
  }

  return (
    <section className="roster">
      <header className="roster-header">
        <h2>Roster</h2>
        <span className="roster-meta">
          {drivers.length} main driver{drivers.length === 1 ? '' : 's'} · expand for activity
          sub-nodes
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
            onToggleExpand={onToggleExpand}
          />
        ))}
      </div>
    </section>
  );
}
