# Vibe

**SPEC-driven AI coding framework** (Claude Code only)

[![npm version](https://img.shields.io/npm/v/@su-record/vibe.svg)](https://www.npmjs.com/package/@su-record/vibe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
npm install -g @su-record/vibe
vibe init
```

## Commands

### Terminal

| Command | Description |
|---------|-------------|
| `vibe init` | Initialize project |
| `vibe update` | Update settings |
| `vibe status` | Check status |
| `vibe auth gpt` | GPT OAuth authentication |
| `vibe auth gemini` | Gemini OAuth authentication |
| `vibe logout gpt` | GPT logout |
| `vibe logout gemini` | Gemini logout |
| `vibe help` | Help |
| `vibe version` | Version info |

### Claude Code

| Command | Description |
|---------|-------------|
| `/vibe.spec "feature"` | Create SPEC + parallel research |
| `/vibe.run "feature"` | Execute implementation |
| `/vibe.run "feature" ultrawork` | Maximum performance mode |
| `/vibe.verify "feature"` | BDD verification |
| `/vibe.review` | 13+ agent parallel review |
| `/vibe.analyze` | Code analysis |
| `/vibe.reason "problem"` | Systematic reasoning |
| `/vibe.utils` | Utilities (--e2e, --diagram, etc.) |

## Workflow

```
/vibe.spec → /vibe.run → /vibe.verify → /vibe.review
```

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-model orchestration** | Claude + GPT-5.2 + Gemini 3 Pro |
| **13+ parallel review agents** | Security, performance, architecture |
| **BDD auto verification** | Given/When/Then scenario verification |
| **ULTRAWORK mode** | One keyword enables all optimizations |
| **36 built-in tools** | Code analysis, memory management, quality validation |
| **Auto context management** | 80%+ auto-save, session restore |

## ULTRAWORK Mode

Enable maximum performance with `ultrawork` or `ulw`:

```bash
/vibe.run "feature" ultrawork
/vibe.run "feature" ulw        # Same
```

**Enabled features:**
- Parallel subagent exploration (3+ concurrent)
- Boulder Loop (auto-progress until all scenarios complete)
- Auto-retry on errors (max 3)
- Continuous execution without phase confirmation
- Auto-save at 80%+ context

## Multi-model Orchestration

Call GPT/Gemini directly with hook prefixes:

| LLM | Prefix | Example | Features |
|-----|--------|---------|----------|
| GPT | `gpt-`, `gpt.` | `gpt.weather today` | Web Search enabled |
| Gemini | `gemini-`, `gemini.` | `gemini.UI improvements` | Google Search enabled |

| Scenario | Recommended | Example |
|----------|-------------|---------|
| Latest info search | GPT | `gpt.React 19 changes` |
| UI/UX review | Gemini | `gemini.improve this form UX` |
| Architecture review | GPT | `gpt-review this architecture` |
| Code analysis | Gemini | `gemini-analyze this code` |

**Direct API call:**

```javascript
import('@su-record/vibe/lib/gpt').then(g => g.quickWebSearch('weather today'))
import('@su-record/vibe/lib/gemini').then(g => g.quickAsk('question'))
```

## Parallel Review Agents

`/vibe.review` runs 13+ agents concurrently:

| Category | Agents |
|----------|--------|
| Security | security-reviewer, data-integrity-reviewer |
| Performance | performance-reviewer, complexity-reviewer |
| Architecture | architecture-reviewer, simplicity-reviewer |
| Language | python, typescript, rails, react reviewers |
| Context | git-history, test-coverage reviewers |

**Priority:**
- 🔴 P1 (Critical): Blocks merge
- 🟡 P2 (Important): Recommended fix
- 🔵 P3 (Nice-to-have): Backlog

## Built-in Tools

| Tool | Description |
|------|-------------|
| `vibe_find_symbol` | Find symbol definition |
| `vibe_find_references` | Find references |
| `vibe_analyze_complexity` | Complexity analysis |
| `vibe_validate_code_quality` | Quality validation |
| `vibe_start_session` | Start session (restore previous context) |
| `vibe_save_memory` | Save important decisions |
| `vibe_auto_save_context` | Auto-save current state |

## Project Structure

**Global install (`~/.claude/`):**

```text
~/.claude/
├── commands/       # Slash commands (7)
├── agents/         # Review/research agents
├── skills/         # Auto-activated guides (7)
└── settings.json   # Hooks + MCP settings
```

**Project-specific (`project/.claude/vibe/`):**

```text
.claude/vibe/
├── specs/          # SPEC documents
├── features/       # BDD scenarios
├── rules/          # Coding rules (per stack)
├── solutions/      # Solution archive
├── config.json     # Project settings
└── constitution.md # Project principles
```

## Code Quality Standards

| Metric | Limit |
|--------|-------|
| Function length | 30 lines recommended, 50 allowed |
| Nesting depth | 3 levels max |
| Parameters | 5 max |
| Cyclomatic complexity | 10 max |

## Usage Example

```
User: /vibe.spec "login feature"

Claude: You're building a login feature! I have a few questions.
        1. Auth method? (email/password, OAuth, Passkey)
        2. Tech stack?
        ...

[Requirements confirmed via conversation]
[4 parallel research agents run]

✅ SPEC document created
📄 .claude/vibe/specs/login.md
📄 .claude/vibe/features/login.feature

Next: /vibe.run "login feature" ultrawork
```

## Requirements

- Node.js 18.0.0+
- Claude Code

## License

MIT - [GitHub](https://github.com/su-record/vibe)

## Vibe Setup (AI Coding)

This project uses [Vibe](https://github.com/su-record/vibe) AI coding framework.

### Collaborator Install

```bash
# Global install (recommended)
npm install -g @su-record/vibe
vibe update

# Or run setup script
./.claude/vibe/setup.sh
```

### Usage

Use slash commands in Claude Code:
- `/vibe.spec "feature"` - Create SPEC document
- `/vibe.run "feature"` - Execute implementation
