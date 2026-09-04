# vibe 4

**The experience of having an AX/FDE next to you** — an agent-experience engineer, the forward-deployed kind who sits with the customer and makes the model do the actual job. Say what you need in plain words. vibe turns it into checkable scenarios, builds it, proves it by running the checks itself, and hands it over to whoever will run it. Vibe-coding quality is the by-product of that discipline.

Main surfaces: Claude Code · Codex CLI · ChatGPT desktop app · Hermes Agent · Claude desktop app (interview, approval, verdict, handoff).

```bash
npm i -g @su-record/vibe
```

That is the whole install. The package registers itself as a local plugin in every client it finds and keeps the registration current on every later command:

| client | what the install does |
|---|---|
| Claude Code | `claude plugin marketplace add <package dir>` + `claude plugin install vibe@vibe` — skills and hooks come from the plugin, the card from its SessionStart hook |
| Codex CLI · ChatGPT desktop | assembles the plugin tree under `~/.vibe/plugin`, registers the personal marketplace, runs `codex plugin add vibe@vibe-local`; the card goes into `~/.codex/AGENTS.md`; restart ChatGPT desktop afterwards |
| Hermes Agent | six skills into `~/.hermes/skills`, the card block into `~/.hermes/SOUL.md` |
| Claude desktop app | `vibe plugin mcpb --out vibe.mcpb`, open the file in the app, pick the project folder — an MCP Bundle whose only job is to call the `vibe` CLI; for the interview, approval, verdict and handoff, not for writing code |
| no client CLI on PATH (or `VIBE_NO_PLUGIN=1`) | the older path: card, skills and hook written into the client home |

`vibe status` shows the mode and version per client and says when a newer version exists; `vibe update` installs it and re-registers the plugins; `vibe uninstall` unregisters and removes everything. Nothing is published to a public marketplace — the plugin is the package on your disk.

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

A project's code-size rule is a scenario too: `check: { type: run, cmd: "vibe size src --max-file 400 --max-function 50" }` — `vibe size` exits 1 when a file or function is over, and the scope skill proposes it whenever an intent writes code.

The harness reads what the customer sends, so every client sees the same text: `vibe profile <file>` (csv · tsv · jsonl · json · xlsx) prints columns, types, missing values, duplicates and up to three anomalies before the interview; `vibe read <file>` (xlsx · docx · pptx · pdf · hwp · hwpx · html · tables) returns the text, sheets as markdown tables, and names the reader it used — Office XML, Hangul HWP 5 (OLE + zlib records) and HWPX are parsed in-house with no dependency, PDF through `pdftotext` when installed and a built-in reader otherwise, HTML as content without markup. Images are left to the client's own model.

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
vibe tokens strict         # approval and irreversible actions both need a six-digit human token
vibe tokens irreversible   # default — a plain "yes" approves; push/deploy/send/delete/spend need a token
vibe tokens off            # no tokens; everything is recorded as "auto" (you already skip permissions)
```

The policy is per project (`.vibe/config.json`); `vibe tokens` alone prints it. Tokens are six digits, valid ten minutes, single use, bound to what they authorize, and stored only as hashes. The verdict itself is never configurable.

## Commands

```
setup     update [--check] · status · tokens · uninstall [--purge-state] · plugin install | status
work      state [--graph] · read <file> · profile <file> · intent draft | show · approve · check · evidence · abandon
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

The six live in the client home, not in the repository. Project-specific skills live only inside the project (`.claude/skills`, `.codex/skills`, registry in `.vibe/skills/`) and are installed only when bound to a check or carrying knowledge the model lacks:

```
vibe skill suggest                         # ≤3 proposals from signals: http hosts, regression clusters, repeated questions, handoff
vibe skill create <name> --check run|file|http|eval [--from-scenario <id>]
vibe skill add owner/repo[@name] [--pin <sha>] [--yes]   # shows the commands inside, installs only with --yes, pinned to a commit
vibe skill search <keyword> · list · used <name> · prune [--unused-runs 10] · dismiss <ref>
```

Proposals are proposals: the harness never installs a proposed skill, runs remote commands, or writes anything but its own six skills, card and hook outside the project. A dismissed proposal is not repeated.

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

`4.0.0` — phase 1: CLI core + Claude Code. Phase 2: Codex CLI and ChatGPT desktop adapters, the work graph and typed ledger edges. Phase 3a: `http` / `eval` checks, column sums, sample profiling. Phase 3b: GitHub research, project-local skills and proposals. Phase 3c: the end-to-end order-settlement example. Phase 4: the bench and `ledger compare --by harness`. `4.0.2`: no `init` — the card, skills and hook live in the client home and any `vibe` command repairs them. `4.0.3`: `vibe uninstall` also clears what an older `init` left in the project. `4.1.0`: the package is the plugin — `npm i -g` registers a local plugin in Claude Code and Codex/ChatGPT, Hermes Agent joins as a client, `vibe plugin build --check` gates manifest drift. `4.1.1`: `vibe update`. `4.1.2`: the Claude desktop app through an MCP Bundle (`vibe plugin mcpb`). `4.1.3`: the bundle finds the CLI without the shell's PATH (Homebrew, nvm, fnm, volta) or from a path set at install. `4.1.4`: `vibe read` for xlsx · docx · pptx · pdf, `vibe profile` reads xlsx, card rule 8 (read files whole). `4.1.5`: `vibe read` for Hangul hwp · hwpx and html. `4.1.6`: `vibe size`, a built-in file/function size check for any project; the CLI split into modules; the repository's own limit is now per file (400), not a total. `4.1.7`: hook entries left by vibe 3 that point at a missing script are swept at every command, so Claude Code stops reporting them. vibe 3 stays on its 3.x tags and is no longer developed.

## Bench — the ledger is the benchmark

`bench/run.js` runs the same task under different arms (Claude Code · Codex, harness on · off), judges every run with the same scenarios, and appends one `check` line per run to `bench/ledger.jsonl`. `vibe ledger compare --by harness --metric checks --ledger bench/ledger.jsonl` answers with one of four verdicts and never a ratio. See `bench/README.md`.

## Example

`examples/order-settlement/` is the design walkthrough run for real: an order CSV with a duplicate row and a missing amount, a settlement script, a schema, and a dry-run send. This repository's own scenarios judge it — profile anomalies, exit codes, the `total` column sum, the summary schema — and the project-local skill created from the settle scenario has to survive `vibe skill prune`.

## Develop

```bash
npm ci && npm run check          # build + tests
node dist/cli.js check --all     # vibe 4 judges its own scenarios
```
