# Architecture

Node Driver is the standalone primary working interface for **Machine Intelligence Ensembles** — a public OSS surface for observing and operating multi-agent ensembles without private Alignment ceremony dependencies.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Identity strip (ensemble name, adapter, refresh)          │
├─────────────────────────────────────────────────────────────┤
│  Roster — main drivers (lazy expand → activity sub-nodes)   │
│    human · hemisphere · connection · motor                  │
└─────────────────────────────────────────────────────────────┘
         ▲                              │
         │ EnsembleAdapter              │ future
         │                              ▼
   SampleAdapter / HttpAdapter    ┌──────────────┐
                                  │  Shared H    │  ← seam only (not built)
                                  └──────────────┘
```

## Two projections of one node space

**Design law (Nathan, 2026-07-01): "Node Driver is the linear expression of the node graphs."**

The canvas and the driver are two projections of ONE node space. The graph is thought in its
native shape; the outline is the same graph linearized to be read. Anything expressible in one
projection must be expressible in the other — as a law of the system, not a bridged exception.

| Projection | Surface | Adapter methods |
|---|---|---|
| **Outline** | Nested bullets that edit like an outliner. The working surface. | `getOutline` / `applyOutlineDiff` |
| **Roster** | The same space grouped by who is driving. Read-only. | `getMainDrivers` / `expandNode` |

The outline is the **spine**: a strict tree, because outlines must edit like outlines. Edges a
tree traversal cannot hold are `Correlation`s — a second class of edge, carried in the snapshot
and never part of the parent chain. Rendering them extra-dimensionally is not yet built.

### Editing grammar

Every keystroke maps to a pure function in `src/outline/ops.ts` that returns an `OutlineDiff`
(`{ upsert, remove }`) — the exact wire shape the backend accepts. The behaviour under test and
the behaviour on screen are the same function.

| Key | Operation |
|---|---|
| `Enter` | New sibling below — or first child when the subtree is open |
| `Enter` on an empty nested line | Outdent (the double-Enter list idiom) |
| `Tab` / `Shift-Tab` | Indent / outdent |
| `Backspace` on an empty line | Delete, **promoting children** into the freed slot |
| `Backspace` at line start | Merge into the previous line (declines when the line has children) |
| `Alt+Shift+Up/Down` | Reorder among siblings; the subtree travels along |

Writes are **optimistic**: the diff is applied locally, then persisted. A failed write rolls the
outline back to exactly its prior state — an edit that did not survive must not keep looking like
it did. Lines the backend refuses are reported rather than silently dropped.

| `⌘Z` / `⌘⇧Z` | Undo / redo, 100 structural steps |
| `⌘C` / `⌘X` / `⌘V` | Copy / cut / paste the bullet and its subtree (only with no text selected) |

### Why writes stay small

The backend rewrites the entire outline file on every op. Two consequences shape this code:

- **Text is debounced.** Persisting each keystroke would cost one full rewrite per character.
  Text coalesces after a pause and flushes before any structural change.
- **Orders are sparse.** A new line takes the midpoint of the gap between its neighbours, so an
  insert writes ONE line. Renumbering a sibling list to 1..n would rewrite every root line — 43 of
  them on the live outline — for a single `Enter`. The renumber survives only as the fallback for
  when a gap really has closed.

Undo is a bounded snapshot stack; a restore is *differenced* against the current outline so it
travels in the same `{ upsert, remove }` vocabulary and never rewrites untouched lines.

### Data from the live outline is not uniform

The outline is years of writes from many tools. It contains lines with no `text`, no `order` and no
`author`. Everything is normalised at the adapter boundary (`normalizeOutlineLines`) so the UI can
trust its own types — the first consumer that forgot to guard crashed the whole view on a
`.toLowerCase()` of `undefined`.

Not yet built: drag-to-reorder, token chunking, and the extra-dimensional rendering of correlations
(they are carried in the snapshot, not yet drawn).

## Design laws

1. **Main drivers only by default** — the roster loads top-level ensemble members. Nested activity sub-nodes are not fetched until the operator expands a row.
2. **Node presentation** — each node shows:
   - **Top line:** name + purpose
   - **Body-state:** state, optional engagement, optional driving flag, activity line
3. **Roles** (literal, no stage metaphors):
   - `human` — operator on the top line of authority
   - `hemisphere` — Claude, Grok, and similar reasoning models
   - `connection` — local model endpoints (Ollama, etc.)
   - `motor` — bots and process runners (n8n, cron, etc.)
4. **Human-first roster order** — main drivers render with the `human` role first, then hemispheres, connections, and motors. Adapters should return drivers in this order; the UI does not re-sort.
5. **No Alignment ceremony** — no wake flows, no personal paths, no private secrets. Clone and run with `npm i && npm run dev`.
6. **Literal copy** — UI strings describe what nodes are and do; avoid theatrical or metaphorical language.

## Adapter seam

All ensemble data flows through `EnsembleAdapter`:

```typescript
interface EnsembleAdapter {
  getIdentity(): Promise<EnsembleIdentity>;
  getMainDrivers(): Promise<DriverNode[]>;
  expandNode(nodeId: string): Promise<DriverNode[]>;
}
```

### SampleAdapter (default)

Ships demo data. Used when `VITE_ADAPTER=sample` (default). No network required.

### HttpAdapter

Fetches live roster data from an Alignment ensemble HTTP API:

| Method | Path | Returns |
|--------|------|---------|
| *(static)* | — | `EnsembleIdentity` (until identity endpoint exists) |
| GET | `/api/ensemble/main-drivers` | Alignment main driver JSON → mapped `DriverNode[]` |
| GET | `/api/ensemble/main-drivers/:id/facet` | Facet children → mapped activity `DriverNode[]` |

Set `VITE_ADAPTER=http` and optionally `VITE_HTTP_BASE_URL` (default `http://127.0.0.1:3001`) / `VITE_HTTP_TOKEN`. Requests send `Accept: application/json` and an optional `Authorization: Bearer` header.

