import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { BodyStateLine } from '@/components/BodyStateLine';
import { DriverNodeRow } from '@/components/DriverNodeRow';
import { Roster } from '@/components/Roster';
import { MAIN_DRIVERS } from '@/adapters/SampleAdapter';
import { flattenVisibleNodes } from '@/lib/flattenVisibleNodes';
import { countMainDriving, countDrivingInTree } from '@/lib/rosterSummary';
import { ROLE_GLYPH, ROLE_LABEL } from '@/lib/roles';
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

describe('ROLE_GLYPH', () => {
  it('uses Meridian-locked glyph characters', () => {
    expect(ROLE_GLYPH.human).toBe('☉');
    expect(ROLE_GLYPH.hemisphere).toBe('◐');
    expect(ROLE_GLYPH.connection).toBe('⎔');
    expect(ROLE_GLYPH.motor).toBe('⚙');
  });
});

describe('BodyStateLine', () => {
  it('omits driving from meta text — badge and row styling own the glance', () => {
    render(
      <BodyStateLine
        bodyState={{
          state: 'present',
          engagement: 'focused',
          driving: true,
          activityLine: 'Reviewing draft',
        }}
      />,
    );

    const meta = document.querySelector('.body-state-meta');
    expect(meta?.textContent).toBe('present · engagement: focused');
    expect(meta?.textContent).not.toContain('driving');
  });

  it('omits not driving from meta text for non-driving rows', () => {
    render(
      <BodyStateLine
        bodyState={{
          state: 'active',
          driving: false,
          activityLine: 'Idle',
        }}
      />,
    );

    const meta = document.querySelector('.body-state-meta');
    expect(meta?.textContent).toBe('active');
    expect(meta?.textContent).not.toContain('not driving');
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

  it('renders glyph-only role indicator with accessible role name', () => {
    render(
      <DriverNodeRow
        node={MAIN_DRIVERS[4]}
        depth={0}
        expandedIds={new Set()}
        expandingIds={new Set()}
        onToggleExpand={() => {}}
      />,
    );

    const badge = document.querySelector('.role-glyph-badge.role-motor');
    expect(badge?.textContent).toBe(ROLE_GLYPH.motor);
    expect(badge?.getAttribute('aria-label')).toBe(`Role: ${ROLE_LABEL.motor}`);
    expect(badge?.getAttribute('title')).toBe(ROLE_LABEL.motor);
    expect(badge?.textContent).not.toContain(ROLE_LABEL.motor);
  });

  it('toggles expand when clicking the row body outside the chevron', () => {
    const onToggleExpand = vi.fn();
    const { container } = render(
      <DriverNodeRow
        node={MAIN_DRIVERS[1]}
        depth={0}
        expandedIds={new Set()}
        expandingIds={new Set()}
        onToggleExpand={onToggleExpand}
      />,
    );

    const row = container.querySelector('[data-node-id="hemisphere-claude"]') as HTMLElement;
    fireEvent.click(row.querySelector('.driver-content')!);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
    expect(onToggleExpand).toHaveBeenCalledWith('hemisphere-claude', true);

    onToggleExpand.mockClear();
    fireEvent.click(row.querySelector('.expand-btn')!);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it('truncates long purpose and activity with title tooltips', () => {
    render(
      <DriverNodeRow
        node={{
          ...MAIN_DRIVERS[1],
          purpose:
            'Structured reasoning and long-context synthesis across many documents and constraints',
          bodyState: {
            ...MAIN_DRIVERS[1].bodyState,
            activityLine:
              'Drafting architecture comparison matrix with latency tradeoffs and failover paths',
          },
        }}
        depth={0}
        expandedIds={new Set()}
        expandingIds={new Set()}
        onToggleExpand={() => {}}
      />,
    );

    const purpose = document.querySelector('.driver-purpose');
    expect(purpose?.className).toContain('truncate');
    expect(purpose?.getAttribute('title')).toContain('Structured reasoning');

    const activity = document.querySelector('.body-state-activity');
    expect(activity?.className).toContain('truncate');
    expect(activity?.getAttribute('title')).toContain('Drafting architecture');
  });

  it('shows empty activity message and keeps collapse affordance after empty expand', () => {
    const watchdog = MAIN_DRIVERS.find((d) => d.id === 'motor-watchdog')!;

    render(
      <DriverNodeRow
        node={{ ...watchdog, children: [] }}
        depth={0}
        expandedIds={new Set(['motor-watchdog'])}
        expandingIds={new Set()}
        onToggleExpand={() => {}}
      />,
    );

    expect(screen.getByText('No activity sub-nodes')).toBeTruthy();
    expect(document.querySelector('.expand-btn.expand-btn--expanded')).toBeTruthy();
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

  it('shows empty activity honesty after expanding motor-watchdog', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Watchdog Monitor')).toBeTruthy();
    });

    const watchdogRow = container.querySelector('[data-node-id="motor-watchdog"]') as HTMLElement;
    fireEvent.click(watchdogRow.querySelector('.expand-btn')!);

    await waitFor(
      () => {
        expect(screen.getByText('No activity sub-nodes')).toBeTruthy();
      },
      { timeout: 2000 },
    );

    expect(document.querySelector('.expand-btn.expand-btn--expanded')).toBeTruthy();
  });
});
