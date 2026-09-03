# vibe 4

**The experience of having an AX/FDE next to you.** Say what you need in plain words. vibe turns it into checkable scenarios, builds it, proves it by running the checks itself, and hands it over to whoever will run it. Vibe-coding quality is the by-product of that discipline.

Main surfaces: Claude Code · Codex CLI · ChatGPT desktop app.

```bash
npm i -g @su-record/vibe
cd your-project && vibe init                     # Claude Code (CLAUDE.md card · .claude/skills · notification hook)
cd your-project && vibe init --client codex      # Codex CLI  (AGENTS.md card · .codex/skills · .codex/hooks.json)

vibe plugin install                              # Codex CLI + ChatGPT desktop as one OpenAI plugin
codex plugin marketplace add ~ && codex plugin add vibe@<marketplace>   # the install output prints the exact name
```

Codex and ChatGPT desktop read the same personal marketplace (`~/.agents/plugins/marketplace.json`); restart ChatGPT desktop after installing. The plugin tree holds only the manifest, the six skills and the notification hooks — its hooks call the globally installed `vibe`.

Then, in chat:

```
/vibe every week an order spreadsheet arrives — turn it into a settlement sheet and send it to accounting
```

## The flow

```
request (/vibe …)
  → interview      discover: at most three questions, sample profiling, anomalies said first
  → scenarios      scope: each scenario bound to a check · research · skills needed → one approval
  → build          one scenario at a time, `vibe check` after each
  → prove          `vibe check --all` — every scenario plus every regression, ordered by the work graph
  → report + handoff   a document the operator can run alone; irreversible steps need a token
```

Any client can pick the work up: `vibe state` says where you are, because the state lives in plain files inside the repository. There is no handoff document — the state is the handoff.

## Five things the harness does (and nothing else)

1. **Independent verdict.** Every scenario carries a check: `run` (exit code), `file` (exists / regex / contains / JSON Schema / column sum), `http` (status / JSON Schema / latency ceiling), `eval` (count of matching labelled cases through a runner), or `human` (no verdict — goes to the inbox). Only what `vibe check` executed itself becomes evidence. A model saying "done" changes nothing; DONE is void the moment a file changes.
2. **Memory across sessions and clients.** `.vibe/` holds the intent, scenarios, evidence, ledger, inbox, regressions and knowledge as plain files you can read and commit.
3. **Permission stays with people.** Who may authorize is your policy, not the harness's law (see below).
4. **A ledger, not a claim.** Every run records client, model, result, cost when the client provides it. Comparisons are ledger queries with four verdicts — insufficient runs, mixed scenario sets, inconclusive, difference observed — and never a winner, ratio or percentage. Events also carry typed edges (`supersedes`, `decided-by`, `implements`, `caused`), so `vibe ledger why <node>` can answer "why does this regression exist" or "which approval covers this file".
5. **It speaks first.** Human attention is narrow. At each stage the harness surfaces up to three things you did not ask about, each with a reason it found in your files, ledger or history.

## Check types

| type | verdict | arguments |
|---|---|---|
| `run` | exit code | `cmd`, `expect` (default 0), `timeoutMs`, `cwd` |
| `file` | exists · regex · substring · JSON Schema · column sum | `path`, `exists` / `pattern` / `contains` / `schema` / `sum: {column, equals, tolerance}` |
| `http` | status · body schema · latency ceiling | `url`, `method`, `expect: {status, schema, maxMs}`, `timeoutMs` |
| `eval` | count of matching cases (never a ratio) | `cases` (jsonl `{id, input, expected}`), `runner` (stdin → stdout), `expect: {pass}` |
| `human` | none — a question in the inbox | `question` |

Tables (`csv` · `tsv` · `jsonl` · `json`) are read by the harness itself; `vibe profile <file>` prints columns, types, missing values, duplicates and up to three anomalies before the interview. Spreadsheets are exported as CSV — the harness takes no dependency for Excel.

## The work graph

A scenario may declare what it depends on:

```yaml
- id: build
  then: dist is produced
  check: { type: run, cmd: "npm run build" }
- id: tests
  needs: [build]
  then: every test passes
  check: { type: run, cmd: "npm test" }
```

`vibe check` runs scenarios whose parents have passed, up to four at a time, then their dependents. A dependent of a failed parent is reported `blocked` and never run. `vibe check tests` pulls in `build` if it has not passed yet. Unknown ids, cycles and a `human` parent are rejected at draft time. `vibe state --graph` prints the graph as mermaid with the last result on each node.

