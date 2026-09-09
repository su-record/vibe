# Brownfield — a `lines` rule for the `file` check, wired through the repository

## Why
One cross-cutting change in an existing codebase: the rule touches the scenario validation, the file check, the README and a skill. Finding those four places is the work; the change itself is small.

## What counts as success
- `parseScenarios` accepts `check: { type: file, path, lines: { max: N } }` with `lines` as the only rule.
- `fileCheck` fails a file with more than N lines with a reason that names the count, and passes one within it.
- The README check table's `file` row names `lines`.
- The scope skill's list of check types names `lines`.
- `npm run build` stays green and `vibe size src` stays within 400 / 50.
