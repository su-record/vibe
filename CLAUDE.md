# VIBE

Personalized AI Agent (Claude Code Exclusive) — v0.1.0

## Project Nature

> **This project is the source code for the `@su-record/core` npm package.**
> Since users install this via `npm install`, all bug fixes and improvements MUST be made in **this project source** — not in installed locations (e.g., AppData).
> Always modify files in this repository, never the installed copy.

## Philosophy

> **core = Easy vibe coding + Minimum quality guaranteed**

| Principle | Description |
|-----------|-------------|
| **Easy Vibe Coding** | Fast flow, intuitive development, think collaboratively with AI |
| **Minimum Quality Guaranteed** | Type safety, code quality, security — automatic baseline enforcement |
| **Iterative Reasoning (Type 6)** | Don't delegate answers to AI — break down problems, ask questions, reason together |

### How CORE Guarantees Quality

| Guardrail | Mechanism |
|-----------|-----------|
| Type Safety | Quality Gate — blocks `any` / `Any` / `@ts-ignore` |
| Code Review | Race Review — GPT + Gemini + AZ Kimi K2.5 in parallel |
| Completion Check | Ralph Loop — iterate until 100% complete (no scope reduction) |
| Multi-LLM | 4-perspective cross-validation (Claude + GPT + Gemini + AZ Kimi K2.5) |

### User's Role (Iterative-Reasoning Type)

Research shows that **breaking down problems and reasoning collaboratively (Type 6)** produces far better results than simply delegating to AI (Type 1).

| Avoid | Do Instead |
|-------|------------|
| "Build login feature" | "Let's analyze the requirements for login" |
| Accept AI output as-is | Ask "Is this approach correct?" |
| Request complete code only | Review step by step |

## Code Quality Standards (Mandatory)

Follow these standards when writing code. See `~/.claude/vibe/rules/` (global) for detailed rules.

### Core Principles

- **Modify only requested scope** — Don't touch unrelated code
- **Preserve existing style** — Follow project conventions
- **Keep working code** — No unnecessary refactoring
- **Edit existing files, never create new ones** — When fixing errors/bugs, ALWAYS modify the original file. NEVER create new files (wrappers, adapters, V2 copies) as a workaround. Fix the problem at its source.
- **Respect user interrupts** — If user interrupts (Ctrl+C/Escape) and sends a new message, the previous task is CANCELLED. Do NOT resume or continue interrupted work. Respond ONLY to the new message.

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

### Error Handling Required

- try-catch or error state required
- Loading state handling
- User-friendly error messages

### Forbidden Patterns

- No console.log in commits
- No hardcoded strings/numbers
- No commented-out code
- No incomplete code without TODO

### Superpowers Integration (v0.2.0)

Four quality mechanisms inspired by the Superpowers project:

| Feature | Description | Location |
|---------|-------------|----------|
| **Anti-Rationalization** | Blocks 6 categories of AI excuse patterns (SPEC skip, quality skip, verification skip, scope expansion, architecture avoidance, evidence avoidance) | `rules/principles/anti-rationalization.md` |
| **Evidence Gate** | 5-step verification protocol (IDENTIFY → RUN → READ → VERIFY → CLAIM). No completion claims without evidence | `rules/quality/evidence-gate.md` + UltraQA |
| **3-Fix Rule** | Same failure 3 times → switch to architecture question. User discussion required before fix #4 | UltraQA `architecture_question` status |
| **Rule TDD** | 6 quality checks (example/both-sides/rationalization/edge/quality/comprehensive), 70+ pass threshold | RuleBuildSystem `pressureTestRule()` |

**Core principle:** Violating the letter of a rule is violating the spirit of a rule.

## Workflow

```text
/vibe.spec → /new → /vibe.spec.review → /vibe.run → /vibe.trace → (auto) code review → Done
```

1. `/vibe.spec` — Write SPEC (requirements + research + draft) + parallel LLM research
2. `/new` — Start new session (clean context)
3. `/vibe.spec.review` — GPT/Gemini/AZ (Kimi K2.5) review (3-round mandatory)
4. `/vibe.run` — Implementation + GPT/Gemini/AZ (Kimi K2.5) Race Review
5. **(auto)** — 13+ agent parallel review + P1/P2 auto-fix

