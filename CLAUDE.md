# VIBE

## Project Nature

> **This is the source code for `@su-record/vibe` npm package.**
> Modify files in THIS repository only — never the installed copy (`~/.claude/`, `~/.vibe/`).

## Philosophy

> **vibe = Easy vibe coding + Minimum quality guaranteed**

- **Easy Vibe Coding** — Fast flow, think collaboratively with AI
- **Minimum Quality Guaranteed** — Type safety, code quality, security — automatic baseline
- **Iterative Reasoning** — Break down problems, ask questions, reason together (don't delegate)

## Constraints (Hard Rules)

### Code Behavior

- **Modify only requested scope** — Don't touch unrelated code
- **Preserve existing style** — Follow project conventions
- **Edit existing files, never create new ones** — Fix problems at source
- **Respect user interrupts** — Ctrl+C/Escape = previous task CANCELLED

### Complexity Limits

| Metric | Limit |
|--------|-------|
| Function length | ≤50 lines |
| Nesting depth | ≤3 levels |
| Parameters | ≤5 |
| Cyclomatic complexity | ≤10 |

### TypeScript (Enforced by Quality Gate hooks)

- No `any` — use `unknown` + type guards
- No `as any` — define proper interfaces
- No `@ts-ignore` — fix type issues at root
- Explicit return types on all functions

### Convergence Principle (Over-Diagnosis Prevention)

- **P1 only is mandatory, P2/P3 are best-effort** — P1=0 means done
- **Repeated reviews narrow scope** — Round 2: P1+P2 only, Round 3+: P1 only
- **Convergence detection** — Same results as previous round → stop immediately
- **3 failures = escalation** — No more retries, move to TODO
- **Changed files only** — Never scan the entire project

### Forbidden Patterns

- No `console.log` in commits
- No hardcoded strings/numbers (use constants)
- No commented-out code
- No incomplete code without TODO

## Architecture (What's NOT Obvious)

### Module System

- ESM only (`"type": "module"`) — imports need `.js` extension
- TypeScript strict mode → `dist/` via `tsc`
- Build before test: `npm run build && npx vitest run`

### Config Locations (Don't Confuse)

| Path | Purpose |
|------|---------|
| `~/.vibe/config.json` | Global credentials, channels, models (0o600) |
| `.claude/vibe/config.json` | Project stacks, capabilities, details |
| `.claude/settings.local.json` | Project hooks (auto-generated, don't commit) |

### Installation Flow

- `postinstall` → global assets (`~/.claude/agents/`, `~/.claude/skills/`, `~/.claude/commands/`)
- `vibe init` → project setup (detect stacks → config → constitution → rules → hooks → local skills + languages)
- `vibe update` → re-detect stacks, refresh project config (preserves user capabilities)

### Key Directories (Where to Find Things)

| What | Where |
|------|-------|
| CLI commands | `src/cli/commands/` |
| Postinstall modules | `src/cli/postinstall/` |
| Stack detection | `src/cli/detect.ts` |
| Auth (all LLMs) | `src/cli/auth.ts` |
| Setup helpers | `src/cli/setup.ts`, `src/cli/setup/` |
| Hooks scripts | `hooks/scripts/` |
| Agent definitions | `agents/` |
| Skill definitions | `skills/` |
| Language rules | `languages/` |
| SPEC/rule templates | `vibe/rules/`, `vibe/templates/` |
| Infra (daemon, memory, policy) | `src/infra/` |
| Telemetry (local JSONL) | `src/infra/lib/telemetry/` |
| Test helpers (shared) | `src/test-helpers/` |
| Skill catalog generator | `scripts/gen-skill-docs.ts` |

### Gotchas

- `better-sqlite3` WAL mode — DB module uses synchronous API
- `crypto.timingSafeEqual` requires same-length buffers — check length first
- `GLOBAL_SKILLS_CORE`, `GLOBAL_SKILLS_STANDARD`, `GLOBAL_SKILLS_OPTIONAL`, `STACK_TO_SKILLS`, `CAPABILITY_SKILLS` in `src/cli/postinstall/constants.ts` — single source of truth for stack→asset mapping
- Hook dispatch chain: `prompt-dispatcher.js` → `keyword-detector.js` → `llm-orchestrate.js` (order matters)
- Pre-existing test failures in `prdParser.test.ts` (7) and `traceabilityMatrix.test.ts` (1) — unrelated to current work

## Workflow

```text
/vibe.spec → /new → /vibe.spec.review → /vibe.run → /vibe.trace → (auto) code review → Done
```

| Task Size | Approach |
|-----------|----------|
| 1-2 files | Plan Mode |
| 3+ files | `/vibe.spec` |

## Magic Keywords

| Keyword | Effect |
|---------|--------|
| `ultrawork` / `ulw` | Parallel agents + auto-continue + Ralph Loop |
| `ralph` | Iterate until 100% complete (no scope reduction) |
| `ralplan` | Iterative planning + persistence |
| `verify` | Strict verification mode |
| `quick` | Fast mode, minimal verification |

## Skill Tier System

Skills are classified into 3 tiers to prevent context overload (Curse of Instructions):

| Tier | Loading | Purpose | Count |
|------|---------|---------|-------|
| **core** | Always active | Bug/mistake prevention safety nets | ~9 |
| **standard** | Project setup selects | Workflow support by stack/capability | ~21 |
| **optional** | Explicit `/skill` only | Reference/wrapper — not auto-loaded | ~4 |

**Constants**: `GLOBAL_SKILLS_CORE` + `GLOBAL_SKILLS_STANDARD` in `src/cli/postinstall/constants.ts`

## Proactive Skill Suggestions

When the user's context matches a pattern below, suggest the relevant skill **once** per session. If the user says "stop suggesting", disable for the rest of the session.

| User Context | Suggested Skill | Tier | Signal |
|-------------|-----------------|------|--------|
| Writing a new SPEC / planning | `/vibe.spec` | core | "let's build", "new feature", "requirements" |
| SPEC exists, ready to implement | `/vibe.run` | core | SPEC file present, no implementation started |
| Implementation done, verifying | `/vibe.trace` | core | Code changes match SPEC phases |
| Technical debt accumulating | `/techdebt` | core | Multiple `any` types, console.log, unused imports |
| Multi-file refactoring planned | `/exec-plan` | core | 3+ files to change, complex dependencies |
| Complex feature, unknown tech | `/parallel-research` | standard | "how should we", "which library", architecture questions |
| Debugging errors repeatedly | `/vibe.trace` | core | 3+ error cycles without resolution |
| Session ending, work incomplete | `/handoff` | standard | 70%+ context, incomplete tasks |
| Building new UI/UX | `/design-teach` | standard | "new page", "landing", "dashboard", Figma URL |
| UI code review | `/design-audit` | standard | After implementing UI components |
| New project setup / CLAUDE.md | `/claude-md-guide` | standard | "new project", "write CLAUDE.md" |
| Before shipping UI | `/design-polish` | standard | "ready to deploy", "final check" |
| External API/SDK code needed | `/chub-usage` | optional | "Stripe 연동", "OpenAI API", SDK/API code request |

## Context Management

- **Exploration/Search**: Haiku | **Implementation**: Sonnet | **Architecture**: Opus
- At 70%+ context: `save_memory` → `/new` → `/vibe.utils --continue`

## Git Commit Rules

**Must include:** `.claude/vibe/specs/`, `.claude/vibe/features/`, `.claude/vibe/todos/`, `.claude/vibe/config.json`, `CLAUDE.md`

**Exclude:** `~/.claude/vibe/rules/`, `~/.claude/commands/`, `~/.claude/agents/`, `~/.claude/skills/`, `.claude/settings.local.json`

<!-- VIBE:END -->
