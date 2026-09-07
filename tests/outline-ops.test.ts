import { describe, expect, it } from 'vitest';
import {
  applyDiff,
  clipSubtree,
  clipToText,
  cycleStatus,
  diffOutlines,
  insertClip,
  parseIndentedText,
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
import { childrenOf, descendantIds, searchRows, visibleRows } from '@/outline/tree';
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

describe('diffOutlines (the shape undo travels in)', () => {
  it('emits nothing for an unchanged outline', () => {
    expect(diffOutlines(TREE, TREE)).toEqual({ upsert: [], remove: [] });
  });

  it('sends only the lines that actually changed', () => {
    const edited = applyDiff(TREE, setText(TREE, 'a1', 'changed'));
    const d = diffOutlines(TREE, edited);
    expect(d.upsert.map((l) => l.id)).toEqual(['a1']);
    expect(d.remove).toEqual([]);
  });

  it('removes lines that the target no longer has', () => {
    const pruned = applyDiff(TREE, removeSubtree(TREE, 'a'));
    const d = diffOutlines(TREE, pruned);
    expect(d.remove.sort()).toEqual(['a', 'a1', 'a2']);
  });

  it('round-trips an edit: applying the reverse diff restores the original', () => {
    const edited = applyDiff(TREE, indent(TREE, 'a2'));
    const back = applyDiff(edited, diffOutlines(edited, TREE));
    expect(shape(back)).toEqual(shape(TREE));
  });

  it('notices a collapse, which an order-only comparison would miss', () => {
    const collapsed = applyDiff(TREE, toggleCollapse(TREE, 'a'));
    expect(diffOutlines(TREE, collapsed).upsert.map((l) => l.id)).toEqual(['a']);
  });
});

describe('cycleStatus', () => {
  it('steps the moon phases and wraps', () => {
    let lines = TREE;
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 7; i += 1) {
      lines = applyDiff(lines, cycleStatus(lines, 'a1'));
      seen.push(lines.find((l) => l.id === 'a1')?.status);
    }
    expect(seen).toEqual(['crescent', 'quarter', 'gibbous', 'full', 'done', 'new', 'crescent']);
  });
});

describe('clipboard', () => {
  it('clips a subtree with relative depth', () => {
    expect(clipSubtree(TREE, 'a')).toEqual([
      { depth: 0, text: 'a' },
      { depth: 1, text: 'a1' },
      { depth: 1, text: 'a2' },
    ]);
  });

  it('renders indented text that other apps can read', () => {
    expect(clipToText(clipSubtree(TREE, 'a'))).toBe('a\n  a1\n  a2');
  });

  it('parses indented text back into depths', () => {
    expect(parseIndentedText('one\n  two\n  three\n    four')).toEqual([
      { depth: 0, text: 'one' },
      { depth: 1, text: 'two' },
      { depth: 1, text: 'three' },
      { depth: 2, text: 'four' },
    ]);
  });

  it('gives one level per indent step, whatever the source used', () => {
    // Distinct indent WIDTHS become consecutive depths, so a 4-space document
    // and a tab document both nest one level per step.
    expect(parseIndentedText('a\n    b\n        c').map((c) => c.depth)).toEqual([0, 1, 2]);
    expect(parseIndentedText('a\n\tb\n\t\tc').map((c) => c.depth)).toEqual([0, 1, 2]);
    expect(parseIndentedText('- a\n- b').map((c) => c.depth)).toEqual([0, 0]);
  });

  it('ignores blank lines and normalises a block copied mid-document', () => {
    expect(parseIndentedText('\n    alpha\n\n      beta\n')).toEqual([
      { depth: 0, text: 'alpha' },
      { depth: 1, text: 'beta' },
    ]);
  });

  it('pastes a clip after a leaf, preserving nesting', () => {
    let n = 0;
    const ctx = { author: 'nathan', makeId: () => `P${(n += 1)}`, now: () => 5 };
    const clip = parseIndentedText('one\n  two');
    const d = insertClip(TREE, 'a1', clip, ctx);
    const next = applyDiff(TREE, d);
    expect(shape(next)).toEqual(['a', '  a1', '  P1', '    P2', '  a2', 'b']);
    expect(d.firstId).toBe('P1');
  });

  it('pastes as first child when the anchor subtree is open', () => {
    let n = 0;
    const ctx = { author: 'nathan', makeId: () => `P${(n += 1)}`, now: () => 5 };
    const next = applyDiff(TREE, insertClip(TREE, 'a', parseIndentedText('x'), ctx));
    expect(shape(next)).toEqual(['a', '  P1', '  a1', '  a2', 'b']);
  });

  it('a cut then paste elsewhere preserves the subtree shape', () => {
    let n = 0;
    const ctx = { author: 'nathan', makeId: () => `P${(n += 1)}`, now: () => 5 };
    const clip = clipSubtree(TREE, 'a');
    const cut = applyDiff(TREE, removeSubtree(TREE, 'a'));
    const pasted = applyDiff(cut, insertClip(cut, 'b', clip, ctx));
    expect(shape(pasted)).toEqual(['b', 'P1', '  P2', '  P3']);
  });
});