**All commands call `getCurrentTime` at start/end to display elapsed time.**

## Plan Mode vs CORE

| Task Size | Recommended |
|-----------|-------------|
| Simple changes (1-2 files) | Plan Mode |
| Complex features (3+ files) | `/vibe.spec` |

After `/vibe.analyze` or `/vibe.review` with dev request → **Ask user for workflow choice**

## ULTRAWORK Mode

Include `ultrawork` or `ulw` keyword for maximum performance:

- Parallel sub-agent exploration (3+ concurrent)
- Background agents + Phase pipelining
- Boulder Loop (auto-continue until all Phases complete)
- Auto-retry on error (max 3), Auto-save at 70%+ context

## Commands

| Command | Description |
|---------|-------------|
| `/vibe.spec "name"` | Write SPEC (PTCF) + parallel research |
| `/vibe.spec.review "name"` | GPT/Gemini review (new session) |
| `/vibe.run "name"` | Execute implementation |
| `/vibe.run "name" ultrawork` | Maximum performance mode |
| `/vibe.verify "name"` | Verification against SPEC |
| `/vibe.review` | 13+ agent parallel code review |
| `/vibe.trace "name"` | Requirements traceability matrix |
| `/vibe.reason "problem"` | Systematic reasoning |
| `/vibe.analyze` | Project analysis |
| `/vibe.utils --e2e` | E2E testing (Playwright) |
| `/vibe.utils --diagram` | Generate diagrams |
| `/vibe.utils --ui "desc"` | UI preview |
| `/vibe.utils --continue` | Session restore |
| `/vibe.voice` | Voice-to-coding command (Gemini audio) |

## CLI Commands

| Command | Description |
|---------|-------------|
| `vibe setup` | Setup wizard (auth, channels, config in one go) |
| `vibe start / stop` | Start/stop daemon (auto-manages interfaces) |
| `vibe status` | Full status check (LLM, Agent, Sentinel) |
| `vibe sync <cmd>` | Cloud sync (login, push, pull, status, logout) |
| `vibe init` | Project initialization |
| `vibe update` | Update configuration |
| `vibe gpt <cmd>` | GPT (auth, key, status, logout) |
| `vibe gemini <cmd>` | Gemini (auth, key, status, logout) |
| `vibe az <cmd>` | AZ (key, status, logout) |
| `vibe kimi <cmd>` | Kimi (key, status, logout) |
| `vibe config <cmd>` | Provider priority (embedding-priority, kimi-priority, show) |
| `vibe telegram <cmd>` | Telegram (setup, chat, status) |
| `vibe slack <cmd>` | Slack (setup, channel, status) |

Sentinel, Evolution, Policy, HUD, and Job are handled by internal automation — no separate CLI commands.
Autonomy mode is configured via `autonomy.mode` in `.claude/vibe/config.json`.

## External Channels

