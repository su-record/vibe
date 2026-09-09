# vibe 4 · 4.1.22 — the brownfield bench: does the map save tokens where there is something to rediscover?

## Why
Graft's saving — 42–60% fewer tokens at equal accuracy — is the cost of rediscovery in a codebase that already exists. The 4.1.21 bench had no rediscovery: seven tiny fixtures a bare model reads in one pass, and on all of them the fast path kept the map off. So vibe's A·B (map, context) have never been measured. This bench measures exactly that: one change that cuts across a real codebase, judged by tests, with the map on, counted in weighted input tokens.

## What counts as success
- A `brownfield` task under `bench/tasks/`: the workspace is this repository at the release commit (`git archive HEAD`, `node_modules` linked, `npm run build` run by a `judge/prepare.cjs` that `bench/run.js` executes when a task ships one), and TASK.md asks for one cross-cutting change: a `file` check rule `lines: { max: N }` that fails when the file has more than N lines — wired through the scenario validation, the file check, the README check table and the scope skill's check list. The judge: `npm run build && npx vitest run judge/lines.test.ts` (the test exercises `parseScenarios` accepting `lines` and `fileCheck` failing over the limit with a reason naming the count), a `file` check that README's table names `lines`, and one that the scope skill names it — five scenarios in the judge intent, so the `on` arm is `size: full` and reads `vibe context` and the map.
- `checks/direction-judges.js` proves this judge too: the untouched repository fails, a reference patch (`judge/right.cjs`) passes.
- `vibe ledger compare --metric tokens` compares weighted input tokens: `input + 0.1 × cacheRead + 1.25 × cacheWrite` from the line's `tokens`; `--paired` applies as for turns and ms.
- `checks/bench-gate.js` gains a `context` set holding `brownfield` with the pre-registered rule: `on` weighted tokens ≤ `off` × 0.7 per client, paired, and checks not worse.
- Pre-registered in `bench/claims/2026-09-09-4.1.22.md` before the run: the token rule above; five runs per arm per client; whatever falls is reported as measured.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, skill names, packs, report voice, no placeholders, no catalogue, Windows CI, plugin tree current for 4.1.22, README status line carries `4.1.22`.

## Constraints
- The judge is deterministic; no model judges. The task's reference patch is not shown to either arm.
- The verdict rule does not change; the fast path stays as it is — this task is `full` by its own shape.
- Every record is English; the model talks to the user in the user's language.
