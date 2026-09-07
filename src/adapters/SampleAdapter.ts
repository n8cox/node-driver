import type { EnsembleAdapter, OutlineWriteResult } from '@/adapters/EnsembleAdapter';
import type { DriverNode, EnsembleIdentity } from '@/types/ensemble';
import type { OutlineDiff, OutlineLine, OutlineSnapshot } from '@/types/outline';
import { applyDiff } from '@/outline/ops';

const IDENTITY: EnsembleIdentity = {
  id: 'sample-ensemble-01',
  name: 'Research Lab Ensemble',
  description: 'Local demo ensemble with human, hemispheres, connection, and motor nodes.',
};

/** Main drivers — no children pre-loaded. */
const MAIN_DRIVERS: DriverNode[] = [
  {
    id: 'human-01',
    name: 'Operator',
    purpose: 'Directs ensemble priorities and accepts final outputs',
    role: 'human',
    bodyState: {
      state: 'present',
      engagement: 'focused',
      driving: true,
      activityLine: 'Reviewing hemisphere synthesis draft',
    },
  },
  {
    id: 'hemisphere-claude',
    name: 'Claude',
    purpose: 'Structured reasoning and long-context synthesis',
    role: 'hemisphere',
    bodyState: {
      state: 'active',
      engagement: 'deep',
      driving: false,
      activityLine: 'Drafting architecture comparison matrix',
    },
    hasChildren: true,
  },
  {
    id: 'hemisphere-grok',
    name: 'Grok',
    purpose: 'Fast lateral reasoning and constraint probing',
    role: 'hemisphere',
    bodyState: {
      state: 'active',
      engagement: 'moderate',
      driving: false,
      activityLine: 'Stress-testing edge cases in routing logic',
    },
    hasChildren: true,
  },
  {
    id: 'connection-ollama',
    name: 'Ollama / llama3.2',
    purpose: 'Local inference connection — offline-capable models',
    role: 'connection',
    bodyState: {
      state: 'connected',
      driving: false,
      activityLine: 'Idle — model loaded, no pending requests',
    },
    hasChildren: true,
  },
  {
    id: 'motor-n8n',
    name: 'n8n Workflow Bot',
    purpose: 'Motor process — executes webhook chains and file transforms',
    role: 'motor',
    bodyState: {
      state: 'running',
      driving: false,
      activityLine: 'Polling ingest queue (0 pending)',
    },
    hasChildren: true,
  },
  {
    id: 'motor-watchdog',
    name: 'Watchdog Monitor',
    purpose: 'Motor process — health checks with no visible sub-activities',
    role: 'motor',
    bodyState: {
      state: 'watching',
      driving: false,
      activityLine: 'All checks passing — no drill-down activity',
    },
    hasChildren: true,
  },
  {
    id: 'motor-cron',
    name: 'Cron Sync Bot',
    purpose: 'Motor process — scheduled repo and index synchronization',
    role: 'motor',
    bodyState: {
      state: 'waiting',
      driving: false,
      activityLine: 'Next run in 14m',
    },
  },
];

/** Nested activity sub-nodes keyed by parent id. */
const CHILDREN: Record<string, DriverNode[]> = {
  'hemisphere-claude': [
    {
      id: 'claude-act-1',
      name: 'Context ingest',
      purpose: 'Load and chunk source documents',
      role: 'hemisphere',
      bodyState: {
        state: 'complete',
        activityLine: '12 documents indexed',
      },
    },
    {
      id: 'claude-act-2',
      name: 'Matrix draft',
      purpose: 'Produce structured comparison output',
      role: 'hemisphere',
      bodyState: {
        state: 'in progress',
        engagement: 'deep',
        activityLine: 'Row 4 of 7 — latency tradeoffs',
      },
    },
  ],
  'hemisphere-grok': [
    {
      id: 'grok-act-1',
      name: 'Constraint scan',
      purpose: 'Enumerate failure modes in adapter contract',
      role: 'hemisphere',
      bodyState: {
        state: 'in progress',
        activityLine: 'Found 3 ambiguous timeout paths',
      },
    },
  ],
  'connection-ollama': [
    {
      id: 'ollama-act-1',
      name: 'Model warm',
      purpose: 'Keep llama3.2 resident in VRAM',
      role: 'connection',
      bodyState: {
        state: 'steady',
        activityLine: '4.2 GB allocated',
      },
    },
    {
      id: 'ollama-act-2',
      name: 'Embed batch',
      purpose: 'Vectorize pending document chunks',
      role: 'connection',
      bodyState: {
        state: 'queued',
        activityLine: 'Waiting for upstream chunks',
      },
    },
  ],
  'motor-n8n': [
    {
      id: 'n8n-act-1',
      name: 'Webhook listener',
      purpose: 'Accept external trigger payloads',
      role: 'motor',
      bodyState: {
        state: 'listening',
        activityLine: 'Port 5678 — 0 req/min',
      },
    },
    {
      id: 'n8n-act-2',
      name: 'Transform chain',
      purpose: 'Normalize and route payload fields',
      role: 'motor',
      bodyState: {
        state: 'idle',
        activityLine: 'No active execution',
      },
    },
  ],
};

