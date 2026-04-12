# VIBE

> Source code for `@su-record/vibe` npm package. Modify files in THIS repository only — never the installed copies (`~/.claude/`, `~/.codex/`, `~/.gemini/`, `~/.coco/`, `~/.vibe/`).
>
> **Compatibility file (best-effort).** `@su-record/vibe` is guaranteed on Claude Code + coco only; Gemini CLI support is partial (some hooks/commands/skills may not run). Content SSOT is `CLAUDE.md` — this file is regenerated from it via `/vibe.docs agent`. Edit `CLAUDE.md` first.

## Hard Rules

### Behavior
- **Modify only requested scope** — Every changed line traces to the user's request
- **Edit existing files over creating new** — Fix at source
- **Preserve existing style** — Match conventions even if you'd do it differently
- **Respect Ctrl+C / Escape** — Previous task CANCELLED
- **State assumptions, ask when uncertain** — Don't pick silently when ambiguity exists; push back if a simpler approach exists

### Goal-Driven Execution
Transform imperative tasks into verifiable goals **before** coding:

| Instead of | Transform to |
|---|---|
| "Add validation" | "Tests for invalid inputs pass" |
| "Fix the bug" | "A test reproducing it passes" |
| "Refactor X" | "Tests pass before and after" |

Weak criteria ("make it work") require constant clarification. Strong criteria let the loop run independently.

### TypeScript (enforced by Quality Gate hooks)
- No `any` / `as any` / `@ts-ignore` — use `unknown` + type guards; fix at root
- Explicit return types on all functions

### Complexity Limits
Function ≤50 lines · Nesting ≤3 · Params ≤5 · Cyclomatic ≤10

### Forbidden Patterns
No `console.log` in commits · No hardcoded strings/numbers · No commented-out code · No incomplete code without TODO

### Convergence (review / auto-fix loops)
- **Loop until P1 = 0 AND no new findings** — no round cap
- **Narrowing scope**: Round 1 full → Round 2 P1+P2 → Round 3+ P1 only
- **Stuck detection** (same findings/score 2 rounds in a row) → ask user (fill values / approve sub-100 / abort). Never silently proceed sub-100
- **`ultrawork` exception** — skip user prompt; record gaps as TODO to stay non-interactive
- **Changed files only** — never full-project scan

## Architecture (Non-Obvious)

### Module System
- ESM only (`"type": "module"`) — imports need `.js` extension
- Build before test: `npm run build && npx vitest run`

### Config Locations
| Path | Purpose |
|---|---|
| `~/.vibe/config.json` | Global credentials, models (0o600) |
| `.gemini/vibe/config.json` | Project stacks, capabilities |
| `.gemini/settings.local.json` | Project hooks (auto-generated, don't commit) |

### Gotchas
- `better-sqlite3` WAL mode — synchronous API
- `crypto.timingSafeEqual` requires same-length buffers — check length first
- **Stack → asset SSOT**: `GLOBAL_SKILLS_*`, `STACK_TO_SKILLS`, `CAPABILITY_SKILLS` in `src/cli/postinstall/constants.ts`
- **Hook dispatch order** (BeforeAgent → BeforeTool → AfterTool): `prompt-dispatcher.js` → `keyword-detector.js` → `llm-orchestrate.js`

## Workflow

`/vibe.spec` is the single entry point — orchestrates interview → plan → spec → review → `/vibe.run` → `/vibe.verify` → `/vibe.trace`. For UI types (website/webapp/mobile), `/vibe.figma` branches in parallel. Smart Resume detects existing `.gemini/vibe/{interviews,plans,specs}/*.md` to skip phases.

| Task Size | Approach |
|---|---|
| 1–2 files | Plan Mode |
| 3+ files | `/vibe.spec` |

## Magic Keywords

| Keyword | Effect |
|---|---|
| `ultrawork` / `ulw` | Parallel agents + auto-continue + Ralph Loop |
| `ralph` | Iterate to 100% (no scope reduction) |
| `ralplan` | Iterative planning + persistence |
| `verify` | Strict verification mode |
| `quick` | Fast mode, minimal verification |

## Skill Tiers

3 tiers prevent context overload: **core** (always active) / **standard** (project-setup selected) / **optional** (explicit `/skill` only). SSOT: `GLOBAL_SKILLS_CORE` + `GLOBAL_SKILLS_STANDARD` in `src/cli/postinstall/constants.ts`. Proactive triggers live in each skill's frontmatter.

## Context Management

- Exploration → Haiku · Implementation → Sonnet · Architecture → Opus
- At 70%+ context: `save_memory` → `/new` → `/vibe.utils --continue`

## Git

**Include**: `.gemini/vibe/{plans,specs,features,todos}/`, `.gemini/vibe/config.json`, `GEMINI.md`
**Exclude**: `~/.gemini/{rules,commands,agents,skills}/`, `.gemini/settings.local.json`

<!-- VIBE:END -->