| Channel | Interface | Requirements |
|---------|-----------|-------------|
| Telegram | TelegramBot (polling) | `TELEGRAM_BOT_TOKEN` |
| Web/API | WebServer (SSE + WebSocket) | JWT auth |
| Slack | SlackBot (Socket Mode) | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` |
| Vision | VisionInterface | `GEMINI_API_KEY` |

### Channel Environment Variables

| Variable | Description |
|----------|-------------|
| `VIBE_TELEGRAM_ENABLED` | Enable Telegram channel |
| `VIBE_SLACK_ENABLED` | Enable Slack channel |
| `VIBE_VISION_ENABLED` | Enable Vision channel |
| `SLACK_BOT_TOKEN` | Slack bot token (xoxb-) |
| `SLACK_APP_TOKEN` | Slack app-level token (xapp-) |
| `SLACK_ALLOWED_CHANNELS` | Comma-separated allowed channel IDs |
| `GEMINI_API_KEY` | Google Gemini API key |

## Magic Keywords

| Keyword | Effect |
|---------|--------|
| `ultrawork` / `ulw` | Parallel + auto-continue + Ralph Loop |
| `ralph` | Iterate until 100% complete (no scope reduction) |
| `ralplan` | Iterative planning + persistence |
| `verify` | Strict verification mode |
| `quick` | Fast mode, minimal verification |

## PTCF Structure

SPEC documents use: `<role>` `<context>` `<task>` `<constraints>` `<output_format>` `<acceptance>`

## Built-in Tools (41+)

### Memory & Session

| Tool | Purpose |
|------|---------|
| `core_start_session` | Restore previous session context |
| `core_auto_save_context` | Save current state |
| `core_save_memory` | Save important decisions |
| `core_recall_memory` | Recall saved memories |
| `core_list_memories` | List all memories |
| `core_search_memories` | Search memories |
| `core_search_memories_advanced` | Advanced memory search |
| `core_link_memories` | Link related memories |
| `core_get_memory_graph` | Visualize memory graph |
| `core_create_memory_timeline` | Create memory timeline |
| `core_restore_session_context` | Restore session context |
| `core_prioritize_memory` | Prioritize memory items |

### Semantic & Quality

| Tool | Purpose |
|------|---------|
| `core_find_symbol` | Find symbol definitions |
| `core_find_references` | Find references |
| `core_analyze_dependency_graph` | Analyze dependency graph |
| `core_analyze_complexity` | Analyze complexity |
| `core_validate_code_quality` | Validate quality |
| `core_check_coupling_cohesion` | Check coupling/cohesion |
| `core_suggest_improvements` | Suggest improvements |
| `core_apply_quality_rules` | Apply quality rules |

### UI & Utility

| Tool | Purpose |
|------|---------|
| `core_preview_ui_ascii` | UI preview in ASCII |
| `core_get_current_time` | Get current time |

### Channel Tools

| Tool | Purpose |
|------|---------|
| `send_slack` | Send message to Slack channel |
| `vision_capture` | Capture screen for analysis |
| `vision_analyze` | Analyze image with Gemini Vision |

### SPEC & Testing

| Tool | Purpose |
|------|---------|
| `core_spec_generator` | Generate SPEC documents |
| `core_prd_parser` | Parse PRD documents |
| `core_traceability_matrix` | Generate traceability matrix |
| `core_e2e_test_generator` | Generate E2E tests |

### Session RAG

Structured session context storage/retrieval system. SQLite + FTS5 BM25 hybrid search.

| Tool | Purpose |
|------|---------|
| `save_session_item` | Store Decision/Constraint/Goal/Evidence |
| `retrieve_session_context` | Hybrid search (BM25 + recency + priority) |
| `manage_goals` | Goal lifecycle management (list/update/complete) |

**4 Entity Types:**

| Entity | Description | Key Fields |
|--------|-------------|------------|
| Decision | User-confirmed decisions | title, rationale, alternatives, impact, priority |
| Constraint | Explicit constraints | title, type (technical/business/resource/quality), severity |
| Goal | Current goal stack (hierarchical) | title, status, priority, progressPercent, successCriteria |
| Evidence | Verification/test results | title, type (test/build/lint/coverage), status, metrics |

**Auto-injection:** When `start_session` is called, active Goals, critical Constraints, and recent Decisions are automatically included in session context.

```typescript
import { saveSessionItem, retrieveSessionContext, manageGoals } from '@su-record/core/tools';

// Save decision
await saveSessionItem({ itemType: 'decision', title: 'Use Vitest', rationale: 'Fast and modern' });

// Save constraint
await saveSessionItem({ itemType: 'constraint', title: 'No vector DB', type: 'technical', severity: 'high' });

// Save goal
await saveSessionItem({ itemType: 'goal', title: 'Implement Session RAG', priority: 2 });

// Search context
await retrieveSessionContext({ query: 'testing' });

