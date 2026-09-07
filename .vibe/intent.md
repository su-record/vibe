# vibe 4 · 4.1.14 — one spec: slim review with usage, the code pack, two deterministic checks, the token ledger, whole-skill add, highest-version-wins registration, and research that asks about the intent

## Why
The last four releases were cut one conversation at a time. The six things left over are related — what the harness spends, what it judges, and what it installs — so they are specified once, approved once and shipped once.

1. **The review check spends what the reader used to spend.** Each stage runs `claude -p` inside the project, so the reviewer's context starts with the card, CLAUDE.md, plugins and hooks (16,311 tokens measured in 4.1.10) before the first line of the manuscript, twice per check, again on every re-check. The reader already runs slim; the reviewers should too. A shared session across stages was considered and rejected: the chief editor must not see the copy editor's verdict — independence outranks cache — and a re-check carries a changed manuscript, which no cache serves. What is safe: the reviewer prompt as the system prompt, no project context, tools limited to what a reviewer needs, and the usage reported.
2. **Code has no pack.** Ten public anti-slop skills were read; none covers code, and vibe is a coding harness. Code slop is a comment that restates the line, a docstring on a getter, a guard for an impossible state, a try that swallows, an interface with one implementation, a `Manager`/`Helper`/`Utils` name, a wrapper that only forwards, a constant made configurable, dead code kept "just in case", "robust"/"enhanced" in a name or a commit, a TODO that ships.
3. **Two defects are facts, not judgments.** A number in a report that is not in the evidence ledger; an image without alt, a skipped heading level, a control without a name, a text colour on a background below 4.5:1. A regex found the placeholders in 4.1.13; these need a little more than a regex but no model.
4. **The ledger does not know what the model calls cost.** The reader and the reviewers now return token usage; the ledger should hold it so `ledger compare --metric cost` compares real numbers.
5. **`vibe skill add` takes one directory level.** A skill with `references/` or `scripts/` arrives without them.
6. **A development checkout and a global install fight over the plugin registration.** Each run re-registers its own path; every command prints "set up claude". The rule that ends it: the highest version wins.
7. **`vibe research --from-intent` asks about the wrong words.** Its queries are the first four words of the title and two dependencies, so this very intent produced "one spec slim review" and a Minecraft repository. The scope skill puts research in every approval message; it has to ask about what the intent is about.

## What counts as success

### 1 · Slim review, usage reported
- The `review` check runs each stage through the reader's client drivers: Claude as `claude -p --output-format json --system-prompt <stage prompt> --tools Read,Grep,WebFetch,WebSearch --disable-slash-commands --strict-mcp-config --setting-sources ""` in the neutral directory `~/.config/vibe/reader`, the message being the contract, the evidence, the artifact and the screenshot line; Codex as `codex exec --skip-git-repo-check --json -` with the stage prompt leading the message. The model is the client's default — judgment keeps the strong model. `VIBE_REVIEW_CMD` stays a stateless text command (tests, custom clients); `VIBE_REVIEW_CLIENT=claude|codex` forces a driver (live checks).
- No session is shared between stages or across re-checks; each stage sees the artifact for the first time.
- A stage's verdict rule does not change: exactly `PASS`. The check's tail carries per-stage usage — `<pack> <stage>: PASS · in 1,204 · cache read 0 · out 3` — and the evidence JSON carries `usage` per stage when the driver reports it.
- Live: the design fixture is REJECTed at the markup reviewer by Claude and by Codex through the drivers, and the Claude run reports usage with `input` under 6,000 tokens for the fixture (the project context is gone).

### 2 · `antislop-code`
- `skills/antislop-code/SKILL.md` (English, ≤ 600 lines) in the shape of the other packs: what code slop is (the catalogue above, each with what it looks like and the one-line fix), the decisions a specific change makes first (the repository's own conventions outrank the pack; the smallest change that passes the check; delete before add; a name says what, a comment says why or nothing; an abstraction is earned by a second caller; a guard is earned by a reachable state; a test tests behaviour), the four tasks (write · diagnose · revise with a preservation contract for behaviour, public API, tests and error messages · convert a generated draft into the codebase's own style), strength tiers, verification, editorial review through `review` with `pack: code`, pitfalls. `references/catalogue.md` holds the catalogue as a table with the textual markers a reviewer can grep.
- `reviewers/code/1-reviewer.md` then `2-maintainer.md` (each ≤ 300 lines): the reviewer judges the source — catalogue markers, dead code, comment noise, defensive noise, naming, error handling that hides — `PASS` or a `REJECT` list in the four-field form with `file:line`, optional `KEEP` lines, `NEEDS-HUMAN` when the brief is missing; the maintainer judges whether it belongs — fit with the surrounding code, whether it will be understood in a year, whether each abstraction and guard is earned, whether the tests test behaviour. Agents `agents/code-reviewer.md` and `agents/code-maintainer.md`; Codex TOML generated as for the other packs.
- For `pack: code`, `path` is a file or a directory; the source collector takes code files (ts js mjs cjs jsx tsx py go rs java kt rb php c cc cpp h hpp cs swift sh sql yaml yml toml) and skips `node_modules`, `dist`, `build`, `.git`, `vendor`, lock files and anything binary; the cap and numbering are as for design.
- `vibe-scope` proposes `check: { type: review, pack: code, path: <dir> }` (`⚠ model-judged`) when the intent says the code will be read or maintained by someone else — a library, a contribution, a handoff; otherwise `vibe size` stays the code gate. The six common skills stay ≤ 300 lines.
- `checks/packs.js` accepts the third pack; `checks/fixtures/slop-code/` holds a sloppy module (comment-per-line, a `DataManagerHelper`, an interface with one implementation, a bare `except: pass`, a TODO, a constant read from config, dead code) and its brief; live, it is REJECTed at the reviewer by Claude and by Codex.

