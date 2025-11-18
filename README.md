# Vibe

**SPEC-driven AI coding framework with integrated MCP tooling**

Transform natural language requirements into production-ready code through structured specification, planning, and task decomposition.

[![npm version](https://img.shields.io/npm/v/@su-record/vibe.svg)](https://www.npmjs.com/package/@su-record/vibe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Smithery Badge](https://smithery.ai/badge/@su-record/hi-ai)](https://smithery.ai/protocol/@su-record/hi-ai)
[![MCP Tools](https://img.shields.io/badge/MCP_Tools-38-blue.svg)](https://github.com/su-record/hi-ai)

---

## Features

- **Claude Code Optimized**: Built specifically for Claude Code with native slash commands and MCP integration
- **SPEC-driven Development**: Structured Q&A process using EARS (Easy Approach to Requirements Syntax)
- **BDD + Contract Testing**: AI-optimized testing with Gherkin features and API contract validation (🚧 v0.2.0)
- **Automated Planning**: Generate technical implementation plans with architecture, cost analysis, and timeline
- **Task Decomposition**: Break down features into phase-based, dependency-aware tasks
- **Powered by @su-record/hi-ai**: 38 MCP tools combining skills and hi-ai for code analysis, quality validation, and insights
- **Multi-language Support**: English and Korean interface
- **AI Agent System**: 7 specialized agents for different tech stacks

---

## Installation

```bash
npm install -g @su-record/vibe
```

This installs:
- Vibe CLI (for initialization only)
- @su-record/hi-ai MCP server (38 development tools)
- Agents, Skills, Templates for Claude Code

⚠️ **Important**: Vibe is a **Claude Code-exclusive** framework. Terminal commands are limited to `init` only. All development commands are available as **slash commands** within Claude Code.

---

## Quick Start

### 1. Initialize Project (Terminal)

```bash
# Option 1: Initialize in existing project
vibe init

# Option 2: Create new project
vibe init my-new-project
cd my-new-project
```

This will:
- Register MCP server for the project directory
- Create `.vibe/` folder structure
- Install agents, skills, and templates

### 2. Use Slash Commands (Claude Code)

Open Claude Code in your project directory and use slash commands:

```
/vibe.spec "push notification settings"
/vibe.plan "push notification settings"
/vibe.tasks "push notification settings"
/vibe.run "Task 1-1"
/vibe.verify "push notification settings"
```

---

## Command Reference

### Terminal Commands (Initialization Only)

| Command | Description | Example |
|---------|-------------|---------|
| `vibe init` | Initialize Vibe in current project | `vibe init` |
| `vibe init <name>` | Create new project with Vibe | `vibe init my-app` |
| `vibe help` | Show help message | `vibe help` |

### Claude Code Slash Commands (Development)

#### Core Workflow

| Command | Description | Example |
|---------|-------------|---------|
| `/vibe.spec <name>` | Create SPEC through natural conversation (auto-detects project type, suggests tech stack & design) | `/vibe.spec "user authentication"` |
| `/vibe.plan <name>` | Generate technical implementation plan | `/vibe.plan "user authentication"` |
| `/vibe.tasks <name>` | Break down into executable tasks | `/vibe.tasks "user authentication"` |
| `/vibe.run <task>` | Execute specific task with auto-generated guide | `/vibe.run "Task 1-1"` |
| `/vibe.verify <name>` | Verify implementation against SPEC | `/vibe.verify "user authentication"` |

#### Analysis & Tools

| Command | Description | Example |
|---------|-------------|---------|
| `/vibe.analyze` | Comprehensive project analysis | `/vibe.analyze` |
| `/vibe.ui <description>` | Generate ASCII UI mockup | `/vibe.ui "login form"` |
| `/vibe.diagram --er` | Generate diagrams (architecture, ERD, flow) | `/vibe.diagram --er` |

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

**MCP Server Registration:**

The MCP server is automatically registered when you run `vibe init` in your project. This registers the server **locally for your project only**, not globally.

**Verify MCP server:**
```bash
# Run this in your project directory
claude mcp list
# Expected output:
# vibe: node /path/to/@su-record/vibe/node_modules/@su-record/hi-ai/dist/index.js - ✓ Connected
```

**Important:** Each project that uses Vibe must run `vibe init` to register the MCP server for that specific project.

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

### 1. Initialize Project (Terminal)

```bash
$ vibe init
🔧 MCP 서버 확인 중...
✅ vibe MCP 서버 등록 완료
✅ vibe 초기화 완료!

생성된 구조:
  .vibe/
  ├── config.json
  ├── constitution.md
  ├── specs/
  ├── plans/
  └── tasks/
```

### 2. Create Specification (Claude Code)

**Note**: Examples shown in English. Claude responds in the language set in `.vibe/config.json` (default: Korean).

```
User: /vibe.spec "push notification settings"

Claude (Specification Agent):
[Analyzing source code]
- Backend: Python (FastAPI)
- Frontend: Flutter 3.24+
- Database: PostgreSQL 17

Existing project detected! Is this tech stack correct?

User: Yes

Claude:
What types of notifications do you want to manage?

User: Comments, likes, follows, announcements, events, marketing

Claude:
Do you need just ON/OFF toggle for each category, or detailed settings too?

1. ON/OFF only
2. Detailed settings (time, frequency, etc.)
3. Both

Or you can describe directly.

User: 1

Claude:
Which push notification service would you like to use?

1. Firebase Cloud Messaging (FCM) - Free, easy Flutter integration
2. OneSignal - Multi-platform, dashboard
3. Custom implementation

Or you can describe directly.

User: We're already using FCM

Claude:
Great! Which design reference would you like to follow?

1. iOS Settings > Notifications (toggle + grouping)
2. Slack notification settings (category-based)
3. Twitter notification settings (simple list)

Or you can describe directly.

User: 1

...

✅ SPEC document created!
📄 .vibe/specs/push-notification-settings.md
```

### 3. Generate Plan (Claude Code)

```
User: /vibe.plan "push notification settings"

Claude (Planning Agent):
SPEC을 분석하여 기술 계획을 작성하겠습니다.

✅ PLAN 문서 작성 완료!
📄 .vibe/plans/push-notification-settings.md

Summary:
- 3 Phases: Backend → Frontend → FCM Integration
- Timeline: 24 hours (3 days)
- Cost: +$0.50/month (Redis + FCM)
```

### 4. Decompose Tasks (Claude Code)

```
User: /vibe.tasks "push notification settings"

Claude (Task Agent):
PLAN을 기반으로 Task를 생성하겠습니다.

✅ TASKS 문서 작성 완료!
📄 .vibe/tasks/push-notification-settings.md

Task Breakdown:
- Total: 19 tasks
- Phase 1 (Backend): 8 tasks
- Phase 2 (Frontend): 8 tasks
- Phase 3 (FCM): 3 tasks
```

### 5. Execute Tasks (Claude Code)

```
User: /vibe.run "Task 1-1"

Claude:
Task 1-1 - Database Migration을 실행하겠습니다.

1. 구현 가이드 생성 (.vibe/guides/task-1-1.md)
2. Migration 파일 생성
3. Acceptance Criteria 검증
4. Task 상태 업데이트

✅ Task 1-1 completed
```

### 6. Code Analysis (Claude Code)

```
User: /vibe.analyze

Claude:
프로젝트 전체를 분석하겠습니다.

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
```

### 7. UI Mockup (Claude Code)

```
User: /vibe.ui "login form"

Claude:
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
- EmailInput.tsx, PasswordInput.tsx, Button.tsx
```

---

## Best Practices

### 1. Document Your Tech Stack

Create `CLAUDE.md` in your project root to enable automatic tech stack detection and prevent technology drift.

### 2. Execute Phase by Phase

Execute and verify each phase independently in Claude Code:

```
/vibe.run --phase 1  # Backend development
# Verify, test, commit

/vibe.run --phase 2  # Frontend development
# Verify, test, commit

/vibe.run --phase 3  # Integration
# Verify, test, commit
```

### 3. Validate Acceptance Criteria

Each task includes acceptance criteria. Ensure all criteria pass before marking tasks complete.

### 4. Leverage MCP Tools

Use analysis commands in Claude Code before refactoring:

```
/vibe.analyze --code      # Identify complexity hotspots
/vibe.analyze --deps      # Check for outdated/vulnerable packages
/vibe.analyze --arch      # Detect circular dependencies
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

**Built with ❤️ by Su & Claude**
