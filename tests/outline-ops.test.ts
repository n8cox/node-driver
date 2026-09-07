import { describe, expect, it } from 'vitest';
import {
  applyDiff,
  indent,
  insertSibling,
  mergeIntoPrev,
  moveNode,
  outdent,
  removeEmpty,
  removeSubtree,
  setText,
  toggleCollapse,
} from '@/outline/ops';
import { childrenOf, descendantIds, visibleRows } from '@/outline/tree';
import type { OutlineLine } from '@/types/outline';

const CTX = { author: 'nathan', makeId: () => 'NEW', now: () => 1000 };

function line(id: string, parentId: string | null, order: number, text = id): OutlineLine {
  return { id, parentId, order, text, author: 'nathan' };
}

/**
 *  a
 *  ├ a1
 *  └ a2
 *  b
 */
const TREE: OutlineLine[] = [
  line('a', null, 1),
  line('a1', 'a', 1),
  line('a2', 'a', 2),
  line('b', null, 2),
];

/** Read the resulting shape as "id@parent#order", so assertions show structure. */
function shape(lines: readonly OutlineLine[]): string[] {
  return visibleRows(lines).map((r) => `${'  '.repeat(r.depth)}${r.line.id}`);
}

describe('tree', () => {
  it('orders siblings and applies collapse', () => {
    expect(shape(TREE)).toEqual(['a', '  a1', '  a2', 'b']);
    const collapsed = applyDiff(TREE, toggleCollapse(TREE, 'a'));
    expect(shape(collapsed)).toEqual(['a', 'b']);
  });

  it('survives a cyclic parent chain instead of hanging', () => {
    const cyclic: OutlineLine[] = [
      { ...line('x', 'y', 1) },
      { ...line('y', 'x', 1) },
    ];
    expect(visibleRows(cyclic)).toEqual([]);
  });

  it('collects descendants deepest-last', () => {
    expect(descendantIds(TREE, 'a').sort()).toEqual(['a1', 'a2']);
  });
});

describe('insertSibling (Enter)', () => {
  it('inserts directly below a leaf, as a sibling', () => {
    const d = insertSibling(TREE, 'a1', CTX);
    const next = applyDiff(TREE, d);
    expect(shape(next)).toEqual(['a', '  a1', '  NEW', '  a2', 'b']);
    expect(d.newId).toBe('NEW');
  });

  it('inserts as FIRST CHILD when the subtree is open', () => {
    const next = applyDiff(TREE, insertSibling(TREE, 'a', CTX));
    expect(shape(next)).toEqual(['a', '  NEW', '  a1', '  a2', 'b']);
  });

  it('inserts as a sibling when the subtree is collapsed', () => {
    const collapsed = applyDiff(TREE, toggleCollapse(TREE, 'a'));
    const next = applyDiff(collapsed, insertSibling(collapsed, 'a', CTX));
    expect(childrenOf(next, null).map((l) => l.id)).toEqual(['a', 'NEW', 'b']);
  });

  it('stamps author and status on the created line', () => {
    const created = insertSibling(TREE, 'b', CTX).upsert.find((l) => l.id === 'NEW');
    expect(created).toMatchObject({ author: 'nathan', status: 'new', text: '', ts: 1000 });
  });
});

describe('indent (Tab)', () => {
  it('makes the previous sibling the parent', () => {
    const next = applyDiff(TREE, indent(TREE, 'a2'));
    expect(shape(next)).toEqual(['a', '  a1', '    a2', 'b']);
  });

  it('is a no-op for the first child — nothing above can adopt it', () => {
    expect(indent(TREE, 'a1')).toEqual({ upsert: [], remove: [] });
  });

  it('opens a collapsed new parent so the line does not vanish', () => {
    const withCollapsed = applyDiff(TREE, toggleCollapse(TREE, 'a'));
    const next = applyDiff(withCollapsed, indent(withCollapsed, 'b'));
    expect(shape(next)).toEqual(['a', '  a1', '  a2', '  b']);
  });
});