describe('searchRows keeps the line being edited', () => {
  const SEARCHABLE: OutlineLine[] = [
    line('root', null, 1, 'alpha parent'),
    line('hit', 'root', 1, 'alpha match'),
    line('miss', 'root', 2, 'nothing here'),
    line('fresh', 'root', 3, ''),
  ];

  it('filters to matches and their ancestors', () => {
    const { rows, matched } = searchRows(SEARCHABLE, 'alpha');
    expect(rows.map((r) => r.line.id)).toEqual(['root', 'hit']);
    expect([...matched].sort()).toEqual(['hit', 'root']);
  });

  it('keeps a focused empty line that matches nothing', () => {
    // Otherwise a line created under an active filter is invisible, focus stays
    // on the previous row, and the next keystroke overwrites it.
    const { rows } = searchRows(SEARCHABLE, 'alpha', null, 'fresh');
    expect(rows.map((r) => r.line.id)).toEqual(['root', 'hit', 'fresh']);
  });

  it('ignores a focus id that no longer exists', () => {
    const { rows } = searchRows(SEARCHABLE, 'alpha', null, 'deleted');
    expect(rows.map((r) => r.line.id)).toEqual(['root', 'hit']);
  });
});

describe('writes stay small (the backend rewrites the whole file per op)', () => {
  /** 60 root siblings — the live outline has 43. */
  const WIDE: OutlineLine[] = Array.from({ length: 60 }, (_, i) =>
    line(`w${i}`, null, i + 1, `w${i}`),
  );

  it('inserting among many siblings writes ONE line, not the whole list', () => {
    const d = insertSibling(WIDE, 'w0', CTX);
    expect(d.upsert).toHaveLength(1);
    expect(d.upsert[0].id).toBe('NEW');
  });

  it('the inserted line still lands in the right place', () => {
    const next = applyDiff(WIDE, insertSibling(WIDE, 'w0', CTX));
    expect(childrenOf(next, null).slice(0, 3).map((l) => l.id)).toEqual(['w0', 'NEW', 'w1']);
  });

  it('moving writes one line', () => {
    const d = moveNode(WIDE, 'w10', 1);
    expect(d.upsert).toHaveLength(1);
    const next = applyDiff(WIDE, d);
    expect(childrenOf(next, null).slice(9, 12).map((l) => l.id)).toEqual(['w9', 'w11', 'w10']);
  });

  it('indent and outdent write one line each', () => {
    expect(indent(WIDE, 'w5').upsert).toHaveLength(1);
    const nested = applyDiff(WIDE, indent(WIDE, 'w5'));
    expect(outdent(nested, 'w5').upsert).toHaveLength(1);
  });

  it('repeated inserts at the same spot keep their order', () => {
    let lines: OutlineLine[] = WIDE;
    for (let i = 0; i < 12; i += 1) {
      const ctx = { author: 'nathan', makeId: () => `N${i}`, now: () => 1 };
      lines = applyDiff(lines, insertSibling(lines, 'w0', ctx));
    }
    const ids = childrenOf(lines, null).slice(0, 14).map((l) => l.id);
    // Each new line lands directly after w0, so the newest is nearest to it.
    expect(ids[0]).toBe('w0');
    expect(ids[1]).toBe('N11');
    expect(ids[12]).toBe('N0');
    expect(ids[13]).toBe('w1');
  });

  it('falls back to renumbering when the gap between neighbours is exhausted', () => {
    // Two siblings with no representable space between them.
    const tight: OutlineLine[] = [
      line('t1', null, 1, 't1'),
      line('t2', null, 1 + 1e-12, 't2'),
    ];
    const d = insertSibling(tight, 't1', CTX);
    expect(d.upsert.length).toBeGreaterThan(1); // renumbered rather than colliding
    const next = applyDiff(tight, d);
    expect(childrenOf(next, null).map((l) => l.id)).toEqual(['t1', 'NEW', 't2']);
  });
});
