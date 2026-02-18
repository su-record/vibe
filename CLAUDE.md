# VIBE

## Project Nature

> **This project is the source code for the `@su-record/vibe` npm package.**
> All bug fixes and improvements MUST be made in **this project source** — not in installed locations.
> Always modify files in this repository, never the installed copy.

## Philosophy

> **vibe = Easy vibe coding + Minimum quality guaranteed**

| Principle | Description |
|-----------|-------------|
| **Easy Vibe Coding** | Fast flow, intuitive development, think collaboratively with AI |
| **Minimum Quality Guaranteed** | Type safety, code quality, security — automatic baseline enforcement |
| **Iterative Reasoning (Type 6)** | Don't delegate answers to AI — break down problems, ask questions, reason together |

### Quality Guardrails

| Guardrail | Mechanism |
|-----------|-----------|
| Type Safety | Quality Gate — blocks `any` / `Any` / `@ts-ignore` |
| Code Review | 13+ agent parallel review (security, performance, architecture, etc.) |
| Completion Check | Ralph Loop — iterate until 100% complete (no scope reduction) |
| Memory RAG | SQLite + FTS5 BM25 persistent memory |
| Multi-LLM | GPT + Gemini cross-validation via ReviewRace |

## Code Quality Standards (Mandatory)

### Core Principles

- **Modify only requested scope** — Don't touch unrelated code
- **Preserve existing style** — Follow project conventions
- **Keep working code** — No unnecessary refactoring
- **Edit existing files, never create new ones** — Fix the problem at its source
- **Respect user interrupts** — If user interrupts (Ctrl+C/Escape), the previous task is CANCELLED. Respond ONLY to the new message

### Code Complexity Limits

| Metric | Limit |
|--------|-------|
| Function length | ≤30 lines (recommended), ≤50 lines (allowed) |
| Nesting depth | ≤3 levels |
| Parameters | ≤5 |
| Cyclomatic complexity | ≤10 |

### TypeScript Rules

- No `any` type — use `unknown` + type guards
- No `as any` casting — define proper interfaces
- No `@ts-ignore` — fix type issues at root
- Explicit return types on all functions

### Forbidden Patterns

- No console.log in commits
- No hardcoded strings/numbers
- No commented-out code
- No incomplete code without TODO

## Configuration

### Global: `~/.vibe/config.json`

All credentials, channel config, and model settings in one file (0o600 permissions).

```json
{
  "credentials": { "gpt": {}, "gemini": {} },
  "channels": { "telegram": {}, "slack": {} },
  "models": { "gpt": "gpt-5.2", "gemini": "gemini-3-pro-preview" }
}
```

CLI commands: `vibe gpt key`, `vibe gemini auth`, `vibe telegram setup`, etc.

### Project: `.claude/vibe/config.json`

Project-specific settings (language, quality, stacks, details, references).

## Workflow

```text
/vibe.spec → /new → /vibe.spec.review → /vibe.run → /vibe.trace → (auto) code review → Done
```

| Task Size | Recommended |
|-----------|-------------|
| Simple changes (1-2 files) | Plan Mode |
| Complex features (3+ files) | `/vibe.spec` |

## ULTRAWORK Mode

Add `ultrawork` or `ulw` keyword:

- Parallel sub-agent exploration (3+ concurrent)
- Background agents + Phase pipelining
- Boulder Loop (auto-continue until all Phases complete)
- Auto-retry on error (max 3), Auto-save at 70%+ context

## Commands (Slash)

| Command | Description |
|---------|-------------|
| `/vibe.spec "name"` | Write SPEC (PTCF) + parallel research |
| `/vibe.spec.review "name"` | SPEC quality review (GPT + Gemini 3-round) |
| `/vibe.run "name"` | Execute implementation |
| `/vibe.run "name" ultrawork` | Maximum performance mode |
| `/vibe.verify "name"` | Verification against SPEC |
| `/vibe.review` | 13+ agent parallel code review |
| `/vibe.trace "name"` | Requirements traceability matrix |
| `/vibe.reason "problem"` | Systematic reasoning |
| `/vibe.analyze` | Project analysis |
| `/vibe.utils` | Utilities (--e2e, --diagram, --ui, --continue) |
| `/vibe.voice` | Voice-to-coding (Gemini audio) |

## CLI Commands

