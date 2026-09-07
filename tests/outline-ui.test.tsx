import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OutlineCanvas } from '@/components/OutlineCanvas';
import { useOutline } from '@/hooks/useOutline';
import { SampleAdapter } from '@/adapters/SampleAdapter';
import type { EnsembleAdapter, OutlineWriteResult } from '@/adapters/EnsembleAdapter';
import type { OutlineDiff, OutlineSnapshot } from '@/types/outline';

// This suite runs with vitest `globals` off, so RTL's auto-cleanup is not
// registered — the DOM must be torn down explicitly between tests.
afterEach(() => {
  cleanup();
});

/** Mounts the outline against a given adapter. */
function Harness({ adapter }: { adapter: EnsembleAdapter }) {
  const outline = useOutline(adapter);
  return <OutlineCanvas outline={outline} author="operator" />;
}

function rowTexts(): string[] {
  return Array.from(document.querySelectorAll('.outline-text')).map(
    (el) => (el as HTMLTextAreaElement).value,
  );
}

function textareaFor(value: string): HTMLTextAreaElement {
  const el = Array.from(document.querySelectorAll('.outline-text')).find(
    (n) => (n as HTMLTextAreaElement).value === value,
  );
  if (!el) throw new Error(`no outline row with text ${JSON.stringify(value)}`);
  return el as HTMLTextAreaElement;
}