describe('outdent (Shift-Tab)', () => {
  it('becomes the next sibling of its parent', () => {
    const next = applyDiff(TREE, outdent(TREE, 'a1'));
    expect(shape(next)).toEqual(['a', '  a2', 'a1', 'b']);
  });

  it('is a no-op at root level', () => {
    expect(outdent(TREE, 'a')).toEqual({ upsert: [], remove: [] });
  });

  it('round-trips with indent', () => {
    const indented = applyDiff(TREE, indent(TREE, 'a2'));
    const back = applyDiff(indented, outdent(indented, 'a2'));
    expect(shape(back)).toEqual(shape(TREE));
  });
});

describe('removeEmpty (Backspace on empty)', () => {
  it('promotes children into the freed slot rather than dropping them', () => {
    const next = applyDiff(TREE, removeEmpty(TREE, 'a'));
    expect(shape(next)).toEqual(['a1', 'a2', 'b']);
  });

  it('removes a childless line outright', () => {
    const next = applyDiff(TREE, removeEmpty(TREE, 'a1'));
    expect(shape(next)).toEqual(['a', '  a2', 'b']);
  });
});

describe('mergeIntoPrev (Backspace at line start)', () => {
  it('appends the text to the previous sibling and removes the line', () => {
    const d = mergeIntoPrev(TREE, 'a2');
    const next = applyDiff(TREE, d);
    expect(next.find((l) => l.id === 'a1')?.text).toBe('a1a2');
    expect(next.find((l) => l.id === 'a2')).toBeUndefined();
    expect(d.mergedInto).toBe('a1');
  });

  it('declines when the line has children, so no subtree is orphaned', () => {
    expect(mergeIntoPrev(TREE, 'a').mergedInto).toBeNull();
    const withKids = applyDiff(TREE, indent(TREE, 'b'));
    expect(mergeIntoPrev(withKids, 'a').remove).toEqual([]);
  });
});

describe('moveNode (Alt+Shift+Up/Down)', () => {
  it('reorders among siblings', () => {
    const next = applyDiff(TREE, moveNode(TREE, 'a1', 1));
    expect(childrenOf(next, 'a').map((l) => l.id)).toEqual(['a2', 'a1']);
  });

  it('carries the subtree with the moved line', () => {
    const nested = applyDiff(TREE, indent(TREE, 'a2')); // a2 under a1
    const next = applyDiff(nested, moveNode(nested, 'a', 1));
    expect(shape(next)).toEqual(['b', 'a', '  a1', '    a2']);
  });

  it('is a no-op at either end', () => {
    expect(moveNode(TREE, 'a1', -1)).toEqual({ upsert: [], remove: [] });
    expect(moveNode(TREE, 'a2', 1)).toEqual({ upsert: [], remove: [] });
  });
});

describe('setText / removeSubtree', () => {
  it('emits nothing when the text is unchanged', () => {
    expect(setText(TREE, 'a', 'a')).toEqual({ upsert: [], remove: [] });
  });

  it('removeSubtree drops the line and every descendant', () => {
    const d = removeSubtree(TREE, 'a');
    expect(d.remove.sort()).toEqual(['a', 'a1', 'a2']);
    expect(shape(applyDiff(TREE, d))).toEqual(['b']);
  });
});

describe('diffs are wire-shaped and minimal', () => {
  it('only resequences siblings whose order actually changed', () => {
    const d = insertSibling(TREE, 'a2', CTX);
    // a1 keeps order 1; only the new line needs writing.
    expect(d.upsert.map((l) => l.id)).toEqual(['NEW']);
  });

  it('never emits a line missing its id or parent contract', () => {
    for (const d of [indent(TREE, 'a2'), outdent(TREE, 'a1'), moveNode(TREE, 'a1', 1)]) {
      for (const l of d.upsert) {
        expect(typeof l.id).toBe('string');
        expect('parentId' in l).toBe(true);
        expect(Number.isFinite(l.order)).toBe(true);
      }
    }
  });
});
