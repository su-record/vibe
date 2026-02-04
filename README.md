# Vibe

**SPEC-driven AI Coding Framework with Multi-LLM Orchestration**

[![npm version](https://img.shields.io/npm/v/@su-record/core.svg)](https://www.npmjs.com/package/@su-record/core)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/core)](https://www.npmjs.com/package/@su-record/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> AI coding framework for Claude Code. SPEC-based requirements management, Multi-LLM (Claude + GPT + Gemini) orchestration, and automated quality assurance with 13+ parallel review agents.

## Quick Start

```bash
npm install -g @su-record/core
vibe init
```

## Core Workflow

```
/vibe.spec → /vibe.spec.review → [SPEC Summary] → /vibe.run → /vibe.trace → /vibe.review → [Retrospective]
     ↓              ↓                  ↓               ↓            ↓              ↓              ↓
  Write SPEC   GPT/Gemini Review  User Review     Execute     Traceability   Parallel Review  Auto-Save
```

### Workflow Details

| Step | Command | What Happens |
|------|---------|-------------|
| 1 | `/vibe.spec "feature"` | Generate SPEC + parallel research agents |
| 2 | `/vibe.spec.review "feature"` | 3-round GPT/Gemini cross-validation |
| 3 | SPEC Summary | User reviews spec before implementation |
| 4 | `/vibe.run "feature"` | Execute implementation phase-by-phase |
| 5 | `/vibe.trace "feature"` | Requirements traceability matrix |
| 6 | `/vibe.review` | 13+ parallel review agents |
| 7 | Auto-Retrospective | Lessons learned saved for cross-session recall |

## Key Features

| Feature | Description |
|---------|-------------|
| **SPEC-driven Development** | Traceable: Requirements → SPEC → Feature → Test |
| **Multi-LLM Orchestration** | Claude + GPT + Gemini 3-way verification |
| **13+ Parallel Review Agents** | Security, Performance, Architecture, etc. |
| **ULTRAWORK Mode** | All optimizations with a single keyword |
| **Smart Hook Dispatcher** | Pattern-matched prompt routing (no wasted LLM calls) |
| **Progress Tracking** | `claude-progress.txt` survives context compaction |
| **Auto-Retrospective** | Lessons learned auto-saved after `/vibe.run` |
| **Swarm Pattern** | Auto-split complex tasks for parallel processing |
| **23 Language Presets** | TypeScript, Python, Go, Rust, Swift, Kotlin, and more |

## Commands

### Terminal

| Command | Description |
|---------|-------------|
| `vibe init` | Initialize project |
| `vibe update` | Update configuration |
| `vibe status` | Check status |
| `vibe gpt auth` | GPT OAuth authentication |
| `vibe gemini auth` | Gemini OAuth authentication |

### Claude Code Slash Commands

| Command | Description |
|---------|-------------|
| `/vibe.spec "feature"` | Generate SPEC document + parallel research |
| `/vibe.spec.review "feature"` | GPT/Gemini 3-round cross-validation |
| `/vibe.run "feature"` | Execute implementation |
| `/vibe.run "feature" ultrawork` | Maximum performance mode |
| `/vibe.verify "feature"` | BDD verification |
| `/vibe.trace "feature"` | Requirements traceability matrix |
| `/vibe.review` | 13+ agent parallel review (race mode 기본 포함) |
| `/vibe.review --quick` | Fast review (race 없음) |
| `/vibe.analyze` | Project analysis |
| `/vibe.reason "problem"` | Systematic reasoning framework |
| `/vibe.utils --ui "desc"` | UI mockup preview |
| `/vibe.utils --diagram` | Generate diagrams (Mermaid) |
| `/vibe.utils --e2e` | E2E testing (Playwright) |
| `/vibe.utils --image "desc"` | Image generation (Gemini) |
| `/vibe.utils --continue` | Session restore |

## ULTRAWORK Mode

Activate maximum performance with `ultrawork` or `ulw` keyword:

```bash
/vibe.run "feature" ultrawork
```

**Enabled Features:**
- Parallel sub-agent exploration (3+ concurrent)
- Background agents (prepare next phase during implementation)
- Phase pipelining (eliminate wait time between phases)
- Boulder Loop (auto-continue until all scenarios complete)
- Auto-save at 80%+ context

**Performance:**

| Mode | Relative Speed |
|------|---------------|
| Sequential | Baseline |
| Parallel | ~25% faster |
| **ULTRAWORK + Pipeline** | **~50% faster** |

## Multi-LLM Orchestration

### Smart Hook Dispatcher

A single dispatcher reads user prompts and routes to the right LLM only when patterns match. No wasted API calls:

| Pattern | Routes to | Use Case |
|---------|-----------|----------|
| Architecture keywords | GPT | Architecture review |
| UI/UX keywords | Gemini | UI/UX feedback |
| Debug keywords | GPT | Bug analysis |
| Code analysis keywords | Gemini | Code quality review |
| No match | None | No external LLM call |

### Race Review (Default)

GPT + Gemini run in parallel for cross-validation. **Enabled by default** since v2.6.30.

```bash
/vibe.review           # Race mode included
/vibe.review --quick   # Fast mode (no race)
```

| Agreement | Priority | Action |
|-----------|----------|--------|
| Both agree (100%) | P1 | High confidence |
| One model (50%) | P2 | Needs verification |

## Parallel Review Agents

Run 13+ agents simultaneously with `/vibe.review`:

| Category | Agents |
|----------|--------|
| Security | security-reviewer, data-integrity-reviewer |
| Performance | performance-reviewer, complexity-reviewer |
| Architecture | architecture-reviewer, simplicity-reviewer |
| Language | python, typescript, rails, react reviewers |

**Priority System:**
- P1 (Critical): Blocks merge
- P2 (Important): Fix recommended
- P3 (Nice-to-have): Backlog

## Swarm Pattern

Automatically split complex tasks for parallel processing:

```
Prompt → Complexity Analysis → Split Decision
                ↓
    Low  → Direct execution
    High → Create subtasks → Parallel processing → Merge results
```

Tasks are scored by complexity. When the score exceeds the threshold (default: 15), the task is automatically split into subtasks and processed in parallel.

## Session RAG

Structured session context storage with hybrid BM25 search. Keeps decisions, constraints, goals, and evidence across sessions.

| Entity | Description | Auto-injected |
|--------|-------------|---------------|
| **Decision** | User-confirmed choices with rationale | Recent active decisions |
| **Constraint** | Technical/business limitations | High/critical severity |
| **Goal** | Objective stack with progress tracking | Active goals |
| **Evidence** | Test/build/lint verification results | - |

**Tools:**

| Tool | Purpose |
|------|---------|
| `save_session_item` | Save decision/constraint/goal/evidence |
| `retrieve_session_context` | Hybrid search (BM25 + recency + priority) |
| `manage_goals` | Goal lifecycle (list/update/complete) |

Active goals and key constraints are automatically injected at session start via `start_session`.

```typescript
import { saveSessionItem, retrieveSessionContext, manageGoals } from '@su-record/core/tools';

await saveSessionItem({ itemType: 'decision', title: 'Use Vitest', rationale: 'Fast and modern' });
await saveSessionItem({ itemType: 'constraint', title: 'No vector DB', type: 'technical', severity: 'high' });
await saveSessionItem({ itemType: 'goal', title: 'Implement login', priority: 2 });
await retrieveSessionContext({ query: 'testing strategy' });
await manageGoals({ action: 'complete', goalId: 1 });
```

## Requirements Traceability

Track from requirements to tests with `/vibe.trace`:

```
REQ-login-001 → SPEC Phase 1 → Feature Scenario 1 → login.test.ts
REQ-login-002 → SPEC Phase 2 → Feature Scenario 3 → auth.test.ts
```

## Project Structure

**Global (`~/.claude/`):**
```
~/.claude/
├── commands/     # Slash commands
├── agents/       # Review/research agents
├── skills/       # Auto-activated guides
└── settings.json # Hooks
```

**Project (`.claude/vibe/`):**
```
.claude/vibe/
├── specs/              # SPEC documents
├── features/           # BDD scenarios
├── retros/             # Auto-retrospectives
├── progress.json       # Structured progress state
├── claude-progress.txt # Human-readable progress (for context survival)
├── config.json         # Project settings
└── constitution.md
```

## Code Quality Standards

| Metric | Limit |
|--------|-------|
| Function length | 30 lines (recommended), 50 lines (allowed) |
| Nesting depth | 3 levels |
| Parameters | 5 |
| Cyclomatic complexity | 10 |

## API Usage

```typescript
// Background agent
import { launch, poll } from '@su-record/core/orchestrator';
const { taskId } = launch({ prompt: 'Analyze code', agentName: 'analyzer' });
const result = await poll(taskId);

// Swarm pattern - Auto-split complex tasks
import { swarm } from '@su-record/core/orchestrator';
const result = await swarm({
  prompt: 'Implement login with: 1. UI 2. Validation 3. API 4. Tests',
  maxDepth: 2,
  splitThreshold: 15,
});

// LLM direct call
import { ask } from '@su-record/core/lib/gpt';
import { webSearch } from '@su-record/core/lib/gemini';
```

## IDE Support

### Cursor

Assets auto-installed on `vibe init/update`:

| Asset | Path | Count |
|-------|------|-------|
| Subagents | `~/.cursor/agents/` | 12 |
| Skills | `~/.cursor/skills/` | 7 |
| Rules | `~/.cursor/rules-template/` | 23 languages |

## Requirements

- Node.js 18.0.0+
- Claude Code

## License

MIT - [GitHub](https://github.com/su-record/core)