Alignment JSON is mapped in `alignmentMapper.ts`: `roleKind: bot` → `motor`, flat state fields → `bodyState`, drivers sorted human → hemisphere → connection → motor.

**Runtime override:** baked Electron builds can switch adapters via `localStorage` keys (`node-driver:adapter`, `node-driver:http-base-url`, `node-driver:http-token`) without rebuilding.

### Adapter response shapes

v1 adapters expose identity and main drivers through separate methods (`getIdentity`, `getMainDrivers`). A combined `{ identity, drivers }` snapshot may appear in a future batch HTTP endpoint but is not a v1 type.

## Shared H seam (not implemented)

**Shared H** is the companion spatial canvas for ensemble topology — a separate product surface that will pair with Node Driver later.

Node Driver v1 **documents this seam only**. It does not embed an H canvas, import H dependencies, or assume H is running.

### Planned integration points

| Seam | Direction | Purpose |
|------|-----------|---------|
| Selection sync | H → Driver | Selecting a node on H highlights the matching roster row |
| Selection sync | Driver → H | Expanding a driver in the roster focuses the corresponding H subgraph |
| Identity | shared | Both surfaces read the same `EnsembleIdentity` via adapter or event bus |
| Layout | H only | Spatial layout, edges, and grouping live exclusively on H |

Implementation approach (future):

1. Extract a thin `@ensemble/core` types package shared by Driver and H.
2. Add an optional `EnsembleEventBus` adapter decorator for cross-surface selection.
3. Keep Driver fully usable without H — H is an optional second viewport, not a dependency.

## UI structure

| Component | Responsibility |
|-----------|----------------|
| `IdentityStrip` | Product label, ensemble name/description, adapter badge, refresh |
| `Roster` | Main driver list header and container |
| `DriverNodeRow` | Single node row with expand control and recursive children |
| `BodyStateLine` | Formatted body-state fields |

## Lazy drill

Expand (`+`) on a row with `hasChildren: true` calls `adapter.expandNode(id)` **only when children are not yet cached**. Children render indented under the parent. Collapse (`−`) hides loaded children without discarding cached data — re-expanding a collapsed row reuses the cached children and does not call `expandNode` again. A loading indicator (`…`) shows while the adapter resolves a first-time expand.

## Tech stack

- Vite + React 19 + TypeScript
- Vitest for smoke tests
- MIT license

## Desktop shell (macOS)

Node Driver ships an optional **Electron** desktop shell for macOS. The packaged `Node Driver.app` loads the same Vite-built React UI inside a native window — no browser tab, no Terminal.

- **Default data:** `SampleAdapter` works offline; no API keys or network required.
- **No Alignment deps:** the shell does not import Alignment ceremony, private paths, or secrets.
- **Packaging:** run `npm run dist:mac` on macOS to produce `release/mac*/Node Driver.app`. See [README.md](./README.md) for install, Gatekeeper first-open, and Dock pinning.

The web dev path (`npm run dev`) remains the primary cross-platform workflow; the desktop shell is an additive delivery surface.

## Out of scope (v1)

- Porting Alignment v2/v3 UI or ceremony
- Real API keys or authenticated backends
- Shared H canvas implementation
- WebSocket live streaming (HttpAdapter is REST-shaped stub only)