### 3 · Two deterministic checks
- `file … traceable: <evidence file>`: every numeric token in the file — digits with optional thousands separators, decimals and a percent sign, at least two significant digits, outside fenced code — must appear as a token in the evidence file; on a miss the check fails with `untraceable number` and names the first three as `line N: <number>`. Years inside an ISO date in the evidence count as present.
- `file … a11y: true` on an `.html`/`.htm` file (or a `.css` file for the contrast rule alone): an `<img>` without `alt`, a heading level that skips (h1 → h3), a `<button>` or `<a>` with no text and no `aria-label`, an `<input>`/`<select>`/`<textarea>` with no `<label for>` and no `aria-label`, and a CSS rule that declares both `color` and `background`/`background-color` as hex or rgb with a contrast ratio under 4.5 — each fails the check with `accessibility defect` and the first three findings by line.
- Validation accepts each as a complete rule; the README table names both; `vibe-scope` proposes `traceable` next to a text `review` that has an evidence file and `a11y: true` next to a design `review` on html.
- Live: the design fixture fails `a11y` (the emoji icons and the gradient text are not the point; the contrast of its grey-on-white copy and its unlabelled buttons are), and the 4.1.10 measurement paragraph of README passes `traceable` against a small evidence file that lists its numbers.

### 4 · The token ledger
- Inside a project, `vibe read --ask` and every review stage record a ledger event `usage` with `detail` (`reader` or `review <pack>/<stage>`), `client`, `model`, `tokens: { input, cacheRead, cacheWrite, output }`, `costUsd` when the driver reports it (Claude's JSON does), and `ms`. Outside a project nothing is recorded.
- `vibe ledger --since <d> --json` lists them; `vibe ledger compare --metric cost` includes their `costUsd`.

### 5 · Whole-skill add
- `vibe skill add` fetches the skill directory recursively — `references/`, `scripts/`, `assets/` and deeper — writes every file under the skill's directory with its relative path, lists them in the preview, and stops with a reason at 200 files or 5 MB.

### 6 · Highest version wins
- `registerClaude`: when the marketplace already points at another path that holds a `@su-record/vibe` package whose version is greater than or equal to the running package's, and Claude holds that version, the registration is `current` (detail names the path and version) and nothing runs. Otherwise it registers as today.
- `registerCodex`: the same with the assembled tree's manifest version and the version Codex holds.
- `vibe status` reports the version the client holds. Tests: a home whose marketplace points at a newer install stays untouched by an older binary; an older marketplace entry is replaced by a newer binary.

### 7 · Research that asks about the intent
- `queriesFromIntent` builds its queries from the intent body, not the title's first words: the backticked names and the noun phrases that recur in "What counts as success" (a phrase counts when it appears twice or is backticked), at most three queries of two to four words each, no stop words and no word under four letters; the http hosts and the stack stay as further queries.
- A candidate whose matched tokens are all under five letters is dropped; when nothing remains the result says `no relevant candidate` and the note records the queries tried.
- Test: an intent whose title is "one spec: slim review with usage …" yields queries that contain none of "one", "spec", "slim", and a fixture search that returns a repository matching only "one" is dropped.

### Gates
- build, tests, card ≤ 1KB, file 400 / function 50, six common skills ≤ 300 lines, skill names, packs (three), report voice, no placeholders, plugin tree current for 4.1.14, README status line carries `4.1.14`.

## Constraints
- No new dependency. Nothing renders; nothing downloads a model.
- Reviewer independence outranks cache: no session is shared between review stages.
- The judgment stays with the reviewers: `traceable` and `a11y` check facts, not style.
- Every record is English; the model talks to the user in the user's language; the code pack is English.
