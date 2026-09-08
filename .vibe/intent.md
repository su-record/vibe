# vibe 4 · 4.1.20 — the basic harness: structure, context, conventions, a tool-call gate, a bench gate, and one convention for other harnesses

## Why
vibe's aim, in the user's words: the basic harness every AI user installs — suited to every kind of work, as the model is — whose job is what the model misses: waste (tokens, time, rediscovery) and wrong direction (the wrong thing built, done claimed, a loop). Its measure is tokens and time saved, as a number.

Three surveys were run before this spec (September 2026): the harness landscape across about twenty tools, a deep read of superpowers, spec-kit, BMAD and task-master with Anthropic's harness guidance, and the measurement methods of Graft, trace-mcp, last30days, slopkit, SWE-bench, Terminal-Bench, aider and ccusage. On eight axes vibe leads two — verdict (only what the harness ran is evidence; the author and the judge are separate sessions) and handoff (the state is the handoff) — and is behind on two: understanding the codebase (every session rediscovers it; the field shows 42–99% token cuts from a structural map) and enforcing at the tool call (the card asks the model to `vibe ask` before an irreversible command; nothing stops it if it does not). Between them sit memory that ends at the project boundary, an approval step with no consistency check, and a bench with one task. This release fills what fits vibe's constraints — dependency-free TypeScript, files ≤ 400 lines, one approval, the verdict only by `vibe check` — and leaves the rest named for the next.

## What counts as success

### A · Structure — the harness knows the codebase
- `vibe map [path]` builds and prints the map: directories → files → symbols (functions, classes, methods, exports, each with a one-line signature and line range) and the import edges between files, for the languages `vibe size` already parses (ts js py go java kt rs swift rb cs php) with the import rules `changed` already has (JS/TS, Python) plus Go, Rust, Java/Kotlin package imports. Dependency-free: regular expressions and the existing lexers.
- `vibe symbols <file>` prints the file's skeleton (symbols only). `vibe callers <symbol> [--depth N]` prints who calls it: a caller is a file that imports the symbol's module and names it as a call, marked `import` (edge confirmed) or `name` (name only) — the confidence is shown, never hidden. `vibe blast` prints the working tree's changed symbols (from `git diff` hunks) and their callers to `--depth` (default 2).
- The map lives in `.vibe/cache/map.json` keyed by file content hash; every command refreshes only files whose hash changed (this repository, 85 files: under 100 ms warm).
- `review … changed: true` takes its dependents from `blast` (symbol level, multi-hop) instead of one hop of file imports, and the bundle opens with changed symbols and affected symbols; the old import hop is the fallback for languages without call detection.
- `vibe read --ask` on code files prepends the skeleton of each file, so a question about a function is answered with the function in view.

### B · Context — the harness hands the model what a scenario needs
- `vibe context <scenario> [--json]` assembles, for one scenario: the files and symbols its check touches (the check's `path`, `cmd` arguments, and the map's neighbours one hop out), the ledger events that touched those files (decisions, regressions, REJECTs with their KEEP lines), the knowledge notes whose titles or tags match, the project conventions (C below), and the check command itself. Capped at 12,000 characters, most relevant first, each item with its source path.
- `vibe-build` reads `vibe context <id>` before building a scenario; `vibe-prove` reads it for a STUCK scenario. The six common skills stay ≤ 300 lines.

### C · Conventions — learned, not typed
- `vibe conventions` prints the project's conventions: what the harness reads from the repository (lint and formatter configs, `tsconfig`/`pyproject`/`go.mod`, an `AGENTS.md`/`CLAUDE.md` if present, the test command from `package.json`) plus what it learned — a REJECT reason or a KEEP line that recurs twice across reviews, a regression title, a decision recorded at approval — written as `.vibe/knowledge/conventions.md`, appended, never rewritten, with the source event of each line.
- Conventions reach the model through `vibe context`, and the reviewers through the evidence ledger of a `review` check when the check names none.
- Cross-project memory: `~/.config/vibe/knowledge/` holds notes the user marks `--global` with `vibe knowledge add`; `vibe context` includes them after the project's own. Plain files, the same format.

