# Pulse Board

Tiny public OSS status board — the **0→ship build lab** for Machine Intelligence ensembles operating through [Node Driver](https://github.com/n8cox/node-driver).

Operators track a handful of cards (title, green/amber/red status, one-line note, `updatedAt`). Cards persist in **localStorage** (v1). Dark dense tool aesthetic matches Node Driver.

## 0→ship checklist

Use this exact sequence to prove a shippable build. Every step must exit **0**.

```bash
# 1. Clone (from monorepo path)
git clone https://github.com/n8cox/node-driver.git
cd node-driver/examples/pulse-board

# 2. Install
npm i

# 3. Dev server — open the URL Vite prints (default http://localhost:5173)
npm run dev

# 4. Tests
npm test

# 5. Production build
npm run build

# 6. (Optional) Preview production build
npm run preview
```

**Ship gate:** `npm i && npm test && npm run build` — all green.

Binary pass/fail criteria live in [ACCEPTANCE.md](./ACCEPTANCE.md).

## What you get

- Full-viewport **dark dense tool UI** (Node Driver palette)
- **Add / edit / remove** status cards in-browser
- **Clear all** with confirmation
- **localStorage** persistence across reloads
- **Vitest** smoke + unit tests
- **Zero private deps** — runs on a fresh machine with Node ≥ 20

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |

## Card model

| Field | Type | Rules |
|-------|------|-------|
| `title` | string | Required, trimmed, max 80 chars |
| `status` | `green` \| `amber` \| `red` | Required |
| `note` | string | Optional one-liner, max 120 chars |
| `updatedAt` | ISO 8601 string | Set automatically on create/edit |

Storage key: `pulse-board:cards`

## How Node Driver ensembles use this lab

This section is literal — follow it when routing an MI ensemble through Node Driver.

1. **Assign the exercise.** Tell the ensemble: *"Ship Pulse Board from empty repo to passing ACCEPTANCE.md. No Alignment private deps."*
2. **Point at the repo.** Clone `https://github.com/n8cox/node-driver` and work in `examples/pulse-board/` (or a fresh fork extracted to its own repo).
3. **Human sets acceptance.** The operator (human node) reads [ACCEPTANCE.md](./ACCEPTANCE.md) and treats every criterion as binary pass/fail — no partial credit.
4. **Ensemble builds.** Hemisphere nodes propose structure; motor nodes run `npm i`, `npm test`, `npm run build`; connection nodes may serve local previews. All changes stay in the lab directory unless extracting to a standalone repo.
5. **Prove ship.** The ensemble must produce:
   - Green CI commands (see checklist above)
   - A runnable dev server screenshot or recording (optional but recommended)
   - Updated README if behavior changed
6. **Operator verifies.** Human reloads the app, adds three cards (green/amber/red), refreshes the page, confirms persistence, then runs the acceptance checklist manually.
7. **Graduate or iterate.** Pass → ensemble demonstrated 0→ship. Fail → file defects against specific ACCEPTANCE.md criteria and re-run.

Node Driver itself is the **working interface** for the ensemble roster; Pulse Board is the **artifact under test**. Do not conflate the two products.

## Standalone repo (optional)

This lab lives at `examples/pulse-board/` inside [n8cox/node-driver](https://github.com/n8cox/node-driver). To extract:

```bash
# From a fresh directory
git clone --depth 1 --filter=blob:none --sparse https://github.com/n8cox/node-driver.git pulse-board
cd pulse-board
git sparse-checkout set examples/pulse-board
mv examples/pulse-board/* .
rm -rf examples
git init && git add . && git commit -m "Extract Pulse Board build lab"
```

Update `package.json` `repository.url` if publishing separately.

## License

MIT — see [LICENSE](./LICENSE).

## Related

- [Node Driver](https://github.com/n8cox/node-driver) — ensemble working interface
- [ACCEPTANCE.md](./ACCEPTANCE.md) — binary ship criteria
