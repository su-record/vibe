# vibe 4 · phase 2b — work graph and typed ledger edges

## Why
Scenarios are a flat list run one after another, and the ledger is an event log without relations. The graph-engineering research (knowledge/research/2026-09-03-graph-engineering.md) found two things worth taking: a dependency edge between scenarios so the harness can order and parallelise checks by code, and typed edges in the ledger so `vibe ledger` can answer "why does this regression exist" and "which approval covers this file" without a graph database. Everything else in that note (org graphs, model routing, orchestration runtimes) stays out.

## What counts as success
- A scenario may declare `needs: [ids]`. Unknown ids, cycles, and a `human` parent are rejected at draft time.
- `vibe check` runs scenarios whose needs are all satisfied in parallel (at most four at once), then their dependents; a scenario whose parent did not pass is reported `blocked` with the parent named, is not run, and blocks DONE. `vibe check <id>` pulls in unpassed ancestors.
- `vibe state --graph` prints the work graph as mermaid with each node's last result.
- The ledger carries typed edges: `supersedes` (new intent → previous), `decided-by` (intent → chat or token), `implements` (scenario that just passed → files changed in the working tree), `caused` (regression → source scenario and evidence run). `vibe ledger why <node>` walks them.
- Phase 1 and 2 gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines.

## Constraints
- No orchestration runtime. The client already provides subagents; the harness orders checks and documents the isolation rule (independent scenarios may be built in separate worktrees, merged before `vibe check --all`).
- A work graph stays under six scenario nodes with edges; past that, split the intent.
- Every record is English; the model talks to the user in the user's language.
