# Pulse Board — Acceptance Criteria

Binary pass/fail. An ensemble **ships** only when **every** criterion passes. No partial credit.

## A. Environment

| ID | Criterion | Pass | Fail |
|----|-----------|------|------|
| A1 | Node ≥ 20 available | `node -v` prints v20+ | Older Node or missing |
| A2 | Clean install | `npm i` exits 0 | Non-zero exit or errors |
| A3 | No private Alignment deps | `package.json` has no `@alignment/*` or private registry deps | Any private dep present |

## B. Build & test

| ID | Criterion | Pass | Fail |
|----|-----------|------|------|
| B1 | Tests pass | `npm test` exits 0, all tests green | Any failure or non-zero exit |
| B2 | Production build | `npm run build` exits 0, `dist/` created | Non-zero exit or missing `dist/` |
| B3 | Typecheck | Build includes `tsc` with no errors | Type errors |

## C. Dev server

| ID | Criterion | Pass | Fail |
|----|-----------|------|------|
| C1 | Dev starts | `npm run dev` serves without error | Crash or hang |
| C2 | Page loads | Browser shows "Pulse Board" identity strip | Blank page or wrong app |
| C3 | Dark UI | Background is dark (`#0a0a0b` base), dense monospace labels | Light theme or broken layout |

## D. Card CRUD (manual browser)

| ID | Criterion | Pass | Fail |
|----|-----------|------|------|
| D1 | Add card | Submit form with title → card appears in grid | Card missing or error |
| D2 | Three statuses | Can create green, amber, and red cards with distinct badges (OK / WARN / FAIL) | Status missing or wrong label |
| D3 | Note line | Note text visible under title | Note missing |
| D4 | updatedAt | Each card shows a formatted timestamp | Timestamp missing |
| D5 | Edit card | Edit changes title/status/note and refreshes timestamp | Edit broken or no update |
| D6 | Remove card | Remove deletes single card | Card remains |
| D7 | Clear all | Clear all (with confirm) removes every card | Cards remain |

## E. Persistence

| ID | Criterion | Pass | Fail |
|----|-----------|------|------|
| E1 | Reload survives | Add card → hard refresh → card still present | Card lost on reload |
| E2 | Storage key | `localStorage.getItem('pulse-board:cards')` returns valid JSON array | Missing or corrupt |

## F. Documentation

| ID | Criterion | Pass | Fail |
|----|-----------|------|------|
| F1 | README checklist | README contains clone → npm i → dev → test → build steps | Missing or incomplete |
| F2 | Ensemble section | README has "How Node Driver ensembles use this lab" | Section missing |
| F3 | MIT license | LICENSE file present with MIT terms | Missing or wrong license |
| F4 | This file | ACCEPTANCE.md present with binary criteria | Missing |

## G. Validation (optional automation)

Run from `examples/pulse-board/`:

```bash
npm i && npm test && npm run build
echo "SHIP: $?"
```

Exit code **0** satisfies A2, B1, B2. Combine with manual D and E checks for full ship.

---

**Ship verdict:** PASS iff all A–F criteria pass. G is a convenience shortcut for A2+B1+B2 only.
