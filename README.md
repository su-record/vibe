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
| `/vibe.trace "feature"` | Requirements traceability matrix (v2.6) |
| `/vibe.review` | 13+ agent parallel review (`--race` for GPT+Gemini) |
| `/vibe.analyze` | Code analysis |
| `/vibe.reason "problem"` | Systematic reasoning |
| `/vibe.utils --ui` | UI preview (Gemini image / ASCII fallback) |
| `/vibe.utils --e2e` | E2E testing, diagrams, etc. |

## Workflow

```
/vibe.spec → /vibe.run → /vibe.trace → /vibe.verify → /vibe.review
                              ↑
                     Coverage check (v2.6)
```

## Key Features

| Feature | Description |
|---------|-------------|
| **Race Review (v2.6.9)** | GPT + Gemini parallel review with cross-validation |
| **Fire-and-Forget Agents (v2.6)** | Non-blocking background execution with instant handle return |
| **Phase Pipelining (v2.6)** | Prepare next phase during current execution |
| **PRD-to-SPEC Automation (v2.6)** | Auto-generate SPEC from PRD documents |
| **Traceability Matrix (v2.6)** | REQ → SPEC → Feature → Test coverage tracking |
| **Multi-LLM Research (v2.5)** | Claude + GPT + Gemini 3-way validation during SPEC research |
| **Multi-model orchestration** | Claude + GPT-5.2 + Gemini 3 Pro |
| **13+ parallel review agents** | Security, performance, architecture |
| **Iterative SPEC review** | GPT + Gemini convergence loop (max 3 rounds) |
| **Large SPEC auto-split** | 5+ phases auto-split into phase files |
| **BDD auto verification** | Given/When/Then scenario verification |
| **ULTRAWORK mode** | One keyword enables all optimizations |
| **30+ built-in tools** | Code analysis, memory management, quality validation |
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
- **Background agents** (v2.6) - Prepare next phase during implementation
- **Phase pipelining** (v2.6) - Zero wait time between phases
- Boulder Loop (auto-progress until all scenarios complete)
- Auto-retry on errors (max 3)
- Continuous execution without phase confirmation
- Auto-save at 80%+ context

## Fire-and-Forget Background Manager (v2.6)

Non-blocking task execution with instant response:

```typescript
import { launch, poll, getStats } from '@su-record/vibe/orchestrator';

// Fire-and-forget: returns immediately (<100ms)
const { taskId } = launch({
  prompt: 'Analyze codebase security',
  agentName: 'security-agent',
  model: 'claude-sonnet-4-5'
});

// Poll for result later
const result = await poll(taskId);

// Check queue stats
const stats = getStats();
```

**Concurrency limits:**

| Model  | Concurrent Limit |
|--------|------------------|
| Opus   | 3                |
| Sonnet | 5                |
| Haiku  | 8                |

**Queue features:**

- Bounded queue (max 100 tasks)
- Per-model rate limiting
- Task timeout: 180s individual, 10min pipeline
- Automatic cleanup (24h TTL)

## Phase Pipelining (v2.6)

Prepare next phase while current phase executes:

```
Phase N execution     │ Background: Phase N+1 preparation
──────────────────────┼──────────────────────────────────
[Implementing...]     │ [Analyzing files for next phase]
[Testing...]          │ [Pre-generating test cases]
[Complete]            │ [Ready to start immediately!]
                      ↓
Phase N+1 starts with ZERO wait time
```

**Speed comparison:**

| Mode                      | 5 Phases Total |
|---------------------------|----------------|
| Sequential                | ~10min         |
| Parallel Exploration      | ~7.5min        |
| **ULTRAWORK + Pipeline**  | **~5min**      |

## PRD-to-SPEC Automation (v2.6)

Auto-generate SPEC from PRD documents:

```typescript
import { parsePRD } from '@su-record/vibe/tools';

// Parse PRD (supports Markdown, YAML frontmatter)
const prd = parsePRD(prdContent, 'login-feature');

// Extracted requirements with auto-generated IDs
// REQ-login-001, REQ-login-002, ...
```

**Requirement ID System:**

- Format: `REQ-{feature}-{number}`
- Auto-deduplication
- Priority inference from keywords (must, should, nice-to-have)

## Requirements Traceability Matrix (v2.6)

Track coverage from requirements to tests:

```bash
/vibe.trace "feature-name"  # Generate RTM
```

**RTM tracks:**

```
REQ-login-001 → SPEC Phase 1 → Feature Scenario 1 → login.test.ts
REQ-login-002 → SPEC Phase 2 → Feature Scenario 3 → auth.test.ts
```

**Coverage report:**

- Requirements coverage %
- Missing implementations
- Untested features
- Export: Markdown, HTML

## SPEC Versioning (v2.6)

Automatic version management for SPEC documents:

```typescript
import { bumpVersion, generateChangelog } from '@su-record/vibe/tools';

// Auto-bump version on SPEC changes
await bumpVersion('feature-name', 'minor');

// Generate changelog
await generateChangelog('feature-name');
```

**Features:**

- Semantic versioning (major.minor.patch)
- Git tag integration
- Automatic changelog generation
- Baseline tagging for releases

## UI Preview (`--ui`)

Generate UI previews from text description or design folder:

```bash
/vibe.utils --ui "login form with email/password"
/vibe.utils --ui ./design/dashboard/
```

**Features:**

- **Gemini enabled**: Generates actual UI mockup image
- **Gemini disabled**: ASCII art fallback
- Supports: HTML, PNG, JPG, CSS, JSON, SVG, MD

## Multi-model Orchestration

**Hook-based automatic routing** - Keywords in your prompt trigger the right LLM automatically:

| Keyword Pattern | Routes to | Use Case |
|-----------------|-----------|----------|
| `architecture`, `design` | GPT | Architecture review |
| `UI`, `UX` | Gemini | UI/UX feedback |
| `debugging`, `find bug` | GPT | Bug analysis |
| `analyze code` | Gemini | Code review |

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

## Multi-LLM Research (v2.5)

During `/vibe.spec`, research agents use **3 LLM perspectives** for quality assurance:

```text
┌─────────────────────────────────────────────────────────────┐
│  MULTI-LLM PARALLEL RESEARCH                                │
├─────────────────────────────────────────────────────────────┤
│  best-practices-agent                                       │
│    ├── Claude: Core patterns, anti-patterns                 │
│    ├── GPT: Architecture patterns, code conventions         │
│    └── Gemini: Latest trends, framework updates             │
├─────────────────────────────────────────────────────────────┤
│  security-advisory-agent                                    │
│    ├── Claude: OWASP Top 10, security patterns              │
│    ├── GPT: CVE database, vulnerability details             │
│    └── Gemini: Latest security advisories, patches          │
└─────────────────────────────────────────────────────────────┘
```

> vibe = Quality Assurance Framework

## Race Review (v2.6.9)

**Multi-LLM competitive review** - Same task runs on GPT + Gemini in parallel, results cross-validated:

```bash
/vibe.review --race              # All review types
/vibe.review --race security     # Security only
```

**Cross-validation confidence:**

| Agreement         | Priority | Action                  |
|-------------------|----------|-------------------------|
| Both agree (100%) | P1       | High confidence finding |
| One model (50%)   | P2       | Needs verification      |

**Output:**

```text
🏁 RACE REVIEW
├─ GPT:    [SQL injection, XSS]
└─ Gemini: [SQL injection, CSRF]
         ↓
Cross-validation:
- SQL injection (2/2) → 🔴 P1 (100%)
- XSS (1/2) → 🟡 P2 (50%)
- CSRF (1/2) → 🟡 P2 (50%)
```

**ULTRAWORK default:** Race review is automatically enabled in ULTRAWORK mode.

**API usage:**

```javascript
import('@su-record/vibe/tools').then(t =>
  t.raceReview({ reviewType: 'security', code: 'CODE' })
   .then(r => console.log(t.formatRaceResult(r)))
)
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

## Cursor IDE Support (v2.6.8)

VIBE automatically installs Cursor-compatible assets on `vibe init` and `vibe update`:

**Installed locations:**

| Asset | Path | Count |
| ----- | ---- | ----- |
| Subagents | `~/.cursor/agents/*.md` | 12 |
| Skills | `~/.cursor/skills/*/SKILL.md` | 7 |
| Rules Template | `~/.cursor/rules-template/*.mdc` | 5 |

**12 Review Subagents with optimized model mapping:**

| Agent Type | Model | Purpose |
| ---------- | ----- | ------- |
| security, architecture, data-integrity | `claude-4.5-sonnet-thinking` | Deep reasoning |
| typescript, python, react, rails | `gpt-5.2-codex` | Code understanding |
| performance, complexity, simplicity, test-coverage, git-history | `gemini-3-flash` | Fast pattern checks |

**7 Skills (VIBE workflow guides):**

- `vibe-spec` - SPEC creation
- `vibe-run` - Implementation execution
- `vibe-review` - Parallel code review
- `vibe-analyze` - Project analysis
- `vibe-verify` - Requirement verification
- `vibe-reason` - Systematic reasoning
- `vibe-ui` - UI preview utilities

**5 Rules Templates:**

- `typescript-standards.mdc` - Type safety, complexity limits
- `react-patterns.mdc` - Component patterns
- `code-quality.mdc` - General quality rules
- `security-checklist.mdc` - OWASP checklist
- `python-standards.mdc` - PEP8, type hints

**Usage in Cursor:**

```text
# Invoke subagent
"Use security-reviewer to check this code"

# Use skill workflow
"vibe spec login feature"
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