/** Simulated network delay for lazy expand (ms). */
const EXPAND_DELAY_MS = 280;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Deep-clone a driver node so bodyState and nested children do not share refs. */
function cloneDriverNode(node: DriverNode): DriverNode {
  return {
    ...node,
    bodyState: { ...node.bodyState },
    ...(node.children !== undefined
      ? { children: node.children.map(cloneDriverNode) }
      : {}),
  };
}

/** A small outline that demonstrates nesting, collapse, authorship, and status. */
const SAMPLE_OUTLINE: OutlineLine[] = [
  { id: 'o-1', parentId: null, order: 1, text: 'Ensemble priorities', author: 'operator', status: 'flag' },
  { id: 'o-1-1', parentId: 'o-1', order: 1, text: 'Land the outline projection', author: 'operator', status: 'half' },
  { id: 'o-1-2', parentId: 'o-1', order: 2, text: 'Keep the roster as a view of the same node space', author: 'operator', status: 'new' },
  { id: 'o-2', parentId: null, order: 2, text: 'Notes from the hemispheres', author: 'claude', collapsed: false, status: 'note' },
  { id: 'o-2-1', parentId: 'o-2', order: 1, text: 'The outline is the spine — a strict tree', author: 'claude', status: 'done' },
  { id: 'o-2-2', parentId: 'o-2', order: 2, text: 'Correlations are a second class of edge, off the page', author: 'claude', status: 'note' },
  { id: 'o-3', parentId: null, order: 3, text: 'Press Enter to add a line, Tab to indent', author: 'operator', status: 'new' },
];

/**
 * Sample adapter with realistic demo data.
 * Ships as the default — no API keys or private paths required.
 */
export class SampleAdapter implements EnsembleAdapter {
  private expanded = new Set<string>();
  /** In-memory outline so the demo is genuinely editable with no backend. */
  private outline: OutlineSnapshot = { rev: 1, lines: [...SAMPLE_OUTLINE], correlations: [] };

  async getIdentity(): Promise<EnsembleIdentity> {
    await delay(80);
    return IDENTITY;
  }

  async getMainDrivers(): Promise<DriverNode[]> {
    await delay(120);
    return MAIN_DRIVERS.map(cloneDriverNode);
  }

  async expandNode(nodeId: string): Promise<DriverNode[]> {
    await delay(EXPAND_DELAY_MS);
    this.expanded.add(nodeId);
    return (CHILDREN[nodeId] ?? []).map(cloneDriverNode);
  }

  async getOutline(): Promise<OutlineSnapshot> {
    await delay(90);
    return {
      rev: this.outline.rev,
      lines: this.outline.lines.map((l) => ({ ...l })),
      correlations: this.outline.correlations.map((c) => ({ ...c })),
    };
  }

  async applyOutlineDiff(diff: OutlineDiff): Promise<OutlineWriteResult> {
    await delay(40);
    this.outline = {
      ...this.outline,
      rev: this.outline.rev + 1,
      lines: applyDiff(this.outline.lines, diff),
    };
    return { rev: this.outline.rev };
  }

  /** Test helper — whether a node has been expanded. */
  wasExpanded(nodeId: string): boolean {
    return this.expanded.has(nodeId);
  }
}

/** Exported for smoke tests. */
export { MAIN_DRIVERS, CHILDREN, IDENTITY };
