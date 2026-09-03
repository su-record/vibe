---
name: vibe.build
description: Build — implement approved scenarios one at a time; after each one, `vibe check <id>` lets the harness judge. Never say "done".
user-invocable: false
---

# Build

## Procedure

1. Take scenarios in the order of `remaining` from `vibe state --json` — parents before their `needs` dependents (`vibe state --graph` shows the edges). Put scenarios marked `irreversible` last.
   - Scenarios with no edge between them may be built by parallel agents, each in its own worktree, merged before `vibe check --all`. Never two agents in one working tree.
2. Build only what that scenario needs — code, a script, a document, configuration, whatever. Make sure the check itself (`check.cmd`, `check.path`) can actually run.
3. Run `vibe check {id} --json`.
   - Pass (`code 0`): next scenario.
   - Fail (`code 1`): read `tail` and fix. If the same failure happens twice the harness marks STUCK and leaves an inbox question — stop and show that question to the user.
   - Blocked (`status: blocked`): a parent has not passed; `vibe check {id}` runs unpassed parents first, so fix the parent named in `blockedBy`.
4. When a project-local skill (`vibe skill list`) applies to the scenario, follow it and run `vibe skill used {name}` — prune decisions read the ledger.
5. Record a fixed failure with `vibe regress record --scenario {id} --title "…" --check-from-evidence {run}`.
6. When `remaining` is empty, move to `vibe.prove`.

## Irreversible actions

Before actually executing an `irreversible` scenario (send, deploy, delete, spend):

```
vibe ask "{what is about to happen, one line}" --needs authorize:{action} --target "{target}" --json
```

If the response carries a token, show it to the user and execute only after they paste it and `vibe authorize "{number}" --action {action} --target "{target}"` exits 0. If the project's token policy is `off`, the response has no token: run `vibe authorize --action {action} --target "{target}"` (recorded as auto) and proceed. Dry runs never need a token.

## Never

- Weaken a check to make it pass (editing scenarios.yaml voids the approval — the harness enforces this).
- Claim a pass without `vibe check`.
