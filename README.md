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
/vibe.spec → /vibe.run → /vibe.trace → /vibe.verify → /vibe.review
     ↓            ↓            ↓             ↓              ↓
  Write SPEC   Execute    Traceability   BDD Verify   Parallel Review
```

## Key Features

| Feature | Description |
|---------|-------------|
| **SPEC-driven Development** | Traceable development: Requirements → SPEC → Feature → Test |
| **Multi-LLM Orchestration** | Claude + GPT + Gemini 3-way verification with automatic routing |
| **13+ Parallel Review Agents** | Parallel code review: Security, Performance, Architecture, etc. |
| **ULTRAWORK Mode** | Enable all optimizations with a single keyword |
| **Fire-and-Forget Agents** | Non-blocking background agent execution |
| **Phase Pipelining** | Prepare next phase while current phase executes |
| **Swarm Pattern** | Auto-split complex tasks for parallel processing (v2.7) |
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

**Speed Comparison:**

| Mode | 5 Phases |
|------|----------|
| Sequential | ~10min |
| Parallel | ~7.5min |
| **ULTRAWORK + Pipeline** | **~5min** |

## Multi-LLM Orchestration

### Automatic Routing

Automatically routes to the optimal LLM based on prompt keywords:

| Keyword | Routes to | Use Case |
|---------|-----------|----------|
| `architecture`, `design` | GPT | Architecture review |
| `UI`, `UX` | Gemini | UI/UX feedback |
| `debugging` | GPT | Bug analysis |
| `analyze code` | Gemini | Code review |

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

## Swarm Pattern (v2.7)

Automatically split complex tasks for parallel processing:

```typescript
import { swarm, analyzeTaskComplexity } from '@su-record/vibe/orchestrator';

// Analyze complexity
const analysis = analyzeTaskComplexity('Your prompt');
console.log(analysis.score); // Split if >= 15

// Execute swarm
const result = await swarm({
  prompt: 'Complex task...',
  maxDepth: 2,           // Maximum split depth
  splitThreshold: 15,    // Complexity threshold
});
```

**How it works:**
```
Prompt → Complexity Analysis → Split Decision
                ↓
    ┌─ Low → Direct execution
    └─ High → Create subtasks → Parallel processing → Merge results
```

## Requirements Traceability (v2.6)

Track from requirements to tests:

```bash
/vibe.trace "feature"
```

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
├── specs/        # SPEC documents
├── features/     # BDD scenarios
├── config.json   # Project settings
└── constitution.md
```

## Code Quality Standards

| Metric | Limit |
|--------|-------|
| Function length | 30 lines (recommended), 50 lines (allowed) |
| Nesting depth | 3 levels |
| Parameters | 5 |
| Cyclomatic complexity | 10 |

## Cursor IDE Support

Assets auto-installed on `vibe init/update`:

| Asset | Path | Count |
|-------|------|-------|
| Subagents | `~/.cursor/agents/` | 12 |
| Skills | `~/.cursor/skills/` | 7 |
| Rules | `~/.cursor/rules-template/` | 23 languages |

## API Usage

```typescript
// Background agent
import { launch, poll } from '@su-record/vibe/orchestrator';
const { taskId } = launch({ prompt: 'Analyze code', agentName: 'analyzer' });
const result = await poll(taskId);

// Swarm pattern (v2.7) - Auto-split complex tasks
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

## Requirements

- Node.js 18.0.0+
- Claude Code

## License

MIT - [GitHub](https://github.com/su-record/vibe)

---

If this helps your workflow, consider giving it a star!
