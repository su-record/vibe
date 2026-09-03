# vibe 4 · phase 3a — FDE check types and sample profiling

## Why
An FDE's scenarios are rarely "the tests pass". They are "the endpoint answers with this shape in under a second", "the extractor gets these labelled cases right", "the settlement sheet's total equals the bank statement". Until the harness can judge those itself, such scenarios fall to `human` and the verdict is a claim again. The interview also needs the sample read by code, not by the model: columns, types, empties, duplicates, with numbers the model can say first.

## What counts as success
- `http` checks run: status code, body against a JSON Schema, latency ceiling; a dead host fails with a reason.
- `eval` checks run: a JSONL case set through a runner's stdin/stdout, the verdict a count of matching cases against `expect.pass`, mismatches listed.
- `file` checks gain `sum`: a column total of a csv/tsv/jsonl/json table equals a reference value within a tolerance.
- `vibe profile <file>` reports rows, columns, types, missing values, duplicates and at most three anomalies with numbers; spreadsheets are refused with a CSV hint.
- Phase 1–2 gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines.

## Constraints
- No new dependency: tables are parsed by the harness (RFC 4180 CSV), HTTP uses Node's fetch, Excel is out of scope.
- Eval verdicts are counts, never ratios; model-graded evaluation stays advisory and is not implemented here.
- Every record is English; the model talks to the user in the user's language.
