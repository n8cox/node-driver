# Node Driver

Standalone primary working interface for **Machine Intelligence Ensembles**.

Public OSS product surface — pairs later with [Shared H](./ARCHITECTURE.md#shared-h-seam-not-implemented) (documented seam only; not built in v1).

## Quick start

```bash
git clone https://github.com/n8cox/node-driver.git
cd node-driver
npm i
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). The sample ensemble loads immediately — no API keys, no private paths.

## What you get

- **Full-viewport dark dense tool UI** — identity strip + driver roster
- **Main drivers by default** — human, hemispheres (Claude/Grok), connections (local models), motors (bots/process)
- **Lazy expand** — click `+` on a row to load nested activity sub-nodes
- **Adapter seam** — swap data sources without touching UI code

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm test` | Run smoke tests |

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
