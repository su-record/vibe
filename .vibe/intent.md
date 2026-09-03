# vibe 4 · phase 4 — measurement

## Why
The design says vibe 4 is recommended to others only when the ledger shows a difference, not when its author believes one. That needs a bench: the same task and the same judge under different arms — Claude Code and Codex, harness on and off — with every run recorded as a `check` event carrying client, model, harness, turns and cost, and a comparison that says "cannot tell" when it cannot.

## What counts as success
- The ledger carries a `harness` arm (on | off) and the client's reported turns and cost; `vibe ledger compare --by harness` works, also over a ledger file outside any project.
- `bench/run.js` prepares a fresh workspace per run, runs the agent headless (`claude -p` or `codex exec`), then judges with the task's scenarios and appends one line to `bench/ledger.jsonl`.
- The settlement task and its judge are checkable: every judge scenario is a `file` check, the reference total is the same 4500.5 as the example.
- The bench actually ran: at least one judged run per arm is in the ledger and the comparison command answers with one of its four verdicts.
- Earlier gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines, six common skills ≤ 300 lines.

## Constraints
- The bench spends the user's Claude and Codex quota; it runs only when a person starts it.
- In the `on` arm the agent sees the approved scenarios including their checks — that is what the harness is; the README says so.
- The verdict of a comparison is never turned into a ratio or a recommendation by the code.
- Every record is English; the model talks to the user in the user's language.
