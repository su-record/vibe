---
name: vibe.build
description: Build — implement approved scenarios one at a time; after each one, `vibe check <id>` lets the harness judge. Never say "done".
user-invocable: false
---

# Build

## Procedure

1. Take scenarios in the order of `remaining` from `vibe state --json`. Put scenarios marked `irreversible` last.
2. Build only what that scenario needs — code, a script, a document, configuration, whatever. Make sure the check itself (`check.cmd`, `check.path`) can actually run.
3. Run `vibe check {id} --json`.
   - Pass (`code 0`): next scenario.
   - Fail (`code 1`): read `tail` and fix. If the same failure happens twice the harness marks STUCK and leaves an inbox question — stop and show that question to the user.
4. Record a fixed failure with `vibe regress record --scenario {id} --title "…" --check-from-evidence {run}`.
5. When `remaining` is empty, move to `vibe.prove`.

## Irreversible actions

Before actually executing an `irreversible` scenario (send, deploy, delete, spend):

```
vibe ask "{what is about to happen, one line}" --needs authorize:{action} --target "{target}" --json
```

Show the token in the response to the user. Only after the user pastes it and `vibe authorize "{number}" --action {action} --target "{target}"` exits 0 may you execute. Dry runs need no token.

## Never

- Weaken a check to make it pass (editing scenarios.yaml voids the approval — the harness enforces this).
- Claim a pass without `vibe check`.
