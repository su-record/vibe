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

- **P1만 필수, P2/P3는 best-effort** — P1=0이면 완료
- **반복 리뷰는 스코프 축소** — 2회차: P1+P2만, 3회차+: P1만
- **수렴 감지** — 이전 라운드와 동일한 결과 → 즉시 종료
- **실패 3회 = 에스컬레이션** — 재시도 금지, TODO로 이관
- **변경 파일만 검사** — 전체 프로젝트 스캔 금지

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

### Gotchas

- `better-sqlite3` WAL mode — DB module uses synchronous API
- `crypto.timingSafeEqual` requires same-length buffers — check length first
- `STACK_TO_LANGUAGE_FILE`, `STACK_TO_SKILLS`, `CAPABILITY_SKILLS` in `src/cli/postinstall/constants.ts` — single source of truth for stack→asset mapping
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

## Context Management

- **Exploration/Search**: Haiku | **Implementation**: Sonnet | **Architecture**: Opus
- At 70%+ context: `save_memory` → `/new` → `/vibe.utils --continue`

## Git Commit Rules

**Must include:** `.claude/vibe/specs/`, `.claude/vibe/features/`, `.claude/vibe/todos/`, `.claude/vibe/config.json`, `CLAUDE.md`

**Exclude:** `~/.claude/vibe/rules/`, `~/.claude/commands/`, `~/.claude/agents/`, `~/.claude/skills/`, `.claude/settings.local.json`

<!-- VIBE:END -->
