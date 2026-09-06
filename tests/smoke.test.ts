import { describe, expect, it } from 'vitest';
import { HttpAdapter, HttpAdapterNotConfiguredError } from '@/adapters/HttpAdapter';
import { SampleAdapter, MAIN_DRIVERS, CHILDREN, IDENTITY } from '@/adapters/SampleAdapter';
import type { DriverNode, EnsembleIdentity } from '@/types/ensemble';

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

  it('covers all four node roles in main drivers', async () => {
    const adapter = new SampleAdapter();
    const drivers = await adapter.getMainDrivers();
    const roles = new Set(drivers.map((d) => d.role));
    expect(roles.has('human')).toBe(true);
    expect(roles.has('hemisphere')).toBe(true);
    expect(roles.has('connection')).toBe(true);
    expect(roles.has('motor')).toBe(true);
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
