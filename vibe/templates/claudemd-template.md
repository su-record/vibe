# VIBE

> **vibe = Easy vibe coding + Minimum quality guaranteed**

## Constraints

- **Modify only requested scope** — Don't touch unrelated code
- **Preserve existing style** — Follow project conventions
- **Prefer editing existing files** — Fix problems at source. Create new files when the task explicitly requires them (user-requested feature, new module, scaffolding). An explicit user request overrides this default.

### Complexity Limits

| Metric | Limit |
|--------|-------|
| Function length | ≤50 lines |
| Nesting depth | ≤3 levels |
| Parameters | ≤5 |
| Cyclomatic complexity | ≤10 |

### Forbidden Patterns

- No `console.log` in commits
- No hardcoded strings/numbers (use constants)
- No commented-out code
- No `any` type — use `unknown` + type guards

## Project Structure

| Folder | Owner | Purpose |
|--------|-------|---------|
| `src/` | Human+AI | Business logic |
| `docs/` | **Human** | Business rules, domain definitions, ADR — **read before starting work** |
| `tests/` | Human+AI | Test infrastructure |
| `.dev/` | **AI** | Learnings, troubleshooting logs, scratch files |
| `.claude/` | AI | Configuration, rules, skills |

## References

- **Rules**: See `.claude/vibe/config.json` → `references.rules[]`
- **Language standards**: See `.claude/vibe/languages/`
- **Constitution**: See `.claude/vibe/constitution.md`

## Workflow

| Task Size | Approach |
|-----------|----------|
| 1-2 files | Plan Mode |
| 3+ files | `/vibe.spec` — single entry point, orchestrates everything |
| Analyze target | `/vibe.analyze` — code, documents, websites, Figma |
| Check Harness | `/vibe.harness` — diagnose project maturity |
| Project structure | `/vibe.scaffold` — generate optimized folder structure |

## Magic Keywords

| Keyword | Effect |
|---------|--------|
| `ultrawork` / `ulw` | Parallel agents + auto-continue |
| `ralph` | Iterate until 100% complete |
| `quick` | Fast mode, minimal verification |

## Quality Gate

Convergence Principle: loop until P1 = 0. Changed files only.

## Context Management

At 70%+ context: `save_memory` → `/new` → `/vibe.utils --continue`

## Git Commit Rules

**Include:** `.claude/vibe/plans/`, `.claude/vibe/specs/`, `.claude/vibe/features/`, `.claude/vibe/config.json`, `CLAUDE.md`
**Exclude:** `~/.claude/vibe/rules/`, `~/.claude/commands/`, `~/.claude/agents/`, `~/.claude/skills/`, `.claude/settings.local.json`

<!-- VIBE:END -->