| Command | Description |
|---------|-------------|
| `vibe init [project]` | Project initialization |
| `vibe setup` | Interactive setup wizard |
| `vibe update` | Update project configuration |
| `vibe upgrade` | Upgrade to latest version |
| `vibe remove` | Remove from project |
| `vibe status` | Full status check |
| `vibe version` | Show version |
| `vibe claude <cmd>` | Claude (key, status, logout) |
| `vibe gpt <cmd>` | GPT (auth, key, status, logout, remove) |
| `vibe gemini <cmd>` | Gemini (auth, key, import, status, logout, remove) |
| `vibe telegram <cmd>` | Telegram (setup, chat, status) |
| `vibe slack <cmd>` | Slack (setup, channel, status) |
| `vibe env import [path]` | .env → ~/.vibe/config.json migration |

## External LLM Integration

- **GPT**: `vibe gpt auth` (OAuth) / `vibe gpt key` (API Key) — Responses API
- **Gemini**: `vibe gemini auth` (OAuth) / `vibe gemini key` (API Key) — Gemini API
- Auth priority: OAuth → API Key → Azure (GPT) / gemini-cli → OAuth → API Key (Gemini)
- All credentials stored in `~/.vibe/config.json`

## External Channels

- **Telegram**: `vibe telegram setup <token>` — `~/.vibe/config.json` channels.telegram
- **Slack**: `vibe slack setup <bot-token> <app-token>` — `~/.vibe/config.json` channels.slack

## Magic Keywords

| Keyword | Effect |
|---------|--------|
| `ultrawork` / `ulw` | Parallel + auto-continue + Ralph Loop |
| `ralph` | Iterate until 100% complete (no scope reduction) |
| `ralplan` | Iterative planning + persistence |
| `verify` | Strict verification mode |
| `quick` | Fast mode, minimal verification |

## Agents (49)

### Main (19)

Explorer (high/medium/low), Implementer (high/medium/low), Architect (high/medium/low), Searcher, Tester, Simplifier, Refactor Cleaner, Build Error Resolver, Compounder, Diagrammer, E2E Tester, UI Previewer, Junior Mentor

### Review (12)

security, performance, architecture, complexity, simplicity, data-integrity, test-coverage, git-history, typescript, python, rails, react

### Research (4)

best-practices, framework-docs, codebase-patterns, security-advisory

### UI/UX (8)

ui-industry-analyzer, ui-design-system-gen, ui-layout-architect, ui-stack-implementer, ui-dataviz-advisor, ux-compliance-reviewer, ui-a11y-auditor, ui-antipattern-detector

### Planning (2), QA (2), Docs (2)

requirements-analyst, ux-advisor, edge-case-finder, acceptance-tester, api-documenter, changelog-writer

### Agent Teams (9)

Lite, Dev (ULTRAWORK), Research, Review Debate, SPEC Debate, Debug, Security, Migration, Fullstack

## Built-in Tools (41+)

- **Memory & Session** (21): save/recall/search/link memories, session RAG (save_session_item, retrieve_session_context, manage_goals)
- **Code Quality** (8): find_symbol, find_references, analyze_complexity, validate_code_quality, etc.
- **SPEC & Testing** (9): spec_generator, traceability_matrix, e2e_test_generator, etc.
- **UI & Utility** (3+): preview_ui_ascii, get_current_time, send_slack

## Hooks System

| Event | Hooks |
|-------|-------|
| SessionStart | `session-start.js` |
| PreToolUse | `sentinel-guard.js`, `pre-tool-guard.js` |
| PostToolUse | `post-edit.js`, `code-check.js` |
| UserPromptSubmit | `prompt-dispatcher.js` → `keyword-detector.js`, `llm-orchestrate.js` |
| Notification | `context-save.js` (80/90/95%) |
| Stop | `stop-notify.js` |

## Language Support (25 frameworks)

- **TypeScript**: Next.js, React, Angular, NestJS, Vue, Svelte, Nuxt, Tauri, Electron, React Native, Node, Astro
- **Python**: Django, FastAPI
- **Java**: Spring
- **Kotlin**: Android
- **Ruby**: Rails
- **Go**, **Rust**, **Swift** (iOS), **C#** (Unity), **Dart** (Flutter), **GDScript** (Godot)

## Context Management

- **Exploration/Search**: Haiku | **Implementation**: Sonnet | **Architecture**: Opus
- At 70%+ context: Use `save_memory` → `/new` → `/vibe.utils --continue`

## Git Commit Rules

**Must include:** `.claude/vibe/specs/`, `.claude/vibe/features/`, `.claude/vibe/todos/`, `.claude/vibe/config.json`, `CLAUDE.md`

**Exclude:** `~/.claude/vibe/rules/`, `~/.claude/commands/`, `~/.claude/agents/`, `~/.claude/skills/`, `.claude/settings.local.json`

<!-- VIBE:END -->
