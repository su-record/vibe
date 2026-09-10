---
name: vibe-build
description: For a `size: full` task only — parallel worktrees, irreversible scenarios, a failed scenario's `vibe context`. A `size: small` task needs no skill — build everything, one `vibe check --all`.
user-invocable: false
---

# Build

## Procedure

0. Whatever the size: build every remaining scenario, then one `vibe check --all` — no check per scenario, no `vibe context` before building, no handoff document unless the intent names one. `vibe context <id>` and `vibe check <id>` are for a scenario that failed, and for a question the files do not answer. Steps 1–2 are for `size: full` — an irreversible scenario, a review/http/eval check, a needs chain two deep, or more than eight scenarios.
1. Take scenarios in the order of `remaining` from `vibe state --json` — parents before their `needs` dependents (`vibe state --graph` shows the edges). Put scenarios marked `irreversible` last.
   - Scenarios with no edge between them may be built by parallel agents, each in its own worktree, merged before `vibe check --all`. Never two agents in one working tree. Batch scenarios of one shape into one dispatch; never a nested subagent (a reviewer's reviewer counts for nothing). Hand artifacts to an agent as files, never pasted. When the context is nearly full, start a new session from `.vibe/` instead of compacting.
2. Build only what each scenario needs, and make sure the check itself (`check.cmd`, `check.path`) can actually run. `vibe map` and `vibe context {id}` are tools for a question — where a symbol lives, what a change reaches — not a step before every scenario.
   - Read fewer files from state, each in full (Claude Read; Codex `cat`); grep/rg/find locate files or lines, never substitute content slices. Over 400 lines when not editing: `vibe read <files> --ask "<question>"`.
3. When everything is built, `vibe check --all --json`; on a failure, fix what the check names — the failed line carries the scenario's files — and `vibe check {id} --json` for that scenario only; `vibe context {id}` when the files are not enough: the decisions, regressions and notes around them.
   - Pass (`code 0`): the next failing scenario, or `vibe check --all` when none is left.
   - Fail (`code 1`): use the error summary and named files; raw output requires explicit `--diagnostics` and stays private. The same failure twice requires `vibe context` and a changed approach; ask after five failed attempts or outside your authority, including the error and attempts.
   - Blocked (`status: blocked`): a parent has not passed; `vibe check {id}` runs unpassed parents first, so fix the parent named in `blockedBy`.
4. When a project-local skill (`vibe skill list`) applies to the scenario, follow it and run `vibe skill used {name}` — prune decisions read the ledger.
5. Record a fixed failure with `vibe regress record --scenario {id} --title "…" --check-from-evidence {run}`.
6. When `remaining` is empty, move to `vibe-prove`.

## Irreversible actions

Before actually executing an `irreversible` scenario (send, deploy, delete, spend):

```
vibe ask "{what is about to happen, one line}" --needs authorize:{action} --target "{target}" --json
```

If the response carries a token, show it to the user and execute only after they paste it and `vibe authorize "{number}" --action {action} --target "{target}"` exits 0 — as its own tool call, never chained in front of the action with `&&`: the hook reads the ledger before a command runs, so it blocks the chained command as unauthorized. If the project's token policy is `off`, the response has no token: run `vibe authorize --action {action} --target "{target}"` (recorded as auto) and proceed. Dry runs never need a token.

## Never

- Weaken a check to make it pass (editing scenarios.yaml voids the approval — the harness enforces this).
- Claim a pass without `vibe check`.
- Rely on Stop to run checks. It blocks unchanged unfinished work twice, then releases it as unmet; inbox waits and scenario handoffs also release without success.
