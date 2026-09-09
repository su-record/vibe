# vibe 4 · 4.1.21 — the harness costs less than it saves, and a check observes: a `next` line, a fast path, a bench that tells the arms apart, and no check that mutates

## Why
The first clean bench (2026-09-09, 60 runs, both arms isolated) said what the harness costs today. Quality was identical — every arm passed every judge scenario — and the `on` arm spent 2–5× the turns and 2–3× the time and money. The workspace ledgers show where: an agent with an approved intent re-ran scope (a second `draft` and `approve` in most runs), ran `vibe check` five to eight times where one `check --all` would do, kept checking after DONE, wrote a HANDOFF.md nobody asked for, loaded ten skills to route through six, and recorded the task's own bug as a regression. None of that is judgment; it is procedure the card and the router ask for on every task regardless of size. On a task the bare model finishes in three turns, procedure is the whole bill.

The same bench said the tasks were saturated: nothing in them goes in a wrong direction, so the harness had nothing to prevent. vibe's aim is what the model misses — waste and wrong direction — and a bench that measures neither cannot judge a release. This release cuts the procedure to what a small task needs and gives the bench tasks the bare model gets wrong.

## What counts as success

### A · The harness says what to do next — the model stops reading skills to find out
- `vibe state` carries a `next` line, text and JSON: `next: build a, b, c — then vibe check --all` · `next: approve — show the draft and wait for "yes"` · `next: check --all — remaining d` · `next: report — DONE r-3; write HANDOFF.md only if the intent asks` · `next: answer inbox [q1]`. It names the stage skill only when the stage has a procedure the line cannot hold (discover, scope).
- The router skill routes by the `next` line: with an approved intent the model never re-enters scope (a second draft is the failure the ledger showed), and build/prove/handoff are followed from `next` without loading their skill files unless the `next` line names one. The six common skills stay ≤ 300 lines.
- `vibe state` also prints `size: small` when every remaining scenario's check is a `run` or `file` check with no `needs` chain deeper than one and the intent has at most four scenarios; `size: full` otherwise.

### B · The fast path for a small task
- On `size: small`: build every remaining scenario, then one `vibe check --all`; no per-scenario `vibe check`, no `vibe context` (a small task's files are the ones the model just wrote), no HANDOFF.md unless the intent names a handoff scenario, and after DONE no further check. The card says so in rule 2's own words: "one `check --all` at the end on a small task; per-scenario checks on a full one".
- Rule 6 is precise: a regression is recorded only for a failure `vibe check` reported and the model then fixed — the task's original defect is not one.
- The `on` arm of the bench installs the six common skills only; a pack is installed when the task's judge uses a `review` check (none does today).
- Pre-registered: on the overhead set, `on` turns ≤ `off` turns + 4 and `on` ms ≤ `off` ms × 1.5 for claude and for codex, `--paired`, five runs each; checks not worse. Reported as measured.

### C · A bench that tells the arms apart
- `bench/tasks/` gains a **direction set** the bare model is expected to fail at least some of the time, each with a deterministic judge: `hidden-requirement` (a constraint lives in a file the brief only names; the judge checks the converted total), `regression-trap` (the obvious fix for one caller breaks another; the judge tests both), `long-context` (forty files, three places to change, judged by tests), `ambiguous-brief` (an underspecified request whose sensible reading is fixed in the judge's intent; the judge checks the artefact). The existing three form the **overhead set**. `bench/run.js --set overhead|direction|all`.
- Pre-registered: on the direction set, `--metric checks` shows `difference-observed` with `on` higher for at least two of the four tasks per client; where it does not, the task is named as one the bare model already gets right and retired from the direction set.
- `vibe ledger compare` takes `--client <name>` and `--task <name>` filters, so the claim's per-client, per-task verdicts come from one ledger without temporary files; `checks/bench-gate.js` evaluates the overhead rule and the direction rule per set and names the task that fails either.
- The bench isolation already on this branch stays: both arms under a fresh home with credentials copied in, the judge counts the task's scenarios only, agent-recorded regressions counted apart.

### D · A check observes; a mutation needs a token
An incident on 2026-09-09: a project's regression `r-2` copied a `run` check whose command restored a database; `vibe check --all`, run after seeding, re-executed the restore and overwrote the seed account. The harness treated every `run` command as an observation; nothing marked a check as one that changes the world, `irreversible` only governed the build step's token, and a regression inherited whatever its source check did.
- `run` checks are parsed for mutation: a command matching the destructive patterns — `restore`, `reset`, `drop`, `truncate`, `seed`, `migrate` with `fresh`/`down`/`rollback`/`refresh`, `rm -rf`, `git push`, `deploy`, `publish`, `terraform apply`, `kubectl apply`/`delete`, `DROP`/`TRUNCATE`/`DELETE FROM` — is `irreversible` with the detected action unless the scenario declares its own `irreversible:`. `vibe state` shows it with the ⚠ the irreversible scenarios already carry and a notice: `<id> mutates (<action>) — not run by check --all without vibe authorize`.
- `vibe check --all` and `vibe check <id>` never execute an `irreversible` scenario without an `authorize` record for its action in the last ten minutes: the outcome is `blocked` with the reason `irreversible (<action>) — vibe authorize --action <action> first`, DONE stays out of reach until it passes, and the run is not STUCK for it.
- `vibe regress record` refuses a source check that is `irreversible`: `a regression must observe — <id> mutates (<action>); write a check that reproduces the failure without changing state`.
- `vibe-scope` says it in one line: a check observes; a command that changes state is declared `irreversible` or rewritten to observe (run against a copy, read the result).
- The incident is a test: a scenario whose check is `npm run db:restore && npm test` is blocked by `check --all` with the reason, runs after `vibe authorize --action restore`, and cannot become a regression.

### Gates
- build, tests, card ≤ 1KB (with the new rule 2 and rule 6 wording), file 400 / function 50, skill names, packs, report voice, no placeholders, no catalogue, Windows CI, plugin tree current for 4.1.21, README status line carries `4.1.21`.
- The bench itself runs after the release is built, as the claim says, and its result is written into `bench/claims/` before the tag; the numbers ship with the release note whichever way they fall.

## Constraints
- The verdict rule does not change: DONE only by `vibe check --all`; the fast path changes when checks run, never whether.
- One approval; no new dependency; the direction tasks are self-contained fixtures with deterministic judges — no model judges in the bench.
- Every record is English; the model talks to the user in the user's language.
