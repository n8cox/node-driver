import type { MouseEvent } from 'react';
import { BodyStateLine } from '@/components/BodyStateLine';
import { nodeHasExpandableChildren } from '@/hooks/useEnsemble';
import { ROLE_GLYPH, ROLE_LABEL, roleClass } from '@/lib/roles';
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
  const canToggleActivity = nodeHasExpandableChildren(node, expandedIds);
  const showChildRows = isExpanded && Boolean(node.children?.length);
  const showEmptyActivity =
    isExpanded && node.children !== undefined && node.children.length === 0;
  const isDriving = node.bodyState.driving === true;
  const isActivity = depth > 0;

  const handleToggleActivity = () => {
    if (isExpanding || !canToggleActivity) return;
    onToggleExpand(node.id, canToggleActivity);
  };

  const handleExpandButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    handleToggleActivity();
  };

  const handleRowClick = () => {
    handleToggleActivity();
  };

  return (
    <div className="driver-node" data-depth={depth}>
      <div
        className={[
          'driver-row',
          roleClass(node.role),
          isDriving ? 'is-driving' : '',
          isActivity ? 'is-activity' : '',
          canToggleActivity ? 'driver-row--expandable' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        role="listitem"
        data-node-id={node.id}
        tabIndex={0}
        aria-label={`${node.name}, ${node.purpose}`}
        aria-expanded={canToggleActivity ? isExpanded : undefined}
        onClick={canToggleActivity ? handleRowClick : undefined}
      >
        {canToggleActivity ? (
          <button
            type="button"
            className={`expand-btn ${isExpanded ? 'expand-btn--expanded' : 'expand-btn--collapsed'}`}
            aria-expanded={isExpanded}
            aria-label={
              isExpanding
                ? `Loading activity for ${node.name}`
                : isExpanded
                  ? `Collapse activity for ${node.name}`
                  : `Expand activity for ${node.name}`
            }
            onClick={handleExpandButtonClick}
            disabled={isExpanding}
            title={isExpanded ? 'Collapse activity (Enter)' : 'Expand activity (Enter)'}
          >
            <span className="expand-glyph" aria-hidden="true">
              {isExpanding ? '…' : '▸'}
            </span>
          </button>
        ) : (
          <span className="expand-spacer" aria-hidden="true" />
        )}

        <div className="driver-content">
          <div className="driver-topline">
            {isActivity && <span className="activity-tag">activity</span>}
            <span className="driver-name">{node.name}</span>
            <span className="driver-sep">—</span>
            <span className="driver-purpose">{node.purpose}</span>
            {isDriving && (
              <span className="driving-badge" title="Currently driving the ensemble">
                driving
              </span>
            )}
            <span
              className={`role-glyph-badge ${roleClass(node.role)}`}
              title={ROLE_LABEL[node.role]}
              aria-label={`Role: ${ROLE_LABEL[node.role]}`}
            >
              {ROLE_GLYPH[node.role]}
            </span>
          </div>
          <BodyStateLine bodyState={node.bodyState} compact={isActivity} />
        </div>
      </div>

      {showEmptyActivity && (
        <div
          className="activity-empty"
          style={{ paddingLeft: `${32 + depth * 20}px` }}
          role="status"
        >
          No activity sub-nodes
        </div>
      )}

      {showChildRows &&
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
