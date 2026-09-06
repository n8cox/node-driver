import { BodyStateLine } from '@/components/BodyStateLine';
import { nodeHasExpandableChildren } from '@/hooks/useEnsemble';
import { ROLE_LABEL, roleClass } from '@/lib/roles';
import type { DriverNode } from '@/types/ensemble';

interface DriverNodeRowProps {
  node: DriverNode;
  depth: number;
  expandedIds: ReadonlySet<string>;
  expandingIds: ReadonlySet<string>;
  onToggleExpand: (nodeId: string, hasChildren: boolean) => void;
}

export function DriverNodeRow({
  node,
  depth,
  expandedIds,
  expandingIds,
  onToggleExpand,
}: DriverNodeRowProps) {
  const isExpanded = expandedIds.has(node.id);
  const isExpanding = expandingIds.has(node.id);
  const canExpand = nodeHasExpandableChildren(node, new Set(expandedIds));
  const showChildren = isExpanded && node.children && node.children.length > 0;

  return (
    <div className="driver-node" data-depth={depth}>
      <div
        className={`driver-row ${roleClass(node.role)}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {canExpand ? (
          <button
            type="button"
            className="expand-btn"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onClick={() => onToggleExpand(node.id, canExpand)}
            disabled={isExpanding}
          >
            {isExpanding ? '…' : isExpanded ? '−' : '+'}
          </button>
        ) : (
          <span className="expand-spacer" aria-hidden="true" />
        )}

        <div className="driver-content">
          <div className="driver-topline">
            <span className="driver-name">{node.name}</span>
            <span className="driver-sep">—</span>
            <span className="driver-purpose">{node.purpose}</span>
            <span className={`role-badge ${roleClass(node.role)}`}>{ROLE_LABEL[node.role]}</span>
          </div>
          <BodyStateLine bodyState={node.bodyState} />
        </div>
      </div>

      {showChildren &&
        node.children!.map((child) => (
          <DriverNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedIds={expandedIds}
            expandingIds={expandingIds}
            onToggleExpand={onToggleExpand}
          />
        ))}
    </div>
  );
}
