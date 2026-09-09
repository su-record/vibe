# Bench — does the harness change anything?

Same task, same judge, different arms. Nothing here is a claim; the verdict comes from `vibe ledger compare`.

```bash
node bench/run.js --client claude --harness on  --runs 5 --set all --parallel 4
node bench/run.js --client claude --harness off --runs 5 --set all --parallel 4
node bench/run.js --client codex  --harness on  --runs 5 --set all --parallel 4
node bench/run.js --client codex  --harness off --runs 5 --set all --parallel 4
vibe ledger compare --by harness --metric checks --ledger bench/ledger.jsonl
vibe ledger compare --by client  --metric checks --ledger bench/ledger.jsonl
vibe ledger compare --by harness --metric ms --paired --ledger bench/ledger.jsonl
vibe ledger compare --by harness --metric checks --task hidden-requirement --ledger bench/ledger.jsonl
```

`on` means the agent worked in a workspace with the vibe card, skills and an approved intent, so it could run `vibe check` itself. `off` means a bare workspace with only the task. The bench installs the card, skills and hook into the workspace itself for the `on` arm and sets `VIBE_SKIP_SETUP`, so the run never touches or repairs `~/.claude`. Both arms run under an isolated home (credentials copied in): the operator's own vibe plugin, skills and marketplace reach neither arm, so `off` is really off and `on` is only what the workspace carries. The judge runs the task's scenarios alone; a regression the agent recorded during its run is counted separately as `agentRegressions`, never as a passed check. In both arms the judge is the same: after the agent stops, the task's scenarios run through `vibe check --all` and one line per run lands in `bench/ledger.jsonl` with client, model, harness, turns, cost as the client reports it, tokens by kind, a recomputed cost, the agent's wall-clock time and whether every scenario passed.

## The tasks

`bench/tasks/` holds two sets, each task with `TASK.md` (what the agent is given) and `judge/` (`intent.md` and `scenarios.yaml` — what the harness judges it by, never shown as the prompt):

The **overhead set** — saturated on purpose, so a passing arm proves nothing about quality; it exists to measure what the harness costs:

- `settlement` — turn an order export into a settlement sheet; judged on a reference total and a schema, entirely by `file` checks.
- `vibe-fix` — fix a single deterministic defect in a tiny, self-contained JavaScript module (`settle.cjs`) so its test (`settle.test.cjs`) passes; judged by a `run` check that runs `node --test settle.test.cjs` itself.
- `report` — write a short markdown report from a given evidence file; judged by `file` checks: `absent: "@placeholders"` (no `[TODO]`, `TBD`, lorem ipsum, …), `traceable: evidence.md` (every number in the report must appear in the evidence) and a `pattern` for a required heading.

The **direction set** — each one the bare model is expected to get wrong at least some of the time, so a passing arm says something about quality, not just procedure:

- `hidden-requirement` — the brief names a file (`rates.json`) without saying to use it; the total is only right once the model reads it and converts by it.
- `regression-trap` — the obvious fix for one caller (`invoice.cjs`) touches a helper shared with another (`receipt.cjs`); the judge runs both callers' tests.
- `long-context` — forty small modules, three of which read a config flag the brief asks removed; the judge runs a test that fails while any reference to the flag remains and fails again if removing it changes behaviour.
- `ambiguous-brief` — a release note from a changelog with no word on audience or length; the judge's own intent fixes the sensible reading (a short heading, one line per entry, nothing invented, a line-count ceiling it enforces with a `run` check since a `pattern` cannot count lines well).

`node checks/bench-judge.js` enforces this: every task's judge is `file`-only, except where a task's own tests (or a script like `judge/lines.cjs`) are the judge, which may also carry `run` (`vibe-fix`, `regression-trap`, `long-context`, `ambiguous-brief`). No model-judged check (`review`, `human`) is ever accepted in the bench. `node checks/direction-judges.js` proves each direction task's judge actually tells the four tasks' obvious wrong answer from the right one, deterministically — no model runs.

`--set overhead|direction|all` runs a named group; `--task all` runs every directory under `bench/tasks/`, and a single `--task <name>` still runs one. `--parallel N` (default 4) runs that many agent invocations concurrently — real OS processes running side by side, not queued one after another — so a full sweep of tasks × runs stays under an hour.

## The numbers a run records

Beyond the base ledger fields, a bench line carries:

- `tokens` — `{ input, cacheRead, cacheWrite, output }`, read from the client's own JSON (claude: `-p --output-format json` usage; codex: the `turn.completed` event's usage under `--json`). `null` when the client didn't report it — never a guessed 0.
- `costRecomputed` — `(input + 0.1×cacheRead + 1.25×cacheWrite) × VIBE_BENCH_INPUT_PRICE` plus `output × VIBE_BENCH_OUTPUT_PRICE`, both prices per million tokens and read from those two environment variables. Unset either one (the default) and `costRecomputed` is `null`, not a $0 claim — nothing is invented.
- `ms` — the agent's own wall-clock time for the run (not the judge's check-execution time, which the base ledger line otherwise carries in this field).
- `armPassed` — whether every scenario in the run passed (`failed === 0`). Efficiency metrics (`ms`, cost) are only comparable between runs that both actually did the work — see `--paired` below.
- `pair` — `<task>#<index>`, the same run repeated across arms, so a paired comparison can line up "claude's 3rd `on` run" against "claude's 3rd `off` run".

## Comparing

`vibe ledger compare` takes `--metric checks|turns|cost|ms` and `--paired`. `--paired` keeps only runs that pair with a passing run in the other arm on the same task (by `pair`, or by task-and-order for a ledger written before this field existed) — efficiency numbers compared only where both arms actually passed. A comparison's arm summary also carries `costMismatch`: how many of that arm's runs had a `costRecomputed` more than 3× away from the client-reported `costUsd`, worth a second look before a cost claim is made.

A release note that claims a saving quotes the compare verdict, and the claim is written into the intent before the bench runs. A verdict of `inconclusive` or `insufficient-runs` is not a claim.

## The gate

`checks/bench-gate.js` reads `bench/ledger.jsonl` and requires every task's latest five runs for every arm that client has been benched with (four arms — claude/codex × on/off — or, when a client was never benched at all, just the arms that exist, so long as there are at least two to compare). Two rules, one per set:

- **Overhead** — per client, `on`'s mean checks-passed is never worse than `off`'s, `on` turns ≤ `off` turns + 4, and `on` ms ≤ `off` ms × 1.5.
- **Direction** — per client, `on` scores higher on checks than `off` for at least two of the four tasks; fewer than that names the tasks the bare model already gets right, as candidates for retirement from the set.

It exits 1 naming the set, the task and the client that failed a rule. It runs as a `vibe check --all` scenario, not in CI, because the bench itself spends real model tokens — CI never triggers a bench run.

`node checks/bench-gate.js --self-test` builds a temporary ledger and exercises three cases — a clean pass, a task missing from the ledger, and an `on` arm scoring worse than `off` — asserting the gate calls each one correctly, without touching the real `bench/ledger.jsonl`.
