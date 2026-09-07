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

**First open (unsigned build):** macOS Gatekeeper blocks apps that are not signed with a Developer ID. Right-click `Node Driver.app` → **Open** → **Open** in the dialog. You only need to do this once; after that, double-click works normally. To ship signed builds, add a Developer ID certificate to electron-builder (not configured in this OSS repo).

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

- **Two projections of one node space** — an editable **Outline** (the working surface) and the
  **Roster** (who is driving), switched from the tab strip
- **Outliner grammar** — `Enter` new line · `Tab`/`⇧Tab` indent/outdent · `⌥⇧↑↓` reorder ·
  `Backspace` on an empty line deletes and promotes its children · `Backspace` at line start merges
  up · click the chevron to fold
- **Optimistic edits** — typing never waits on the network, and a failed write rolls back rather
  than leaving a phantom edit on screen
- **Full-viewport dark dense tool UI** — identity strip + driver roster
- **Main drivers by default** — human, hemispheres (Claude/Grok), connections (local models), motors (bots/process)
- **Lazy expand** — click `▸` or press **Enter** on a focused row to load nested activity sub-nodes
- **Driving at a glance** — rows with `driving: true` show an amber **driving** badge, row highlight, and count in the identity strip + roster header
- **Keyboard-first** — **R** or **F5** refresh; **↑↓** move focus between rows; **Enter** expand/collapse activity
- **Honest states** — skeleton loading rows, empty roster message, error banner with **retry**
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

### Electron preload

The desktop shell uses a **CommonJS** preload script (`electron/preload.cjs`) with `require('electron')`. Sandboxed preload (required with `contextIsolation` + `sandbox: true`) does not support ESM `import` in `.mjs` files.

## Configuration

Copy `.env.example` to `.env.local` (optional):

```bash
# Default — demo data, no network
VITE_ADAPTER=sample

# Live Alignment roster (Nathan local setup on :3001)
# VITE_ADAPTER=http
# VITE_HTTP_BASE_URL=http://127.0.0.1:3001
# VITE_HTTP_TOKEN=
```

**Runtime override (Electron / baked builds):** set in DevTools console without rebuilding:

```js
localStorage.setItem('node-driver:adapter', 'http');
localStorage.setItem('node-driver:http-base-url', 'http://127.0.0.1:3001');
location.reload();
```

Use `sample` to revert to the demo ensemble.

## Adapters

| Adapter | Status | Use |
|---------|--------|-----|
| `SampleAdapter` | **working** | Default demo ensemble (OSS clone-and-run) |
| `HttpAdapter` | **working** | Live Alignment roster at `/api/ensemble/main-drivers` |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full adapter interface and Shared H seam.

## Node roles

| Role | Examples | Meaning |
|------|----------|---------|
| `human` | Operator | Directs ensemble priorities |
| `hemisphere` | Claude, Grok | Structured / lateral reasoning |
| `connection` | Ollama | Local model endpoints |
| `motor` | n8n, cron bots | Process execution |

Each node shows **name + purpose** on the top line and **body-state** (state, engagement, driving, activity line) below. Nested **activity** sub-nodes (loaded on expand) are indented with a guide rail and an `activity` tag.

## Operator shortcuts

| Key | Action |
|-----|--------|
| **R** or **F5** | Refresh ensemble (identity + main drivers) |
| **↑** / **↓** | Move focus between roster rows |
| **Enter** | Expand or collapse activity sub-nodes on the focused row |
| **Tab** | Move focus to the next row or control |

The roster header shows a keyboard hint when drivers are loaded. Driving members are highlighted in the strip and roster so you can scan who is steering in under two seconds.

## License

MIT — see [LICENSE](./LICENSE).

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md) — design laws, adapter contract, Shared H seam
- [Pulse Board](https://github.com/n8cox/pulse-board) — MI build-lab exercise (0→ship status board); pointer at [`examples/pulse-board/`](./examples/pulse-board/)
