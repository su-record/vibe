# Vibe

**SPEC-driven AI coding framework with integrated MCP tooling**

Transform natural language requirements into production-ready code through structured specification, planning, and task decomposition.

[![npm version](https://img.shields.io/npm/v/@su-record/vibe.svg)](https://www.npmjs.com/package/@su-record/vibe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features

- **SPEC-driven Development**: Structured Q&A process using EARS (Easy Approach to Requirements Syntax)
- **Automated Planning**: Generate technical implementation plans with architecture, cost analysis, and timeline
- **Task Decomposition**: Break down features into phase-based, dependency-aware tasks
- **MCP Integration**: 38 built-in tools for code analysis, quality validation, and project insights
- **Multi-language Support**: English and Korean interface
- **AI Agent System**: 7 specialized agents for different tech stacks

---

## Installation

```bash
npm install -g @su-record/vibe
```

This automatically:
- Installs the Vibe CLI
- Registers the MCP server with 38 development tools
- Enables slash commands for Claude Code

---

## Quick Start

```bash
# Initialize project
vibe init

# Create specification through guided Q&A
vibe spec "push notification settings"

# Generate technical plan
vibe plan "push notification settings"

# Decompose into tasks
vibe tasks "push notification settings"

# Implement tasks
vibe run "Task 1-1"

# Verify implementation
vibe verify "push notification settings"
```

---

## Command Reference

### Core Workflow Commands

| Command | Description | Example |
|---------|-------------|---------|
| `vibe init` | Initialize Vibe in current project | `vibe init` |
| `vibe spec <name>` | Create SPEC through 6-question Q&A | `vibe spec "user authentication"` |
| `vibe plan <name>` | Generate technical implementation plan | `vibe plan "user authentication"` |
| `vibe tasks <name>` | Break down into executable tasks | `vibe tasks "user authentication"` |
| `vibe run <task>` | Execute specific task with auto-generated guide | `vibe run "Task 1-1"` |
| `vibe run --phase <N>` | Execute all tasks in phase N | `vibe run --phase 1` |
| `vibe run --all` | Execute all tasks sequentially | `vibe run --all` |
| `vibe verify <name>` | Verify implementation against SPEC | `vibe verify "user authentication"` |

### Analysis & Tools

| Command | Description | Example |
|---------|-------------|---------|
| `vibe analyze` | Comprehensive project analysis | `vibe analyze` |
| `vibe analyze --code` | Code quality and complexity analysis | `vibe analyze --code` |
| `vibe analyze --deps` | Dependency and security audit | `vibe analyze --deps` |
| `vibe analyze --arch` | Architecture and coupling analysis | `vibe analyze --arch` |
| `vibe ui <description>` | Generate ASCII UI mockup | `vibe ui "login form"` |
| `vibe diagram` | Generate architecture diagram (Mermaid) | `vibe diagram` |
| `vibe diagram --er` | Generate ERD diagram | `vibe diagram --er` |
| `vibe diagram --flow` | Generate flowchart | `vibe diagram --flow` |

### Utility Commands

| Command | Description |
|---------|-------------|
| `vibe agents` | List available AI agents |
| `vibe skills` | List installed skill modules |
| `vibe help` | Show command help |

---

## Slash Commands (Claude Code)

Use these commands directly in Claude Code:

| Command | Description |
|---------|-------------|
| `/vibe.spec "feature"` | Create specification |
| `/vibe.plan "feature"` | Generate plan |
| `/vibe.tasks "feature"` | Generate tasks |
| `/vibe.run "Task 1-1"` | Execute task |
| `/vibe.verify "feature"` | Verify implementation |
| `/vibe.analyze` | Analyze project |
| `/vibe.ui "description"` | Preview UI |
| `/vibe.diagram --er` | Generate diagram |

---

## Project Structure

```
your-project/
├── .vibe/
│   ├── config.json          # Configuration (language, agents, MCP)
│   ├── constitution.md      # Project development principles
│   ├── specs/               # SPEC documents (EARS format)
│   ├── plans/               # Technical implementation plans
│   ├── tasks/               # Phase-based task breakdowns
│   ├── guides/              # Auto-generated implementation guides
│   ├── reports/             # Analysis and verification reports
│   └── diagrams/            # Generated diagrams (Mermaid)
└── CLAUDE.md                # Tech stack documentation (recommended)
```

---

## MCP Integration

Vibe includes 38 MCP tools across multiple categories:

### Code Analysis
- `analyze_complexity` - Cyclomatic and cognitive complexity metrics
- `validate_code_quality` - Code quality scoring and recommendations
- `check_coupling_cohesion` - Module coupling and cohesion analysis

### Project Intelligence
- `find_symbol` - Locate function/class definitions
- `find_references` - Find all usages of symbols

### Thinking & Planning
- `create_thinking_chain` - Generate step-by-step reasoning
- `step_by_step_analysis` - Detailed problem breakdown
- `analyze_problem` - Structured problem analysis

### Quality & Standards
- `apply_quality_rules` - Apply coding standards
- `suggest_improvements` - Code improvement recommendations

### UI & Design
- `preview_ui_ascii` - Generate ASCII UI mockups

### Memory & Context
- `save_memory` - Store project context
- `recall_memory` - Retrieve stored information
- `auto_save_context` - Automatic context checkpointing

**Verify MCP server:**
```bash
claude mcp list
# vibe: node /path/to/vibe/mcp/dist/index.js - ✓ Connected
```

---

## Configuration

### .vibe/config.json

```json
{
  "language": "ko",
  "agents": {
    "default": "backend-python-expert"
  },
  "mcp": {
    "enabled": true,
    "servers": ["vibe"]
  }
}
```

### CLAUDE.md (Recommended)

Place this file in your project root to enable automatic tech stack detection:

```markdown
# CLAUDE.md

## Tech Stack

### Backend
- Framework: FastAPI 0.104+
- Database: PostgreSQL 17
- Cache: Redis 7.2

### Frontend
- Framework: Flutter 3.24+
- State Management: Provider
```

---

## Specification Format

Vibe uses EARS (Easy Approach to Requirements Syntax):

```markdown
# SPEC: Feature Name

## Metadata
- Created: 2025-01-17
- Priority: HIGH
- Language: en

## Requirements

### REQ-001: Requirement Title
**WHEN** user performs action X
**THEN** system SHALL perform Y

#### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### REQ-002: Another Requirement
**WHERE** condition A exists
**AND** condition B is true
**THEN** system SHALL perform Z
```

---

## AI Agents

| Agent | Specialization | Tech Stack |
|-------|----------------|------------|
| Specification Agent | Requirements gathering through 6-question framework | Language-agnostic |
| Planning Agent | Technical architecture and cost analysis | Cross-stack |
| Task Agent | Phase-based task decomposition | Cross-stack |
| Backend Python Expert | Python/FastAPI implementation | Python 3.11+, FastAPI, SQLAlchemy |
| Frontend Flutter Expert | Flutter/Dart implementation | Flutter 3.24+, Dart 3.5+ |
| Frontend React Expert | React/Next.js implementation | React 18+, Next.js 14+ |
| Database PostgreSQL Expert | PostgreSQL/PostGIS design | PostgreSQL 17, PostGIS 3.4+ |
| Quality Reviewer | Code review and quality validation | Multi-language |

---

## Workflow Example

### 1. Create Specification

```bash
$ vibe spec "push notification settings"

Q1. Why: Reduce app churn from excessive notifications
Q2. Who: All users (100k+ DAU)
Q3. What: 6-category notification toggle system
Q4. How: P95 < 500ms, Redis caching, rate limiting
Q5. When: 3 days (24 hours development time)
Q6. With What: FastAPI + Flutter + PostgreSQL + FCM

✅ Created: .vibe/specs/push-notification-settings.md
```

### 2. Generate Plan

```bash
$ vibe plan "push notification settings"

✅ Created: .vibe/plans/push-notification-settings.md

Summary:
- 3 Phases: Backend → Frontend → FCM Integration
- Timeline: 24 hours (3 days)
- Cost: +$0.50/month (Redis + FCM)
- Stack Reuse: 100% existing infrastructure
```

### 3. Decompose Tasks

```bash
$ vibe tasks "push notification settings"

✅ Created: .vibe/tasks/push-notification-settings.md

Task Breakdown:
- Total: 19 tasks
- Phase 1 (Backend): 8 tasks
- Phase 2 (Frontend): 8 tasks
- Phase 3 (FCM): 3 tasks
- Dependency graph included
```

### 4. Execute Tasks

```bash
$ vibe run "Task 1-1"

Executing: Task 1-1 - Database Migration

Steps:
1. Read task details from .vibe/tasks/push-notification-settings.md
2. Generate implementation guide: .vibe/guides/task-1-1.md
3. Execute: Create migration file with 6 columns
4. Verify: Run `alembic upgrade head`
5. Update status: ⬜ → ✅

✅ Task 1-1 completed
```

### 5. Code Analysis

```bash
$ vibe analyze --code

📊 Code Quality Report

Overall Score: 85/100 (B+)

Findings:
- High complexity: src/service.py (CC: 15)
- Low cohesion: src/utils.py (0.3)
- Strong coupling: Controller ↔ Service (0.8)

Recommendations:
1. Refactor src/service.py into 3 modules
2. Apply Dependency Injection pattern
3. Extract unrelated utilities from src/utils.py

Report saved: .vibe/reports/analysis-2025-11-17.md
```

### 6. UI Mockup

```bash
$ vibe ui "login form with email, password, and submit button"

┌─────────────────────────────────────────┐
│            Welcome Back                  │
├─────────────────────────────────────────┤
│                                          │
│         ┌─────────────────────┐          │
│  Email: │                     │          │
│         └─────────────────────┘          │
│                                          │
│         ┌─────────────────────┐          │
│  Pass:  │ ••••••••••••        │          │
│         └─────────────────────┘          │
│                                          │
│         ┌─────────────────────┐          │
│         │      Sign In        │          │
│         └─────────────────────┘          │
│                                          │
└─────────────────────────────────────────┘

Required Components:
- Header.tsx (Welcome message)
- EmailInput.tsx (Email field)
- PasswordInput.tsx (Password field with masking)
- Button.tsx (Submit button)
- LoginForm.tsx (Form container)
```

---

## Best Practices

### 1. Document Your Tech Stack

Create `CLAUDE.md` in your project root to enable automatic tech stack detection and prevent technology drift.

### 2. Execute Phase by Phase

Instead of `--all`, execute and verify each phase independently:

```bash
vibe run --phase 1  # Backend development
# Verify, test, commit

vibe run --phase 2  # Frontend development
# Verify, test, commit

vibe run --phase 3  # Integration
# Verify, test, commit
```

### 3. Validate Acceptance Criteria

Each task includes acceptance criteria. Ensure all criteria pass before marking tasks complete.

### 4. Leverage MCP Tools

Use analysis commands before refactoring:

```bash
vibe analyze --code      # Identify complexity hotspots
vibe analyze --deps      # Check for outdated/vulnerable packages
vibe analyze --arch      # Detect circular dependencies
```

---

## Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 7.0.0 or higher
- **Claude Code**: Required for slash commands

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

---

## License

MIT License - see [LICENSE](LICENSE) file for details

---

## Links

- **Repository**: [github.com/su-record/vibe](https://github.com/su-record/vibe)
- **Issues**: [GitHub Issues](https://github.com/su-record/vibe/issues)
- **MCP Server**: [@su-record/hi-ai](https://github.com/su-record/hi-ai)
- **Documentation**: [Full Documentation](https://github.com/su-record/vibe/wiki)

---

## Support

For questions and support:
- Open an issue on GitHub
- Check the documentation wiki
- Review existing discussions

---

**Built with ❤️ by the Vibe team**
