import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { DriverNodeRow } from '@/components/DriverNodeRow';
import { Roster } from '@/components/Roster';
import { MAIN_DRIVERS } from '@/adapters/SampleAdapter';
import { flattenVisibleNodes } from '@/lib/flattenVisibleNodes';
import { countMainDriving, countDrivingInTree } from '@/lib/rosterSummary';
import type { DriverNode } from '@/types/ensemble';

afterEach(() => {
  cleanup();
});

describe('rosterSummary', () => {
  it('counts main driving nodes', () => {
    expect(countMainDriving(MAIN_DRIVERS)).toBe(1);
  });

  it('counts driving across expanded tree', () => {
    const withChild: DriverNode[] = [
      {
        ...MAIN_DRIVERS[0],
        children: [
          {
            id: 'child-driving',
            name: 'Child',
            purpose: 'Nested driver',
            role: 'human',
            bodyState: { state: 'active', driving: true, activityLine: 'x' },
          },
        ],
      },
    ];
    expect(countDrivingInTree(withChild)).toBe(2);
  });
});

describe('flattenVisibleNodes', () => {
  it('includes nested rows only when parent is expanded', () => {
    const parent: DriverNode = {
      ...MAIN_DRIVERS[1],
      children: [
        {
          id: 'act-1',
          name: 'Activity',
          purpose: 'Sub task',
          role: 'hemisphere',
          bodyState: { state: 'active', activityLine: 'working' },
        },
      ],
    };

    const collapsed = flattenVisibleNodes([parent], new Set());
    expect(collapsed.map((n) => n.id)).toEqual([parent.id]);

    const expanded = flattenVisibleNodes([parent], new Set([parent.id]));
    expect(expanded.map((n) => n.id)).toEqual([parent.id, 'act-1']);
  });
});

describe('DriverNodeRow', () => {
  it('shows driving badge when bodyState.driving is true', () => {
    render(
      <DriverNodeRow
        node={MAIN_DRIVERS[0]}
        depth={0}
        expandedIds={new Set()}
        expandingIds={new Set()}
        onToggleExpand={() => {}}
      />,
    );

    const badge = screen.getByText('driving');
    expect(badge.className).toContain('driving-badge');
    expect(document.querySelector('.driver-row.is-driving')).toBeTruthy();
  });

  it('marks activity rows at depth > 0', () => {
    render(
      <DriverNodeRow
        node={{
          id: 'act',
          name: 'Context ingest',
          purpose: 'Load documents',
          role: 'hemisphere',
          bodyState: { state: 'complete', activityLine: 'done' },
        }}
        depth={1}
        expandedIds={new Set()}
        expandingIds={new Set()}
        onToggleExpand={() => {}}
      />,
    );

    expect(screen.getByText('activity').className).toContain('activity-tag');
    expect(document.querySelector('.driver-row.is-activity')).toBeTruthy();
  });
});

describe('Roster UI states', () => {
  it('renders loading skeleton', () => {
    render(
      <Roster
        drivers={[]}
        loading
        expandedIds={new Set()}
        expandingIds={new Set()}
        onToggleExpand={() => {}}
      />,
    );

    expect(screen.getByText('loading main drivers…')).toBeTruthy();
    expect(document.querySelectorAll('.roster-skeleton-row').length).toBeGreaterThan(0);
  });

  it('renders empty roster message', () => {
    render(
      <Roster
        drivers={[]}
        loading={false}
        expandedIds={new Set()}
        expandingIds={new Set()}
        onToggleExpand={() => {}}
      />,
    );

    expect(screen.getByText('No main drivers in this ensemble')).toBeTruthy();
  });

  it('shows driving count in roster header', () => {
    render(
      <Roster
        drivers={MAIN_DRIVERS}
        loading={false}
        expandedIds={new Set()}
        expandingIds={new Set()}
        onToggleExpand={() => {}}
      />,
    );

    expect(document.querySelector('.roster-driving-count')?.textContent?.trim()).toBe('1 driving');
  });

  it('expands focused row on Enter', () => {
    const onToggleExpand = vi.fn();
    const { container } = render(
      <Roster
        drivers={MAIN_DRIVERS}
        loading={false}
        expandedIds={new Set()}
        expandingIds={new Set()}
        onToggleExpand={onToggleExpand}
      />,
    );

    const claudeRow = container.querySelector('[data-node-id="hemisphere-claude"]') as HTMLElement;
    claudeRow.focus();
    fireEvent.keyDown(claudeRow, { key: 'Enter' });

    expect(onToggleExpand).toHaveBeenCalledWith('hemisphere-claude', true);
  });
});

describe('App keyboard and integration', () => {
  it('loads sample ensemble and refreshes on R key', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Research Lab Ensemble')).toBeTruthy();
    });

    expect(screen.getAllByText(/1 driving/).length).toBeGreaterThanOrEqual(1);

    fireEvent.keyDown(window, { key: 'r' });

    await waitFor(() => {
      expect(screen.getByText('Research Lab Ensemble')).toBeTruthy();
    });
  });
});
