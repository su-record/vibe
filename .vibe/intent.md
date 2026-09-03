# vibe 4 · phase 3c — the order-settlement example, end to end

## Why
The design's completion check for phase 3 is not a feature but a walkthrough: an order spreadsheet arrives, becomes a settlement sheet, goes to accounting, and the project-local skill created along the way survives the deletion check. Running it inside this repository proves the FDE check types, the profiler, the work graph, the irreversible marker and the skill lifecycle together, on real files.

## What counts as success
- `vibe profile` names the two planted anomalies in the example orders (a duplicate row, a missing amount) with their numbers.
- The settlement script exits 0; the `total` column of the sheet sums to the reference figure; the summary matches its JSON Schema; the row without an amount is listed for a person, not guessed.
- The send is marked irreversible; its dry run exits 0 without a token.
- A project-local skill created from the settle scenario is registered with its check and is kept by `vibe skill prune --dry-run`.
- Earlier gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines, six common skills ≤ 300 lines.

## Constraints
- The example has no dependency and writes only under `examples/order-settlement/out/` and `outbox/` (both ignored by git).
- The real send never runs in a check; only `--dry-run` does.
- Every record is English; the model talks to the user in the user's language.
