# A ledger CLI, started on one client and finished on another

## Why
The first session runs on Claude Code and is cut short (ten turns) — around a third of an eight-subcommand task; the second runs on Codex, fresh, on the same files with the same brief and no conversation memory. What is measured is the
sum of both sessions: turns, tokens, time. The failure class is the redo — the second session
rebuilding what the first already had, or undoing it — and the harness's claim is that a state
it keeps between sessions makes the second session shorter, not longer.

## What counts as success
- `node --test tests/add.test.cjs` passes.
- `node --test tests/list.test.cjs` passes.
- `node --test tests/total.test.cjs` passes.
- `node --test tests/export.test.cjs` passes.
- `node --test tests/remove.test.cjs`, `tests/stats.test.cjs`, `tests/import.test.cjs`, `tests/find.test.cjs` pass.
