# Vibe

**SPEC-Scenario-driven AI coding framework for Claude Code with Multi-LLM orchestration**  

[![npm version](https://img.shields.io/npm/v/@su-record/vibe.svg)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
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
| `vibe gpt auth` | GPT OAuth authentication |
| `vibe gpt key <KEY>` | GPT API key setup |
| `vibe gpt logout` | GPT logout |
| `vibe gemini auth` | Gemini OAuth authentication |
| `vibe gemini key <KEY>` | Gemini API key setup |
| `vibe gemini logout` | Gemini logout |
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
| **25 built-in tools** | Code analysis, memory management, quality validation |
| **Auto context management** | 80%+ auto-save, session restore |
| **23 language presets** | TypeScript, Python, Go, Rust, Swift, Kotlin, C#, Ruby, Dart, GDScript |

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

**Hook-based automatic routing** - Keywords in your prompt trigger the right LLM automatically:

| Keyword Pattern | Routes to | Use Case |
|-----------------|-----------|----------|
| `아키텍처`, `architecture`, `설계` | GPT | Architecture review |
| `UI`, `UX`, `디자인` | Gemini | UI/UX feedback |
| `디버깅`, `debugging`, `버그 찾` | GPT | Bug analysis |
| `코드 분석`, `analyze code` | Gemini | Code review |

**Smart Routing features:**
- Automatic LLM selection based on task type
- Exponential backoff retry (3 attempts, 2s → 4s → 8s)
- Auto fallback chain: GPT ↔ Gemini (if primary fails)
- 5-minute availability cache
- Web search via Gemini (Google Search grounding)

**API usage:**

```javascript
import('@su-record/vibe/lib/gpt').then(g => g.ask('question'))
import('@su-record/vibe/lib/gemini').then(g => g.webSearch('search query'))
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

## Built-in Tools (25)

| Category | Tools |
|----------|-------|
| **Semantic** | `find_symbol`, `find_references`, `analyze_dependency_graph` |
| **Convention** | `analyze_complexity`, `validate_code_quality`, `check_coupling_cohesion`, `suggest_improvements`, `apply_quality_rules` |
| **Memory** | `start_session`, `save_memory`, `auto_save_context`, `recall_memory`, `search_memories`, `search_memories_advanced`, `list_memories`, `update_memory`, `delete_memory`, `link_memories`, `prioritize_memory`, `get_memory_graph`, `create_memory_timeline`, `get_session_context`, `restore_session_context` |
| **UI** | `preview_ui_ascii` |
| **Time** | `get_current_time` |

## Project Structure

**Global install (`~/.claude/`):**

```text
~/.claude/
├── commands/       # Slash commands (7)
├── agents/         # Review/research agents
├── skills/         # Auto-activated guides (7)
└── settings.json   # Hooks settings
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

## Context7 Plugin (Recommended)

Install context7 plugin for up-to-date library documentation:

```bash
/plugin install context7
```

**Benefits:**

- **Skill integration**: Auto-invokes context7 for library/API questions without prompting
- **Subagent isolation**: Docs queries run in separate context, preventing main context bloat
- **Knowledge cutoff solution**: Access latest docs for long coding sessions

**Usage:**

- Automatic: Ask library questions, vibe's skill triggers context7
- Manual: `/context7:docs <library> [query]`

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

# Or use vibe init to setup
vibe init
```

### Usage

Use slash commands in Claude Code:
- `/vibe.spec "feature"` - Create SPEC document
- `/vibe.run "feature"` - Execute implementation

---

⭐ If this helps your workflow, consider giving it a star!