### D · Analyze — a read-only consistency check before approval
- `vibe intent analyze` compares the intent's "What counts as success" bullets with the scenarios: each bullet is matched to scenarios by shared terms; bullets without a scenario are `uncovered`, scenarios whose terms appear in no bullet are `unrequested`, and a scenario whose check type is `human` for a bullet that names a file or a command is `weak`. Output is a table and a verdict line; it changes nothing. `vibe-scope` runs it before the approval message and resolves `uncovered` bullets before asking.
- `vibe-discover` orders its three questions by impact — scope, then security and privacy, then the reader's experience, then technical detail.

### E · The tool-call gate — the hook blocks, not only warns
- With token policy `strict` or `irreversible`, the `PreToolUse` hook on `Bash` blocks (exit 2, with the reason on stderr) an irreversible command that has no authorize record in the last ten minutes, instead of warning; with `off` it warns, and `vibe tokens off` prints once that this belongs in a container or a VM. The Codex hook file carries the same entry; where a client cannot block, it warns as before.
- A test runs the hook with a `git push` payload under each policy and reads the exit code.

### F · The bench gate — every release shows its number
- `bench/tasks/` holds three tasks: `settlement` (data), `vibe-fix` (a small fix in a copy of this repository judged by its tests), `report` (a human-read document judged by `absent` and `traceable`); every check is deterministic (`bench-judge.js` already forbids anything but `file`; it now allows `run` for the test-judged task).
- `bench/run.js` runs the four arms in parallel (`--parallel 4`) and records per run: turns, cost as reported, cost recomputed from tokens with the published cache multipliers (read 0.1×, write 1.25×), tokens by kind, wall-clock, and whether the arm passed; efficiency metrics compare only runs where both arms passed.
- `vibe ledger compare` gains `--metric ms` and `--paired` (both arms passed); the release note of a release that claims a saving quotes the compare verdict, and the claim is written in the intent before the bench runs. A claim that lands `inconclusive` or `insufficient-runs` is not made.
- The gate: `checks/bench-gate.js` reads `bench/ledger.jsonl` and passes when the latest five runs per arm exist for every task and `--metric checks` is not worse for `on`; it runs in `vibe check --all` as a scenario, not in CI.

### G · One convention for other harnesses
- `src/core/capabilities.ts` lists what vibe can use when present: `graft` (map, callers, blast), `trace` (blast, impact), `pdftotext` (pdf), `codex`/`claude` (reader, reviewer), `agent-browser`/`playwright` (screenshot), `last30days` (research). Each names the command probed, the vibe operation it serves, and the fallback. `vibe status` prints the table; `vibe map`, `blast` and `research` use the tool when present and say so in their output.
- `vibe-scope` proposes installing one tool in the approval message when the project would use it (a repository over 200 files → Graft; a design review → a screenshot tool), one line with the command; installation stays with the user.

### H · The card, the skills, Windows
- Card rule 9 adds: a claim not bound to a check is said to be unverified. Card stays ≤ 1KB.
- `vibe-build`: no nested subagents (a reviewer's reviewer counts for nothing); batch scenarios of one shape into one dispatch; hand artifacts over as files, never pasted; when the context is nearly full, start a new session from `.vibe/` rather than compact. `vibe-scope`: a project-local skill is kept only if removing a line would make the model err.
- CI runs the tests on `windows-latest` as well as Linux, and the Windows job runs `vibe --version`, `vibe state`, and `vibe read --ask` against a fake reader through the `.cmd` shim.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, skill names, packs, report voice, no placeholders, no catalogue, plugin tree current for 4.1.20, README status line carries `4.1.20`.

## Named for the next release, not this one
- An unattended run after approval (`vibe drive`: the harness spawns the client per scenario until DONE or STUCK) — the largest item; designed after A–F prove their numbers.
- Cross-project cost aggregation in `vibe ledger`; an intent that proposes its own split when the graph passes six; review PASS cross-checked against public issue-patch pairs.
- Not taken, on purpose: persona pipelines, a document stack per feature, an optional gate beside a gated path, a vector store, tree-sitter.

## Constraints
- No new dependency; the map is regular expressions and the existing lexers; nothing renders; nothing downloads.
- One approval; the verdict only by `vibe check`; the hook blocks only what the token policy already calls irreversible.
- Every record is English; the model talks to the user in the user's language.
