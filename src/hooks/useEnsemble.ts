import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EnsembleAdapter } from '@/adapters/EnsembleAdapter';
import type { DriverNode, EnsembleIdentity } from '@/types/ensemble';

export interface UseEnsembleResult {
  identity: EnsembleIdentity | null;
  drivers: DriverNode[];
  loading: boolean;
  error: string | null;
  expandingIds: ReadonlySet<string>;
  expandedIds: ReadonlySet<string>;
  toggleExpand: (nodeId: string, hasChildren: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

function mergeChildren(
  nodes: DriverNode[],
  parentId: string,
  children: DriverNode[],
): DriverNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children, hasChildren: children.length > 0 };
    }
    if (node.children?.length) {
      return { ...node, children: mergeChildren(node.children, parentId, children) };
    }
    return node;
  });
}

function nodeHasExpandableChildren(node: DriverNode, expandedIds: Set<string>): boolean {
  if (node.children !== undefined) return node.children.length > 0;
  return Boolean(node.hasChildren) || expandedIds.has(node.id);
}

export function useEnsemble(adapter: EnsembleAdapter): UseEnsembleResult {
  const [identity, setIdentity] = useState<EnsembleIdentity | null>(null);
  const [drivers, setDrivers] = useState<DriverNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandingIds, setExpandingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpandedIds(new Set());
    try {
      const [id, mainDrivers] = await Promise.all([
        adapter.getIdentity(),
        adapter.getMainDrivers(),
      ]);
      setIdentity(id);
      setDrivers(mainDrivers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ensemble');
      setIdentity(null);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleExpand = useCallback(
    async (nodeId: string, hasChildren: boolean) => {
      if (!hasChildren && !expandedIds.has(nodeId)) return;

      if (expandedIds.has(nodeId)) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        return;
      }

      setExpandingIds((prev) => new Set(prev).add(nodeId));
      try {
        const children = await adapter.expandNode(nodeId);
        setDrivers((prev) => mergeChildren(prev, nodeId, children));
        setExpandedIds((prev) => new Set(prev).add(nodeId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to expand node');
      } finally {
        setExpandingIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
      }
    },
    [adapter, expandedIds],
  );

  return useMemo(
    () => ({
      identity,
      drivers,
      loading,
      error,
      expandingIds,
      expandedIds,
      toggleExpand,
      refresh: load,
    }),
    [
      identity,
      drivers,
      loading,
      error,
      expandingIds,
      expandedIds,
      toggleExpand,
      load,
    ],
  );
}

export { nodeHasExpandableChildren };
