import type { DriverNode } from '@/types/ensemble';

/** Flatten visible roster rows in display order for keyboard roving focus. */
export function flattenVisibleNodes(
  nodes: readonly DriverNode[],
  expandedIds: ReadonlySet<string>,
): DriverNode[] {
  const result: DriverNode[] = [];

  const walk = (list: readonly DriverNode[]) => {
    for (const node of list) {
      result.push(node);
      if (expandedIds.has(node.id) && node.children?.length) {
        walk(node.children);
      }
    }
  };

  walk(nodes);
  return result;
}
