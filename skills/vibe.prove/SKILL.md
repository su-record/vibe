---
name: vibe.prove
description: Prove — run every scenario and regression at once with `vibe check --all` to reach DONE. On STUCK, stop and ask.
user-invocable: false
---

# Prove

## Procedure

1. Run `vibe check --all --json`. Every scenario plus every registered regression runs at once.
2. Show the user a table: scenario · check type · pass/fail/pending · time. `human` items read "confirmation requested" with the inbox id.
3. On failures go back to `vibe.build`. On STUCK (`stuck: true`) do not fix — show the inbox question to the user and wait.
4. Surface first (at most 3, each with a reason): scenarios that never ran, checks that flip between pass and fail (evidence history), runs that hit a limit (`tail` contains "killed").
5. When `done: true`, move to `vibe.handoff`.

## What DONE means

DONE means every gate scenario passed on this exact tree. Changing any file sends the state back to RUNNING; run `vibe check --all` again.
