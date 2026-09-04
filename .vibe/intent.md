# vibe 4 · 4.1.6 — `vibe size`, and a limit per file instead of a total

## Why
A total line cap punishes the harness for doing more; a cap per file and per function keeps every piece readable, which is what the cap was for. The same rule is useful in any project, so it becomes a built-in check that a scenario can bind, and the scope skill proposes it whenever an intent writes code. The CLI, the one file over the new limit, is split into command modules.

## What counts as success
- `vibe size [paths] [--max-file N] [--max-function M]` counts files and functions across ts/js/py and more, ignores strings, comments and nested template literals when matching braces, skips tests and node_modules, and exits 1 with a list when anything is over.
- This repository passes its own rule: no file over 400 lines, no function over 50, across src, hooks and the bundle server.
- The scope skill proposes a size scenario for code-writing intents; the help and README describe it.
- Earlier gates still hold: build, tests, card ≤ 1KB, six common skills ≤ 300 lines, plugin tree current.

## Constraints
- The total is no longer capped; only files and functions are.
- Every record is English; the model talks to the user in the user's language.
