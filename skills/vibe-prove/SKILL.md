---
name: vibe-prove
description: Only on STUCK (the same failure twice) — read `vibe context <id>`, answer the inbox, `vibe check --all`. A passing task needs no skill.
user-invocable: false
---

# Prove

## Procedure

1. Run `vibe check --all --json`. Every scenario plus every registered regression runs — independent ones in parallel, dependents after their parents pass.
2. Show the user a table: scenario · check type · pass/fail/blocked/pending · time. `human` items read "confirmation requested" with the inbox id; `blocked` items name the parent.
3. On failures go back to `vibe-build`. On STUCK (`stuck: true`) do not fix — show the inbox question to the user and wait.
4. Surface first (at most 3, each with a reason): scenarios that never ran, checks that flip between pass and fail (evidence history), runs whose structured capture flags report a limit.
5. When `done: true`, move to `vibe-handoff`.

## What DONE means

DONE means every gate scenario passed on this exact tree. Changing any file sends the state back to RUNNING; run `vibe check --all` again.

On STUCK, read `vibe context {id}` before touching anything — the decisions and regressions around that scenario are usually the reason.

After DONE, no further `vibe check`: a check after DONE spends a turn and changes nothing until a file changes.
Stop reports existing explicit-check evidence for its bound session and worktree. A released Stop, unavailable status, inbox wait or handoff never supplies a passing verdict.
