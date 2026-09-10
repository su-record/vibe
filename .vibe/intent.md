# vibe 4 · 4.1.25 — the bench measures the whole flow: vibe scopes for itself, and a task changes hands

## Why
Five trap tasks in a row — a hidden file, a shared helper, forty modules, a reset in the path, missing terms — were solved by the bare frontier models, and `ask` fell once its fake user answered fairly. The bench has been measuring only the build stage: the `on` arm receives the judge's own intent and scenarios, so discover and scope — where vibe says what counts as success, profiles the sample, names the unknowns and binds each scenario to a check — have never been measured at all. What vibe prevents, if anything, is in that stage and in what survives between sessions and clients; what it costs there is unknown.

## What counts as success

### A · An arm that scopes for itself
- `bench/run.js --harness scoped`: the workspace carries the card, skills and hooks like `on`, but no intent. The agent starts from TASK.md with `vibe state` saying `discover`; it runs discover and scope itself — `vibe profile` on the sample, `vibe intent draft`, `vibe intent analyze` — and `tokens off` approves without a human. The judge's intent and scenarios stay hidden until judge time, as for every arm; the judge scores with its own scenarios after `draftAndApprove` replaces the agent's. The ledger line carries `harness: scoped` and `scoped: { scenarios, checks }` — how many scenarios the agent wrote and which check types.
- The gate treats `scoped` as a third arm: per task and client, `scoped` checks not worse than `off`, and its tokens reported. `vibe ledger compare --by harness` already separates it.

### B · Two tasks where scoping is the work
- `anomaly`: a week's orders as a CSV the brief calls "this week's export"; the file holds a duplicated order id, a refund as a negative amount and one row in another currency, and a `docs/finance.md` that says how each is settled — none of it in the brief. The judge expects the settlement that follows the document. `vibe profile` names the duplicate, the negative and the mixed currency before the interview; the discover skill says anomalies come first.
- `handover`: `session-split` on two clients — the first session on one client (cut at a third), the second on the other with no memory and only the files; the `on` arm's second session reads the state, the bare arm's reads the tree. `bench/run.js` takes `--client claude:codex` for a two-client task; the ledger sums both. Judge: the tests.

### C · The direction rule, restated for three arms
- A task separates when `on` or `scoped` scores higher on checks than `off` on at least one client, not worse on the others, with turns at most 2× `off`. `session-split` and `handover` hold when `on` is not worse and spends no more tokens. A task no arm separates on is named and retired, as before.

### D · The rest of the bench, once more
- Every set reruns on both clients across `off`, `on` and `scoped` where the task admits it; the gate is the release condition; `bench/claims/2026-09-09-4.1.25.md` pre-registers the rules before the run. README's opening is rewritten from the numbers, and says what scoping cost and what it caught.

### G · What an outside review found, and the release's own defects
- A review of the gate and the ledger (Codex, 2026-09-09) reproduced three: rows with an `error` were counted toward the minimum-run requirement while being excluded from the verdict, so missing evidence passed; the direction branch checked `on > off || scoped > off` first, so a scoped improvement made the `on` regression check unreachable; `compare()` cast three arms to a two-element tuple and `pairedOnly()` returned unfiltered rows when a third arm was present, so a three-arm comparison judged the first two and `--paired` stopped pairing. All three are fixed with tests, and the release gate now requires five usable runs per required arm and a finite value for every gated metric.
- Found while measuring: `checks/suite-under-load.js` reported success when a child exited non-zero without printing a failure pattern (a child that never started); the load check now fails on the exit code itself.
- Reported by a user: the `PreToolUse` hook blocked `vibe authorize` — the very command its own message asks for — and any command naming a path such as `.vibe/doc-reset`, because the action words matched anywhere in the string. The hook no longer gates a `vibe` command, nor an action word that is part of a longer token; `npm run reset-data`, `prisma migrate reset`, `rm -rf` and `git push` are still gated, `pg_restore` included.
- Found by the same review: project discovery skipped its home boundary when the search started at the home, so a test whose working directory was its own fixture home climbed out and wrote records into the real `/home/ubuntu/.vibe` (and, earlier, `/tmp/.vibe`). Discovery and creation now stop at the passed home, the real OS home and the system temp root, and creating a project in any of them is refused.
- The token policy defaults to `off` by the user's decision: a plain yes approves and the hook only warns; `irreversible` and `strict` are opt-in.

## Constraints
- Patch version 4.1.25; files ≤ 400 lines, functions ≤ 50; card ≤ 1024 bytes; six skills ≤ 300 lines.
- No release until the gate passes and the check is DONE.
