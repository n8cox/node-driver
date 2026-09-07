import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HttpAdapter, HttpAdapterNotConfiguredError } from '@/adapters/HttpAdapter';
import { SampleAdapter, MAIN_DRIVERS, CHILDREN, IDENTITY } from '@/adapters/SampleAdapter';
import { useEnsemble } from '@/hooks/useEnsemble';
import type { DriverNode, EnsembleIdentity } from '@/types/ensemble';

class CountingSampleAdapter extends SampleAdapter {
  expandCalls = 0;

  override async expandNode(nodeId: string): Promise<DriverNode[]> {
    this.expandCalls++;
    return super.expandNode(nodeId);
  }
}

describe('SampleAdapter', () => {
  it('returns ensemble identity', async () => {
    const adapter = new SampleAdapter();
    const identity = await adapter.getIdentity();
    expect(identity.id).toBe(IDENTITY.id);
    expect(identity.name).toBe(IDENTITY.name);
  });

  it('returns main drivers only — no pre-loaded children', async () => {
    const adapter = new SampleAdapter();
    const drivers = await adapter.getMainDrivers();
    expect(drivers.length).toBe(MAIN_DRIVERS.length);
    for (const driver of drivers) {
      expect(driver.children).toBeUndefined();
    }
  });

  it('lazy-loads nested activity sub-nodes on expand', async () => {
    const adapter = new SampleAdapter();
    const children = await adapter.expandNode('hemisphere-claude');
    expect(children.length).toBe(CHILDREN['hemisphere-claude'].length);
    expect(children[0].id).toBe('claude-act-1');
    expect(adapter.wasExpanded('hemisphere-claude')).toBe(true);
  });

  it('returns empty array for nodes without children', async () => {
    const adapter = new SampleAdapter();
    const children = await adapter.expandNode('human-01');
    expect(children).toEqual([]);
  });

  it('returns empty array for expandable node with hasChildren but no sub-nodes', async () => {
    const adapter = new SampleAdapter();
    const children = await adapter.expandNode('motor-watchdog');
    expect(children).toEqual([]);
    expect(adapter.wasExpanded('motor-watchdog')).toBe(true);
    expect(CHILDREN['motor-watchdog']).toBeUndefined();
  });

  it('covers all four node roles in main drivers', async () => {
    const adapter = new SampleAdapter();
    const drivers = await adapter.getMainDrivers();
    const roles = new Set(drivers.map((d) => d.role));
    expect(roles.has('human')).toBe(true);
    expect(roles.has('hemisphere')).toBe(true);
    expect(roles.has('connection')).toBe(true);
    expect(roles.has('motor')).toBe(true);
  });

  it('deep-clones bodyState so callers cannot mutate shared refs', async () => {
    const adapter = new SampleAdapter();
    const drivers = await adapter.getMainDrivers();
    drivers[0].bodyState.state = 'mutated';
    expect(MAIN_DRIVERS[0].bodyState.state).toBe('present');

    const children = await adapter.expandNode('hemisphere-claude');
    children[0].bodyState.state = 'mutated';
    expect(CHILDREN['hemisphere-claude'][0].bodyState.state).toBe('complete');
  });

  it('lists human role first in main drivers', async () => {
    const adapter = new SampleAdapter();
    const drivers = await adapter.getMainDrivers();
    expect(drivers[0].role).toBe('human');
  });
});

describe('useEnsemble lazy expand cache', () => {
  it('does not call expandNode again on collapse then re-expand', async () => {
    const adapter = new CountingSampleAdapter();
    const { result } = renderHook(() => useEnsemble(adapter));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleExpand('hemisphere-claude', true);
    });
    expect(adapter.expandCalls).toBe(1);
    expect(result.current.expandedIds.has('hemisphere-claude')).toBe(true);

    await act(async () => {
      await result.current.toggleExpand('hemisphere-claude', true);
    });
    expect(result.current.expandedIds.has('hemisphere-claude')).toBe(false);

    await act(async () => {
      await result.current.toggleExpand('hemisphere-claude', true);
    });
    expect(adapter.expandCalls).toBe(1);
    expect(result.current.expandedIds.has('hemisphere-claude')).toBe(true);
  });

  it('keeps expanded state with empty children after expandNode returns []', async () => {
    const adapter = new SampleAdapter();
    const { result } = renderHook(() => useEnsemble(adapter));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleExpand('motor-watchdog', true);
    });

    expect(result.current.expandedIds.has('motor-watchdog')).toBe(true);
    const watchdog = result.current.drivers.find((d) => d.id === 'motor-watchdog');
    expect(watchdog?.children).toEqual([]);
  });
});

