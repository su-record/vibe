# vibe 4 · phase 3b — GitHub research and project-local skills

## Why
An FDE looks before building: official SDK examples, repositories that solved the same problem, verified skills. Without a research tool the model starts from scratch every time and the user cannot tell that it did. Skills that matter are project-specific; vibe 3 piled 52 of them into every project. Here a skill is proposed from signals, created or imported into the project only, bound to a check, pinned to a commit, confirmed by a person, and pruned when unused. Nothing accumulates globally and nothing fetched runs unseen.

## What counts as success
- `vibe research --from-intent | "query"` builds queries from the intent title, http hosts and the stack; searches GitHub repositories, code (with a token) and skill catalogs (`anthropics/skills`, `vercel-labs/agent-skills`, `NousResearch/hermes-agent`, plus `catalogs` in config); ranks up to five candidates by keyword match, recency, stars and license, each with one action; writes a note under `knowledge/research/`; answers from a one-day cache when the network is gone and exits 2 only when there is neither.
- `vibe skill create <name>` refuses without a check type or a source scenario, installs the skeleton into every client directory present, and registers it.
- `vibe skill add owner/repo[@name]` shows the commands inside the skill and installs nothing until `--yes`; then pins the commit, records the license and registers the skill.
- `vibe skill suggest` proposes at most three from http hosts, regression clusters, repeated inbox questions and handoff state; `vibe state` carries the same proposals; dismissed proposals are not repeated. `skill list · used · prune` keep the registry honest.
- Phase 1–3a gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines, six common skills ≤ 300 lines.

## Constraints
- No dependency for GitHub: Node fetch against the REST API, token from the environment or the gh CLI, a fixture file for tests.
- The harness never installs a skill by itself, never runs a command from a fetched skill, never writes outside the project.
- Every record is English; the model talks to the user in the user's language.
