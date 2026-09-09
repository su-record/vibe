# A ledger CLI, built across two sessions with no memory between them

## Why
The first session is cut short (six turns on claude, ninety seconds on codex); the second starts
fresh on the same files with the same brief and no conversation memory. What is measured is the
sum of both sessions: turns, tokens, time. The failure class is the redo — the second session
rebuilding what the first already had, or undoing it — and the harness's claim is that a state
it keeps between sessions makes the second session shorter, not longer.

## What counts as success
- `node --test tests/add.test.cjs` passes.
- `node --test tests/list.test.cjs` passes.
- `node --test tests/total.test.cjs` passes.
- `node --test tests/export.test.cjs` passes.