describe('useEnsemble error handling', () => {
  it('surfaces adapter load failures on first load', async () => {
    const adapter = {
      getIdentity: () => Promise.reject(new Error('Adapter offline')),
      getMainDrivers: () => Promise.reject(new Error('Adapter offline')),
      expandNode: () => Promise.resolve([]),
    };
    const { result } = renderHook(() => useEnsemble(adapter));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Adapter offline');
    expect(result.current.drivers).toEqual([]);
    expect(result.current.identity).toBeNull();
  });

  it('retains last-good drivers and expanded state when refresh fails', async () => {
    let failRefresh = false;

    class FlakyAdapter extends SampleAdapter {
      override async getIdentity() {
        if (failRefresh) throw new Error('Adapter offline');
        return super.getIdentity();
      }

      override async getMainDrivers() {
        if (failRefresh) throw new Error('Adapter offline');
        return super.getMainDrivers();
      }
    }

    const adapter = new FlakyAdapter();
    const { result } = renderHook(() => useEnsemble(adapter));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.drivers.length).toBe(MAIN_DRIVERS.length);

    await act(async () => {
      await result.current.toggleExpand('hemisphere-claude', true);
    });
    expect(result.current.expandedIds.has('hemisphere-claude')).toBe(true);

    failRefresh = true;

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe('Adapter offline');
    expect(result.current.drivers.length).toBe(MAIN_DRIVERS.length);
    expect(result.current.identity?.name).toBe(IDENTITY.name);
    expect(result.current.expandedIds.has('hemisphere-claude')).toBe(true);
  });

  it('clears expanding state but keeps roster when expand fails', async () => {
    class ExpandFailAdapter extends SampleAdapter {
      override async expandNode(): Promise<DriverNode[]> {
        throw new Error('Expand failed');
      }
    }

    const adapter = new ExpandFailAdapter();
    const { result } = renderHook(() => useEnsemble(adapter));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const driverCount = result.current.drivers.length;

    await act(async () => {
      await result.current.toggleExpand('hemisphere-claude', true);
    });

    expect(result.current.error).toBe('Expand failed');
    expect(result.current.drivers.length).toBe(driverCount);
    expect(result.current.expandingIds.has('hemisphere-claude')).toBe(false);
    expect(result.current.expandedIds.has('hemisphere-claude')).toBe(false);
  });
});

describe('HttpAdapter stub', () => {
  it('throws HttpAdapterNotConfiguredError on getIdentity', async () => {
    const adapter = new HttpAdapter({ baseUrl: 'http://localhost:8787' });
    await expect(adapter.getIdentity()).rejects.toThrow(HttpAdapterNotConfiguredError);
  });

  it('throws on expandNode with encoded id', async () => {
    const adapter = new HttpAdapter({ baseUrl: 'http://localhost:8787/' });
    await expect(adapter.expandNode('hemisphere/claude')).rejects.toThrow(/stub/);
  });
});

describe('ensemble types smoke', () => {
  it('constructs a valid DriverNode shape', () => {
    const node: DriverNode = {
      id: 'test',
      name: 'Test',
      purpose: 'Smoke test node',
      role: 'motor',
      bodyState: {
        state: 'idle',
        activityLine: 'none',
      },
    };
    expect(node.bodyState.state).toBe('idle');
  });

  it('constructs a valid EnsembleIdentity shape', () => {
    const identity: EnsembleIdentity = {
      id: 'x',
      name: 'Test Ensemble',
    };
    expect(identity.name).toBe('Test Ensemble');
  });
});
