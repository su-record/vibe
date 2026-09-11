# Bench — settlement task, 2026-09-03

Task: `bench/tasks/settlement` (order CSV → settlement sheet, 5 file-check judge scenarios). Arms: Claude Code (claude -p, default model) and Codex CLI (codex exec, default model), harness on (vibe card, skills, approved intent in the workspace) and off (bare workspace). 5 runs per arm, 20 judged runs, all in `bench/ledger.jsonl` (git-ignored; this note is the record).

| arm | runs | judge passed (of 5) | turns | cost USD | agent wall-clock s |
|---|---|---|---|---|---|
| claude-code / on | 5 | 5,5,5,5,5 | 9,6,8,8,6 | 0.93,0.85,0.79,0.79,0.81 | 76,62,73,53,58 |
| claude-code / off | 5 | 5,5,5,5,5 | 3,3,4,3,3 | 0.58,0.59,0.69,0.60,0.63 | 37,40,54,40,46 |
| codex / on | 5 | 5,5,5,5,5 | 1*,11,14,15,15 | not reported | 85,64,108,111,116 |
| codex / off | 5 | 5,5,5,5,5 | 1*,6,7,7,6 | not reported | 52,50,49,50,48 |

\* the first Codex run per arm was judged before the runner counted completed items; it recorded the single `codex exec` turn.

`vibe ledger compare --ledger bench/ledger.jsonl`:

- `--by harness --metric checks`: **inconclusive** — every run passed every check; this task cannot tell the arms apart.
- `--by harness --metric turns`: inconclusive (ranges overlap, partly because of the two starred runs).
- `--by harness --metric cost` (Claude only, 5 usable per arm): **difference observed**, delta −0.22 USD per run (on costs more). Not "worse" — the on arm also ran `vibe state` and `vibe check` itself, which is what the harness asks for.
- `--by client --metric checks`: inconclusive.

## What this does and does not say

- On a task an agent already gets right, the harness adds turns and cost and changes nothing measurable. That is expected: a verdict gate only pays off where the agent would otherwise stop too early or claim done wrongly.
- Nothing here licenses recommending vibe 4 to others. The design's bar ("difference observed" on checks) is not met on this task.
- Next bench must be a task where the off arm fails sometimes: ambiguous rules that require the interview, a regression that the check catches, an irreversible step that should not run without a token, or a multi-file change. Until then the honest summary is "no difference on easy work, higher cost".