describe('OutlineCanvas', () => {
  it('renders the sample outline with nesting', async () => {
    render(<Harness adapter={new SampleAdapter()} />);
    await waitFor(() => expect(screen.getByText('Ensemble priorities')).toBeTruthy());
    expect(rowTexts()).toContain('Land the outline projection');
  });

  it('Enter on a leaf adds a sibling below', async () => {
    render(<Harness adapter={new SampleAdapter()} />);
    await waitFor(() => expect(screen.getByText('Ensemble priorities')).toBeTruthy());

    const before = rowTexts().length;
    fireEvent.keyDown(textareaFor('Land the outline projection'), { key: 'Enter' });

    await waitFor(() => expect(rowTexts().length).toBe(before + 1));
  });

  it('Tab indents a line under its previous sibling', async () => {
    render(<Harness adapter={new SampleAdapter()} />);
    await waitFor(() => expect(screen.getByText('Ensemble priorities')).toBeTruthy());

    const target = 'Keep the roster as a view of the same node space';
    const depthBefore = textareaFor(target).closest('.outline-row') as HTMLElement;
    const padBefore = depthBefore.style.paddingLeft;

    fireEvent.keyDown(textareaFor(target), { key: 'Tab' });

    await waitFor(() => {
      const row = textareaFor(target).closest('.outline-row') as HTMLElement;
      expect(row.style.paddingLeft).not.toBe(padBefore);
    });
  });

  it('collapsing a parent hides its subtree', async () => {
    render(<Harness adapter={new SampleAdapter()} />);
    await waitFor(() => expect(screen.getByText('Ensemble priorities')).toBeTruthy());

    const parentRow = textareaFor('Ensemble priorities').closest('.outline-row') as HTMLElement;
    fireEvent.click(parentRow.querySelector('.outline-chevron')!);

    await waitFor(() => expect(rowTexts()).not.toContain('Land the outline projection'));
  });

  it('Backspace on an emptied line removes it', async () => {
    render(<Harness adapter={new SampleAdapter()} />);
    await waitFor(() => expect(screen.getByText('Ensemble priorities')).toBeTruthy());

    const target = 'Press Enter to add a line, Tab to indent';
    const ta = textareaFor(target);
    fireEvent.change(ta, { target: { value: '' } });
    await waitFor(() => expect(rowTexts()).toContain(''));

    fireEvent.keyDown(textareaFor(''), { key: 'Backspace' });
    await waitFor(() => expect(rowTexts()).not.toContain(''));
  });

  it('says so plainly when the adapter has no outline projection', async () => {
    const rosterOnly: EnsembleAdapter = {
      getIdentity: async () => ({ id: 'x', name: 'x' }),
      getMainDrivers: async () => [],
      expandNode: async () => [],
    };
    render(<Harness adapter={rosterOnly} />);
    await waitFor(() =>
      expect(screen.getByText(/does not expose the outline projection/)).toBeTruthy(),
    );
  });

  it('rolls the edit back when the write fails', async () => {
    const base = new SampleAdapter();
    const failing: EnsembleAdapter = {
      getIdentity: () => base.getIdentity(),
      getMainDrivers: () => base.getMainDrivers(),
      expandNode: (id: string) => base.expandNode(id),
      getOutline: (): Promise<OutlineSnapshot> => base.getOutline(),
      applyOutlineDiff: async (_d: OutlineDiff): Promise<OutlineWriteResult> => {
        throw new Error('backend refused the write');
      },
    };

    render(<Harness adapter={failing} />);
    await waitFor(() => expect(screen.getByText('Ensemble priorities')).toBeTruthy());

    const before = rowTexts().length;
    fireEvent.keyDown(textareaFor('Land the outline projection'), { key: 'Enter' });

    // The optimistic line appears, then the failure puts the outline back.
    await waitFor(() => expect(screen.getByText('backend refused the write')).toBeTruthy());
    expect(rowTexts().length).toBe(before);
  });

  it('surfaces lines the backend refused', async () => {
    const base = new SampleAdapter();
    const dropping: EnsembleAdapter = {
      getIdentity: () => base.getIdentity(),
      getMainDrivers: () => base.getMainDrivers(),
      expandNode: (id: string) => base.expandNode(id),
      getOutline: () => base.getOutline(),
      applyOutlineDiff: async () => ({ rev: 2, dropped: ['wake-guarded'] }),
    };

    render(<Harness adapter={dropping} />);
    await waitFor(() => expect(screen.getByText('Ensemble priorities')).toBeTruthy());

    fireEvent.keyDown(textareaFor('Land the outline projection'), { key: 'Enter' });
    await waitFor(() => expect(screen.getByText(/refused 1 line/)).toBeTruthy());
  });

  it('coalesces a burst of typing into a single write', async () => {
    const base = new SampleAdapter();
    let writes = 0;
    let lastUpsertText: string | null = null;

    const counting: EnsembleAdapter = {
      getIdentity: () => base.getIdentity(),
      getMainDrivers: () => base.getMainDrivers(),
      expandNode: (id: string) => base.expandNode(id),
      getOutline: () => base.getOutline(),
      applyOutlineDiff: async (d: OutlineDiff): Promise<OutlineWriteResult> => {
        writes += 1;
        lastUpsertText = d.upsert[0]?.text ?? null;
        return base.applyOutlineDiff(d);
      },
    };

    render(<Harness adapter={counting} />);
    await waitFor(() => expect(screen.getByText('Ensemble priorities')).toBeTruthy());

    const ta = textareaFor('Press Enter to add a line, Tab to indent');
    // The backend rewrites the whole outline per op, so a keystroke must not be
    // a write. Type a dozen characters in a burst.
    for (const value of ['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef']) {
      fireEvent.change(ta, { target: { value } });
    }

    expect(writes).toBe(0); // nothing written mid-burst
    await waitFor(() => expect(writes).toBe(1), { timeout: 2000 });
    expect(lastUpsertText).toBe('abcdef'); // and it carries the final text
  });

  it('flushes pending text before a structural change', async () => {
    const base = new SampleAdapter();
    const order: string[] = [];

    const tracking: EnsembleAdapter = {
      getIdentity: () => base.getIdentity(),
      getMainDrivers: () => base.getMainDrivers(),
      expandNode: (id: string) => base.expandNode(id),
      getOutline: () => base.getOutline(),
      applyOutlineDiff: async (d: OutlineDiff): Promise<OutlineWriteResult> => {
        order.push(d.remove.length > 0 || d.upsert.length > 1 ? 'structural' : 'text');
        return base.applyOutlineDiff(d);
      },
    };

    render(<Harness adapter={tracking} />);
    await waitFor(() => expect(screen.getByText('Ensemble priorities')).toBeTruthy());

    const ta = textareaFor('Press Enter to add a line, Tab to indent');
    fireEvent.change(ta, { target: { value: 'edited but not yet saved' } });
    fireEvent.keyDown(ta, { key: 'Enter' });

    await waitFor(() => expect(order.length).toBeGreaterThanOrEqual(2));
    expect(order[0]).toBe('text'); // the pending edit lands first
  });
});
