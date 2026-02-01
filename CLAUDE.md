# VIBE

SPEC-driven AI Coding Framework (Claude Code Exclusive)

## Response Language

**IMPORTANT: Always respond in Korean (한국어) unless the user explicitly requests otherwise.**

## Code Quality Standards (Mandatory)

Follow these standards when writing code. See `~/.claude/vibe/rules/` (global) for detailed rules.

### Core Principles

- **Modify only requested scope** - Don't touch unrelated code
- **Preserve existing style** - Follow project conventions
- **Keep working code** - No unnecessary refactoring
- **Respect user interrupts** - If user interrupts (Ctrl+C/Escape) and sends a new message, the previous task is CANCELLED. Do NOT resume or continue interrupted work. Respond ONLY to the new message.

### Code Complexity Limits

| Metric               | Limit                                        |
|----------------------|----------------------------------------------|
| Function length      | ≤30 lines (recommended), ≤50 lines (allowed) |
| Nesting depth        | ≤3 levels                                    |
| Parameters           | ≤5                                           |
| Cyclomatic complexity | ≤10                                         |

### TypeScript Rules

- No `any` → `unknown` + type guards
- No `as any` → proper interfaces
- No `@ts-ignore`
- Explicit return types

### Error Handling Required

- try-catch or error state required
- Loading state handling
- User-friendly error messages

### Forbidden Patterns

- No console.log in commits
- No hardcoded strings/numbers
- No commented-out code
- No incomplete code without TODO

## Workflow

```text
/vibe.spec → /new → /vibe.spec.review → /vibe.run → /vibe.trace → (auto) code review → ✅ Done
```

1. `/vibe.spec` - Write SPEC (requirements + research + draft)
2. `/new` - Start new session (clean context)
3. `/vibe.spec.review` - GPT/Gemini review (3-round mandatory)
4. `/vibe.run` - Implementation + Gemini review
5. **(auto)** 13+ agent parallel review + P1/P2 auto-fix

## Plan Mode vs VIBE

| Task Size                    | Recommended  |
|------------------------------|--------------|
| Simple changes (1-2 files)   | Plan Mode    |
| Complex features (3+ files)  | `/vibe.spec` |

After `/vibe.analyze` or `/vibe.review` with dev request → **Ask user for workflow choice**

## ULTRAWORK Mode

Include `ultrawork` or `ulw` keyword for maximum performance:

- Parallel sub-agent exploration (3+ concurrent)
- Background agents + Phase pipelining
- Boulder Loop (auto-continue until all Phases complete)
- Auto-retry on error (max 3), Auto-save at 70%+ context

## Commands

| Command                      | Description                       |
|------------------------------|-----------------------------------|
| `/vibe.spec "name"`          | Write SPEC (PTCF) + parallel research |
| `/vibe.spec.review "name"`   | GPT/Gemini review (new session)   |
| `/vibe.run "name"`           | Execute implementation            |
| `/vibe.run "name" ultrawork` | Maximum performance mode          |
| `/vibe.verify "name"`        | Verification against SPEC         |
| `/vibe.review`               | 13+ agent parallel code review    |
| `/vibe.trace "name"`         | Requirements traceability matrix  |
| `/vibe.reason "problem"`     | Systematic reasoning              |
| `/vibe.analyze`              | Project analysis                  |
| `/vibe.utils --e2e`          | E2E testing (Playwright)          |
| `/vibe.utils --diagram`      | Generate diagrams                 |
| `/vibe.utils --ui "desc"`    | UI preview                        |
| `/vibe.utils --continue`     | Session restore                   |

## Magic Keywords

| Keyword              | Effect                                        |
|----------------------|-----------------------------------------------|
| `ultrawork` / `ulw`  | Parallel + auto-continue + Ralph Loop         |
| `ralph`              | Iterate until 100% complete (no scope reduction) |
| `ralplan`            | Iterative planning + persistence              |
| `verify`             | Strict verification mode                      |
| `quick`              | Fast mode, minimal verification               |

## PTCF Structure

SPEC documents use: `<role>` `<context>` `<task>` `<constraints>` `<output_format>` `<acceptance>`

## Built-in Tools

| Tool                          | Purpose                          |
|-------------------------------|----------------------------------|
| `vibe_find_symbol`            | Find symbol definitions          |
| `vibe_find_references`        | Find references                  |
| `vibe_analyze_complexity`     | Analyze complexity               |
| `vibe_validate_code_quality`  | Validate quality                 |
| `vibe_start_session`          | Restore previous session context |
| `vibe_auto_save_context`      | Save current state               |
| `vibe_save_memory`            | Save important decisions         |

## Agents

- **Review (12)**: security, performance, architecture, complexity, simplicity, data-integrity, test-coverage, git-history, python, typescript, rails, react reviewers → `.claude/agents/review/`
- **Research (4)**: best-practices, framework-docs, codebase-patterns, security-advisory → `.claude/agents/research/`

## Context Management

### Model Selection

- **Exploration/Search**: Haiku
- **Implementation**: Sonnet
- **Architecture**: Opus

### At 70%+ Context

- Do NOT use `/compact` (information loss risk)
- Use `save_memory` → `/new` for new session
- Restore with `/vibe.utils --continue`

## Documentation Guidelines

- Avoid ASCII boxes → Use Mermaid diagrams, Markdown tables, or indented lists
- Flowcharts → Mermaid | Structure → Indented lists | Comparisons → Tables

## Git Commit Rules

**Must include:** `.claude/vibe/specs/`, `.claude/vibe/features/`, `.claude/vibe/todos/`, `.claude/vibe/config.json`, `CLAUDE.md`

**Exclude:** `~/.claude/vibe/rules/`, `~/.claude/commands/`, `~/.claude/agents/`, `~/.claude/skills/`, `.claude/settings.local.json`

<!-- VIBE:END -->
