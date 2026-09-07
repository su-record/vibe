# vibe 4 · 4.1.13 — the deterministic pre-gate: `file … absent` and the placeholder scenario

## Why
The `review` check is the verdict on human-read output, and a model's judgment is the right instrument for it. But some defects are not judgments: placeholder text left in (`Lorem ipsum`, `[TODO]`, `TBD`, `Your Company`, an unfilled `{{field}}`) and a writer's note to the model that was reprinted into the artifact. A regex catches those in a millisecond, deterministically, before a reviewer spends a call on them. The `file` check has only positive rules — exists, pattern, contains, schema, sum — so it cannot yet say "this must not appear". That is the one thing worth taking from the public skills' linters; the word lists and dash counts are not.

## What counts as success
- The `file` check gains `absent`: a regular expression that must match nowhere in the file. On a match the check fails with the reason `forbidden text present` and a tail naming the first three matches as `line N: <matched text>`; a bad expression fails as `bad absent`. `absent` counts as a rule for validation, so `{ type: file, path, absent }` alone is a complete check. README's check table names it.
- `vibe-scope`, wherever it proposes a `review` check (text or design), proposes the pre-gate next to it: `check: { type: file, path: <same file>, absent: "Lorem ipsum|\\[TODO\\]|\\bTBD\\b|Your Company|\\{\\{|\\[\\[" }`, and tells the writer that a note to the model belongs in `[[…]]` so the gate catches it if it survives into the artifact. For a design directory, the same as a `run` check with `grep -rlE`. The six common skills stay ≤ 300 lines.
- This repository gates its own human-read documents: a `no-placeholders` scenario runs `grep -rlE` for the same expression over `README.md`, `card.md` and the six common skills, and passes only when nothing matches. The packs and reviewers are excluded on purpose: they name these markers as examples.
- Tests: `absent` passes on a clean file, fails on a file with a placeholder with the line and text in the tail, reports a bad expression, and is accepted by validation as the only rule.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, skill names, packs, report voice, plugin tree current for 4.1.13, README status line carries `4.1.13`.

## Constraints
- No general slop linter: no word lists, no dash counts, no burstiness. `absent` is one regex the scenario author writes.
- The `review` check does not change.
- Every record is English; the model talks to the user in the user's language.
