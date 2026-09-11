# Remove the legacyMode flag

## Why
`legacyMode` is a config flag three of the forty modules under `src/` still branch on. It is
dead weight to keep reading through the whole tree for — the flag should go, and today's
behaviour (the modules as they run now, with legacyMode true) must not change.

## What counts as success
- `legacyMode` no longer appears in `config.cjs` or anywhere under `src/`.
- Every module in `src/` still returns exactly what it returns today.
