# Vibe

**SPEC-driven AI Coding Framework with Multi-LLM Orchestration**

[![npm version](https://img.shields.io/npm/v/@su-record/vibe.svg)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> AI coding framework for Claude Code. SPEC-based requirements management, Multi-LLM (Claude + GPT + Gemini) orchestration, and automated quality assurance with 13+ parallel review agents.

## Quick Start

```bash
npm install -g @su-record/vibe
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
| `/vibe.run "feature"` | Execute implementation |
| `/vibe.run "feature" ultrawork` | Maximum performance mode |
| `/vibe.verify "feature"` | BDD verification |
| `/vibe.trace "feature"` | Requirements traceability matrix |
| `/vibe.review` | 13+ agent parallel review |
| `/vibe.review --race` | GPT + Gemini race review |

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

### Race Review

Run GPT + Gemini in parallel for cross-validation:

```bash
/vibe.review --race
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
import { launch, poll } from '@su-record/vibe/orchestrator';
const { taskId } = launch({ prompt: 'Analyze code', agentName: 'analyzer' });
const result = await poll(taskId);

// Swarm pattern - Auto-split complex tasks
import { swarm } from '@su-record/vibe/orchestrator';
const result = await swarm({
  prompt: 'Implement login with: 1. UI 2. Validation 3. API 4. Tests',
  maxDepth: 2,
  splitThreshold: 15,
});

// LLM direct call
import { ask } from '@su-record/vibe/lib/gpt';
import { webSearch } from '@su-record/vibe/lib/gemini';
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

MIT - [GitHub](https://github.com/su-record/vibe)
