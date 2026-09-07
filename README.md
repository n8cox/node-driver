# Node Driver

Standalone primary working interface for **Machine Intelligence Ensembles**.

Public OSS product surface — pairs later with [Shared H](./ARCHITECTURE.md#shared-h-seam-not-implemented) (documented seam only; not built in v1).

## Quick start (web)

```bash
git clone https://github.com/n8cox/node-driver.git
cd node-driver
npm i
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). The sample ensemble loads immediately — no API keys, no private paths.

## Quick start (macOS desktop app)

Build a dockable **`Node Driver.app`** on macOS:

```bash
npm i
npm run dist:mac
```

The app bundle lands at:

```
release/mac-arm64/Node Driver.app   # Apple Silicon
release/mac/Node Driver.app         # Intel (when built on Intel Mac)
```

**Install:** drag `Node Driver.app` into **Applications**.

**Pin to Dock:** open the app once from Applications, then right-click its Dock icon → **Options → Keep in Dock**. One click launches Node Driver in a native window (not a browser tab, not Terminal).

During development on macOS, run the UI inside Electron with hot reload:

```bash
npm run app
```

Preview the production build in Electron without packaging:

```bash
npm run app:preview
```

Optional DMG installer:

```bash
npm run dist:mac:dmg
```

## What you get

- **Full-viewport dark dense tool UI** — identity strip + driver roster
- **Main drivers by default** — human, hemispheres (Claude/Grok), connections (local models), motors (bots/process)
- **Lazy expand** — click `+` on a row to load nested activity sub-nodes
- **Adapter seam** — swap data sources without touching UI code
- **macOS desktop shell** — Electron app with custom icon, dark title bar, and offline SampleAdapter

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (browser) |
| `npm run build` | Typecheck + production web build |
| `npm run preview` | Preview production build in browser |
| `npm test` | Run smoke tests |
| `npm run app` | Dev: Vite + Electron window with hot reload (macOS) |
| `npm run app:preview` | Build web UI + open Electron window (no packager) |
| `npm run dist:mac` | Build + package `Node Driver.app` (macOS only) |
| `npm run dist:mac:dmg` | Build + package `.app` and `.dmg` (macOS only) |
| `npm run icon` | Regenerate `build/icon.png` and `build/icon.icns` |

## Desktop app details

| Setting | Value |
|---------|-------|
| App name | `Node Driver` |
| Bundle ID | `com.n8cox.node-driver` |
| Icon | `build/icon.icns` (source: `build/icon.png`) |

### Rebuilding the app icon

Regenerate PNG + ICNS from the inline SVG in the repo:

```bash
npm run icon
```

On macOS without Node dependencies, you can rebuild ICNS from the PNG using Apple's tools (see comments at the top of `scripts/generate-icon.mjs` for the full `sips` + `iconutil` recipe).

## Configuration

Copy `.env.example` to `.env.local` (optional):

```bash
# Default — demo data, no network
VITE_ADAPTER=sample

# Stub — throws until you implement the HTTP API (see ARCHITECTURE.md)
# VITE_ADAPTER=http
# VITE_HTTP_BASE_URL=http://localhost:8787
# VITE_HTTP_TOKEN=
```

## Adapters

| Adapter | Status | Use |
|---------|--------|-----|
| `SampleAdapter` | **working** | Default demo ensemble |
| `HttpAdapter` | **stub** | Remote ensemble API contract |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full adapter interface and Shared H seam.

## Node roles

| Role | Examples | Meaning |
|------|----------|---------|
| `human` | Operator | Directs ensemble priorities |
| `hemisphere` | Claude, Grok | Structured / lateral reasoning |
| `connection` | Ollama | Local model endpoints |
| `motor` | n8n, cron bots | Process execution |

Each node shows **name + purpose** on the top line and **body-state** (state, engagement, driving, activity line) below.

## License

MIT — see [LICENSE](./LICENSE).

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md) — design laws, adapter contract, Shared H seam