// Manage goals
await manageGoals({ action: 'list' });
await manageGoals({ action: 'update', goalId: 1, progressPercent: 80 });
await manageGoals({ action: 'complete', goalId: 1 });
```

## Multi-LLM Orchestration (v0.1.0)

4-LLM orchestration system (Claude + GPT + Gemini + Kimi K2.5). AZ (Azure Foundry) and Kimi Direct (Moonshot) are different endpoints for the same model.

### Core Modules

| Module | Purpose |
|--------|---------|
| `SmartRouter` | Task-type-specific LLM selection + fallback chain + provider priority |
| `LLMCluster` | Parallel multi-LLM calls (GPT + Gemini + AZ Kimi K2.5 + Kimi Direct) |
| `AgentRegistry` | SQLite-based agent execution tracking (WAL mode) |
| `AllProvidersFailedError` | Structured error when all providers fail |

### SmartRouter Priority

| Task Type | Priority Order |
|-----------|---------------|
| code-analysis, code-review | AZ → Kimi → GPT → Gemini → Claude |
| reasoning, architecture | AZ → Kimi → GPT → Gemini → Claude |
| code-gen | AZ → Kimi → Claude |
| debugging | AZ → Kimi → GPT → Gemini → Claude |
| uiux, web-search | Gemini → AZ → Kimi → GPT → Claude |
| general | AZ → Kimi → Claude |

**Provider Priority Config**: Setting `vibe config kimi-priority kimi,az` makes Kimi Direct take priority over AZ.

### AZ (Azure Foundry) Integration

- Chat API: `https://fallingo-ai-foundry.services.ai.azure.com/openai/v1`
- Embedding API: `https://fallingo-ai-foundry.cognitiveservices.azure.com`
- Models:
  - `Kimi-K2.5` (chat/reasoning/code analysis — all tasks)
  - `text-embedding-3-large` (embeddings)
- Auth: `AZ_API_KEY` env variable or `vibe az key <key>` (same key for both Chat + Embedding)
- Timeout: 30s/provider, 3 retries (exponential backoff)

### Kimi Direct (Moonshot) Integration

- Chat API: `https://api.moonshot.ai/v1`
- Model: `kimi-k2.5` (256K context, 8192 max tokens)
- Auth: `KIMI_API_KEY` env variable or `vibe kimi key <key>`
- Timeout: 60s, 3 retries (exponential backoff, 429/5xx)
- Same model as AZ Kimi K2.5, via Moonshot direct API

### GPT Embedding (OpenAI Direct)

- Endpoint: `https://api.openai.com/v1/embeddings`
- Model: `text-embedding-3-large` (same as AZ Embedding)
- Auth: `OPENAI_API_KEY` env variable or GPT API Key (OAuth not supported)
- Alternative to AZ Embedding; set priority with `vibe config embedding-priority gpt,az`

### Provider Priority Configuration

Managed via `priority` key in `.claude/vibe/config.json`:

```json
{
  "priority": {
    "embedding": ["az", "gpt"],
    "kimi": ["az", "kimi"]
  }
}
```

| Setting | Command | Default |
|---------|---------|---------|
| Embedding priority | `vibe config embedding-priority az,gpt` | AZ first |
| Kimi chat priority | `vibe config kimi-priority az,kimi` | AZ first |
| Show current config | `vibe config show` | - |

## Agents

### Main Agents (18)

- **Explorer** (high/medium/low) — Codebase exploration
- **Implementer** (high/medium/low) — Code implementation
- **Architect** (high/medium/low) — Architecture design
- **Searcher** — Code search
- **Tester** — Test generation
- **Simplifier** — Code simplification
- **Refactor Cleaner** — Refactoring cleanup
- **Build Error Resolver** — Build error fixing
- **Compounder** — Multi-step compound tasks
- **Diagrammer** — Diagram generation
- **E2E Tester** — E2E test execution
- **UI Previewer** — UI preview

### Review Agents (12)

security, performance, architecture, complexity, simplicity, data-integrity, test-coverage, git-history, typescript, python, rails, react → `agents/review/`

### Research Agents (4)

best-practices, framework-docs, codebase-patterns, security-advisory → `agents/research/`

