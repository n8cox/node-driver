# Pulse Board (pointer)

**This folder is a pointer only.** The Pulse Board app no longer lives in Node Driver.

The canonical source is the standalone repository:

**https://github.com/n8cox/pulse-board** (main @ `3338bfd`)

## Clone and run

```bash
git clone https://github.com/n8cox/pulse-board.git
cd pulse-board
npm i
npm run dev    # http://localhost:5173
npm test
npm run build
```

Ship gate: `npm i && npm test && npm run build` — all green.

## Why this pointer exists

Node Driver keeps a thin link here so ensembles and docs can still find Pulse Board from the monorepo path without maintaining a duplicate copy. All development, CI, and releases happen in [n8cox/pulse-board](https://github.com/n8cox/pulse-board).

## Related

- [Node Driver](https://github.com/n8cox/node-driver) — ensemble working interface
