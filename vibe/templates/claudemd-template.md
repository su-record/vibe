# VIBE

> **vibe = Easy vibe coding + Minimum quality guaranteed**

## Constraints

- **Modify only requested scope** — every changed line traces to the request
- **Write code that reads like the surrounding code** — match its naming, comment density, and idiom
- **Prefer editing existing files** — create new ones when the task asks for a feature, module, or scaffold

### What the gate actually checks

Mechanisms you cannot observe from the code: vibe's PostToolUse hook detects `any` / `as any` / `@ts-ignore` and `console.log` and injects them back as context — fix at the root (`unknown` + type guards, real logging) rather than suppressing. The Stop hook warns when a run started but verify never passed.

Structure standards (complexity, naming, anti-patterns) are not repeated here — see References below and read them when a change is large enough to matter.

## Project Structure

| Folder | Owner | Purpose |
|--------|-------|---------|
| `src/` | Human+AI | Business logic |
| `docs/` | **Human** | Business rules, domain definitions, ADR — **read before starting work** |
| `tests/` | Human+AI | Test infrastructure |
| `.dev/` | **AI** | Learnings, troubleshooting logs, scratch files |
| `.claude/` | AI | Configuration, rules, skills |

## References

- **Rules**: See `.vibe/config.json` → `references.rules[]`
- **Language standards**: See `.vibe/languages/`
- **Constitution**: See `.vibe/constitution.md`

## Workflow

| Task Size | Approach |
|-----------|----------|
| 1-2 files | Plan Mode |
| 3+ files | `/vibe` — single entry point (`/vibe.spec` starts at the SPEC phase) |
| Analyze target | `/vibe.analyze` — code, documents, websites, Figma |
| Check Harness | `/vibe.harness` — diagnose project maturity |
| Project structure | `/vibe.scaffold` — generate optimized folder structure |

## Loop Contract

`/vibe` = SPEC approval once → loop ANCHOR→ACT→JUDGE→RECORD until gates pass (deterministic JUDGE; stuck / max-iter guards).

Deprecated aliases are mapped, not features: `ralph`/`verify` → default (no-op), `quick` → `--max-iter 1`, `ultrawork`/`ulw` → `automationLevel: autonomous` + parallel ACT.

## Quality Gate

Convergence Principle: loop until P1 = 0. Changed files only.

## Context Management

At 85%+ context: `save_memory` → `/new` → `/vibe.continue` (raised from 70% — `/new` discards the entire KV prefix cache, so compacting less often preserves cache reuse)

## Git Commit Rules

**Include:** `.vibe/specs/`, `.vibe/features/`, `.vibe/config.json`, `CLAUDE.md` (legacy `.vibe/plans/` 는 있으면 유지)
**Exclude:** `~/.claude/vibe/rules/`, `~/.claude/commands/`, `~/.claude/agents/`, `~/.claude/skills/`, `.claude/settings.local.json`

<!-- VIBE:END -->