### UI/UX Agents (8)

CSV data-driven design intelligence. BM25 search engine auto-generates industry-specific design strategies from 24 CSV files.

| Phase | Agent | Model | Role |
|-------|-------|-------|------|
| SPEC | 1. ui-industry-analyzer | Haiku | Industry analysis + design strategy |
| SPEC | 2. ui-design-system-gen | Sonnet | MASTER.md design system generation |
| SPEC | 3. ui-layout-architect | Haiku | Page structure/sections/CTA design |
| RUN | 4. ui-stack-implementer | Haiku | Framework-specific component guide |
| RUN | 5. ui-dataviz-advisor | Haiku | Chart/visualization library recommendations |
| REVIEW | 6. ux-compliance-reviewer | Haiku | UX guideline compliance verification |
| REVIEW | 7. ui-a11y-auditor | Haiku | WCAG 2.1 AA accessibility audit |
| REVIEW | 8. ui-antipattern-detector | Haiku | UI anti-pattern detection |

**Execution flow**: 1→2,3 (SPEC, supervisor-worker) → 4,5 (RUN, before Phase start) → 6,7,8 (REVIEW, on UI file changes)

**Disable**: Set `"uiUxAnalysis": false` in `.claude/vibe/config.json`

**MCP tools**: `core_ui_search`, `core_ui_stack_search`, `core_ui_generate_design_system`, `core_ui_persist_design_system`

**Data**: `~/.claude/vibe/ui-ux-data/` (11 domain CSVs + 13 stack CSVs)

→ `agents/ui/`

### Planning Agents (2)

requirements-analyst, ux-advisor → `agents/planning/`

### QA Agents (2)

edge-case-finder, acceptance-tester → `agents/qa/`

### Docs Agents (2)

api-documenter, changelog-writer → `agents/docs/`

### Mentor Agent (1)

junior-mentor — Junior developer mentor with EXPLANATION.md generation

### Agent Teams (Experimental)

> Agents form teams to collaborate via shared task lists with mutual feedback.
> Requirement: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (`.claude/settings.local.json` env)

| Team | Workflow | Members | Role |
|------|----------|---------|------|
| Research Team | `/vibe.spec` Step 3 | best-practices, security-advisory, codebase-patterns, framework-docs | Cross-validate + integrate research results |
| Review Debate Team | `/vibe.review` Phase 4.5 | security, architecture, performance, simplicity | Cross-validate P1/P2 + eliminate false positives |
| Implementation Team | `/vibe.run` ULTRAWORK | architect, implementer, tester, security-reviewer | Real-time collaborative implementation + instant feedback |

**Difference from parallel mode:**

| Aspect | Parallel Sub-agents | Agent Teams |
|--------|-------------------|-------------|
| Communication | Collect results only | Real-time mutual feedback |
| Verification | Post-hoc | Real-time cross-validation |
| Conflict resolution | Main agent decides | Team consensus (leader-driven) |

## Hooks System

| Event | Hooks |
|-------|-------|
| SessionStart | `session-start.js` |
| PreToolUse (Bash/Edit/Write) | `pre-tool-guard.js` |
| PostToolUse (Write/Edit) | `post-edit.js`, `code-check.js`, `post-tool-verify.js` |
| UserPromptSubmit | `prompt-dispatcher.js`, `skill-injector.js`, `keyword-detector.js`, `hud-status.js` |
| Notification (context 80/90/95%) | `context-save.js` |

**Additional hooks:** `code-review.js`, `llm-orchestrate.js`, `recall.js`, `complexity.js`, `compound.js`

## Language Support (25 frameworks)

- **TypeScript**: Next.js, React, Angular, NestJS, Vue, Svelte, Nuxt, Tauri, Electron, React Native, Node, Astro
- **Python**: Django, FastAPI
- **Java**: Spring
- **Kotlin**: Android
- **Ruby**: Rails
- **Go**, **Rust**, **Swift** (iOS), **C#** (Unity), **Dart** (Flutter), **GDScript** (Godot)

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
