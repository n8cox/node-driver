import type { DriverNode } from '@/types/ensemble';

/** Count main roster nodes currently driving (not nested activity rows). */
export function countMainDriving(drivers: readonly DriverNode[]): number {
  return drivers.filter((node) => node.bodyState.driving === true).length;
}

/** Walk the full tree and count nodes with driving === true. */
export function countDrivingInTree(nodes: readonly DriverNode[]): number {
  let count = 0;

  const walk = (list: readonly DriverNode[]) => {
    for (const node of list) {
      if (node.bodyState.driving === true) count++;
      if (node.children?.length) walk(node.children);
    }
  };

  walk(nodes);
  return count;
}