Routing stays in code: the model never decides the order. Keep a graph under six connected scenarios; past that, split the intent. When independent scenarios are built by parallel agents, each works in its own worktree and the branches are merged before `vibe check --all` — the harness orders checks, it does not run agents.

## Token policy

```bash
vibe init --tokens strict         # approval and irreversible actions both need a six-digit human token
vibe init --tokens irreversible   # default — a plain "yes" approves; push/deploy/send/delete/spend need a token
vibe init --tokens off            # no tokens; everything is recorded as "auto" (you already skip permissions)
```

Tokens are six digits, valid ten minutes, single use, bound to what they authorize, and stored only as hashes. The verdict itself is never configurable.

## Commands

```
setup     init · status · uninstall
work      state [--graph] · profile <file> · intent draft | show · approve · check · evidence · abandon
human     ask · authorize · inbox
memory    regress record | list · knowledge add
research  research --from-intent | "query"
skills    skill suggest · create · add · search · list · used · prune · dismiss
ledger    ledger · ledger compare · ledger why <node> · ledger edges [--type]
```

`vibe --help` has the details. Every command accepts `--json`. The exit code is the verdict: 0 ok · 1 verdict failed · 2 usage · 3 token · 4 invalid transition.

## Research — see what exists before building

`vibe research --from-intent` turns the intent title, the hosts its `http` checks target and the stack into queries, searches GitHub repositories, code (`SKILL.md` files — needs a token) and skill catalogs, and ranks up to five candidates by keyword match, recency, stars and license. Each candidate carries one action: `vibe skill add …`, a knowledge note, or none. The note lands in `.vibe/knowledge/research/`; the same query is cached for a day. Nothing fetched is executed or installed.

Default catalogs: `anthropics/skills`, `vercel-labs/agent-skills`, `NousResearch/hermes-agent` (a skill is any directory with a `SKILL.md`, at any depth). Add your own under `catalogs` in `.vibe/config.json`. Without a GitHub token (`GITHUB_TOKEN`, or `gh auth login`) code search is skipped and catalogs are read within the public limits.

## Skills

Six common skills ship with the package — `vibe` (entry), `discover`, `scope`, `build`, `prove`, `handoff` — under 300 lines in total. They contain the harness command sequence and message shapes for each stage, nothing about how to code.

Project-specific skills live only inside the project (`.claude/skills`, `.codex/skills`, registry in `.vibe/skills/`) and are installed only when bound to a check or carrying knowledge the model lacks:

```
vibe skill suggest                         # ≤3 proposals from signals: http hosts, regression clusters, repeated questions, handoff
vibe skill create <name> --check run|file|http|eval [--from-scenario <id>]
vibe skill add owner/repo[@name] [--pin <sha>] [--yes]   # shows the commands inside, installs only with --yes, pinned to a commit
vibe skill search <keyword> · list · used <name> · prune [--unused-runs 10] · dismiss <ref>
```

Proposals are proposals: the harness never installs, runs remote commands, or writes outside the project by itself. A dismissed proposal is not repeated.

## Language

The always-on card (1KB), the skills and every record vibe writes are English. The model talks to you in your language.

## What is inside `.vibe/`

```
intent.md        what and why — the one page you approve
scenarios.yaml   given / when / then + the check that judges each + needs (the work graph)
evidence/        what the harness actually ran, per run
ledger.jsonl     state changes, client, model, results, cost, typed edges
inbox.jsonl      questions, STUCK notices, token hashes
regressions/     fixed failures as reproducing checks
knowledge/       domain notes the model reads when it needs them; research/ holds search notes
skills/          registry of project-local skills and dismissed proposals
cache/           research results, one day
config.json      token policy · skill catalogs
```

## Status

`4.0.0-alpha` — phase 1: CLI core + Claude Code. Phase 2: Codex CLI and ChatGPT desktop adapters, the work graph and typed ledger edges. Phase 3a: `http` / `eval` checks, column sums, sample profiling. Phase 3b: GitHub research, project-local skills and proposals. Next: the end-to-end "order spreadsheet" example (3c), then measured comparisons across clients and models (phase 4). vibe 3 stays on its 3.x tags and is no longer developed.

## Develop

```bash
npm ci && npm run check          # build + tests
node dist/cli.js check --all     # vibe 4 judges its own scenarios
```
