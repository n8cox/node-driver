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
