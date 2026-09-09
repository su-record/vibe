# vibe 4 · 4.1.23 — DONE you can trust, a bench that cannot cheat, and commands that only do what they say

## Why
An outside diagnosis of 4.1.22 (a GPT report on commit 77682c4, 2026-09-09) named four holes in the core promise and one in the bench. Every one reproduced:
- `vibe check` after an edit: a passed file changed to wrong content, then the default `vibe check` — `r-2 · DONE · pass 0 · fail 0`. The verdict reused a result from a tree that no longer exists.
- Recheck order: with `--all`, a parent that had passed before failed now, and its dependent ran anyway — the gate read the previous results, not this run's.
- Approval not re-verified: scenarios.yaml edited after approval (a check swapped for a no-op) and `vibe check` still ran; a unit test even relies on it.
- The hook's read-only skip (4.1.22's own regression): `echo preview && git push …`, `ls; git push …`, `cat x | git push …`, `grep … && npm run reset-data`, `git log | head; rm -rf build` all pass under the `irreversible` policy because only the first word was judged. Before 4.1.22 a `git push` anywhere in the string was caught.
- The bench: `judge/` — the reference answer (`right.cjs`), the expected output, an intent that spells out the key — was copied into the `on` arm's workspace before the run. The transcripts say the arm read it: on Codex 5 of 5 `ask` runs read `expected.json`, `quote.cjs` and `right.cjs`; 5 of 5 `session-split` read `ledger.cjs`; 5 of 5 `brownfield` read `right.cjs`; on Claude 7 of 30 runs read something under `judge/`. Every `on`-arm number since 4.1.20 is suspect; the README's opening claims a separation on `ask` that the data cannot support.
Also true: the gate is not a release condition (only its self-test runs in `check --all`); a query like `vibe state` repairs the global install on the way (the reason `VIBE_SKIP_SETUP` exists); one vitest failed under `check --all`'s parallel load twice today and never alone — not yet identified.

The user's rule stands: one release with everything, one bench, one deploy — and no release until the measured promise is true.

## What counts as success

### A · DONE means this tree, these scenarios, this run
- A result is bound to the tree it passed on. `results.json` entries carry `tree`; a scenario whose result tree is not the current tree is stale and counts as not passed — the default `vibe check` selects it, `vibe state` lists it as remaining, and DONE needs every gate scenario passed on the current tree. The `r-2 · DONE · pass 0` case ends `RUNNING · pass 0` with `out` remaining.
- Approval is re-verified at check time: `vibe check` recomputes the intent + scenarios hash and refuses (exit 4, `approval void — scenarios changed since <hash>; vibe intent draft and approve again`) when it differs from the approved one. The test that edited scenarios.yaml mid-run is rewritten to redraft and approve.
- A dependent waits for its parents in this run: a parent that fails or is stale-and-not-selected blocks the child; only a parent that passed on the current tree, or in this run, lets it run. The child-ran case ends with `child` blocked.
- The hook judges every segment: a command is split on `&&`, `||`, `;`, `|` and newlines; the read-only skip applies only when every segment is read-only; an irreversible pattern in any segment gates. The five bypass commands exit 2 under `irreversible`; `grep -rn reset src/` alone still exits 0.
- Tests for the transitions the diagnosis found missing: edit-after-pass, parent-fails-on-recheck, scenario-swap-after-approval, compound commands — each a case in `check.test.ts` or `notify.test.ts`.

### B · A bench that cannot be read for the answer
- A task's directory is split: `checks/` (what a check needs to run — tests, verify scripts, schemas; copied to both arms), `key/` (the reference answer, the expected output, the fake user — never copied), and `judge/intent.md` + `judge/scenarios.yaml` (the on arm's intent, never a key in it). `run.js` and `direction-judges.js` copy `checks/` into both workspaces and read `key/` from the task directory only. A test proves a prepared `on` workspace holds no file from `key/` and no scenario text names a value from it (`checks/bench-judge.js` greps each intent for the key's values).
- The `ask` intent says what is unknown, not what it is. The `session-split` reference implementation and the `brownfield` reference patch live in `key/`.
- Both arms get identical files (TASK.md + `checks/`); the `on` arm adds `.vibe/` with the intent and scenarios, the card, the skills and the hook — vibe's own mechanism, nothing else.
- Every set reruns on the fair bench; results are recorded; the 4.1.22 claim files get a retraction note naming the contamination and the counts above; README's opening is rewritten from the fair numbers, and where nothing separates it says so.
- The gate is a release condition: `checks/bench-gate.js` on `bench/ledger.jsonl` is a `check --all` scenario, and the README promise is the gate's passing rules and nothing more. A release whose gate fails does not ship.

### C · Commands do only what they say
- Query commands never repair the install: `state`, `check`, `evidence`, `ledger`, `read`, `profile`, `map`, `symbols`, `callers`, `blast`, `context`, `conventions`, `intent show`, `inbox`, `regress list`, `skill list` run without touching `~/.claude` or `~/.codex`; `vibe status` says when the install is stale and `vibe update` / `vibe setup` repair it. `VIBE_SKIP_SETUP` is no longer needed for a query.
- One procedure, one source: the `next` line's wording is generated from one table in `src/core/procedure.ts`, and a check (`checks/procedure.js`) proves card rule 2, the router skill and README's flow block quote the same three sentences.

### D · The flaky test is found
- `npm test` runs under the load `check --all` applies (the suite twice in parallel, three times) until the failing test is named; it is fixed at the cause (a timing assertion measures against a baseline taken in the same process, or an order dependency is removed), and a regression is recorded.

## Constraints
- Patch version 4.1.23; files ≤ 400 lines, functions ≤ 50; card ≤ 1024 bytes; six skills ≤ 300 lines.
- No release until the fair bench has run and the gate passes; if it does not, the README says which rule fails and the release waits.
