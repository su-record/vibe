---
description: Analyze project or specific feature/module
argument-hint: "feature-name" or --code or --deps or --arch
---

# /vibe.analyze

Analyze project or specific feature/module.

## Usage

```
/vibe.analyze                  # Full project quality analysis
/vibe.analyze "login"          # Login related code exploration + context collection
/vibe.analyze --code           # Code quality analysis only
/vibe.analyze --deps           # Dependency analysis only
/vibe.analyze --arch           # Architecture analysis only
```

## Context Reset

**When this command runs, previous conversation is ignored.**
- Explore and analyze code from scratch like new session
- Base conversation only on newly collected information from this analysis

---

## Mode 1: Feature/Module Analysis (`/vibe.analyze "feature-name"`)

### Goal

**Explore all source code** related to user's requested feature/module and **analyze flow** to:
1. Understand current implementation status
2. Understand code structure and dependencies
3. Build context for immediate response to future development/modification requests

### Process

#### 1. Request Analysis

Extract key keywords from user request:
- Feature name (e.g., login, feed, payment)
- Action (e.g., create, read, update, delete)
- Scope (e.g., backend only, frontend only, full)

#### 2. Understand Project Structure

Read `CLAUDE.md`, `package.json`, `pyproject.toml`, etc. to identify tech stack:

**Backend:**
- FastAPI/Django: `app/api/`, `app/services/`, `app/models/`
- Express/NestJS: `src/controllers/`, `src/services/`, `src/models/`

**Frontend:**
- React/Next.js: `src/components/`, `src/pages/`, `src/hooks/`
- Flutter: `lib/screens/`, `lib/services/`, `lib/providers/`

#### 3. Explore Related Code (Parallel via Orchestrator)

**Exploration strategy using orchestrator:**
```bash
# Discover available agents
node -e "import('@su-record/vibe/orchestrator').then(o => o.listAgents().then(r => console.log(r.content[0].text)))"

# Run parallel exploration agents
node -e "import('@su-record/vibe/orchestrator').then(async o => {
  const results = await Promise.all([
    o.runAgent('Find all [FEATURE] related API endpoints', 'api-explorer'),
    o.runAgent('Find all [FEATURE] related services/logic', 'service-explorer'),
    o.runAgent('Find all [FEATURE] related data models', 'model-explorer')
  ]);
  console.log('Exploration agents started');
})"
```

**Alternative (direct tools):**
1. **Glob** to collect related file list
2. **Grep** to locate code by keyword
3. **Read** to analyze key files in detail

#### 4. Flow Analysis

**API Flow:**
- Endpoint URL and HTTP method
- Request/response schema
- Authentication/authorization requirements

**Business Logic:**
- Core methods and roles
- Validation rules
- External service integrations

**Data Flow:**
- Related tables/models
- Relationships (1:N, N:M)
- Key query patterns

#### 5. Output Analysis Results

```markdown
## [feature-name] Analysis Results

### Overview
- **Feature description**: [one-line summary]
- **Implementation status**: [Complete/In progress/Not implemented]
- **Related files**: N files

### Structure

#### API Endpoints
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/v1/auth/login | Login | - |

#### Core Services
- `auth_service.py`: Authentication logic
  - `login()`: Login processing
  - `verify_token()`: Token verification

#### Data Models
- `User`: User table
  - Key fields: id, email, password_hash
  - Relationships: Session (1:N)

### Reference File List
- src/api/auth/router.py:L10-50
- src/services/auth_service.py:L1-100
```

#### 6. Complete & Next Action

After analysis:
1. Output analysis summary
2. **Ask user to choose workflow** when development is requested:

```
## Next Steps

개발을 진행하려면 워크플로우를 선택하세요:

| 작업 규모 | 권장 방식 |
|----------|----------|
| 간단한 수정 (1-2 파일) | Plan Mode |
| 복잡한 기능 (3+ 파일, 리서치/검증 필요) | /vibe.spec |

1. `/vibe.spec "feature-name"` - VIBE 워크플로우 (병렬 리서치 + SPEC 검증)
2. Plan Mode - 빠른 구현 (간단한 작업용)

어떤 방식으로 진행할까요?
```

3. Wait for user's choice before proceeding
4. If user chooses VIBE → wait for `/vibe.spec` command
5. If user chooses Plan Mode → proceed with EnterPlanMode

---

## Mode 2: Project Quality Analysis (--code/--deps/--arch)

### Analysis Scope

- **Default** (`/vibe.analyze`): Full analysis (code + dependencies + architecture)
- **--code**: Code quality analysis only
- **--deps**: Dependency analysis only
- **--arch**: Architecture analysis only

### Code Quality Analysis (--code)

- Complexity analysis (Cyclomatic Complexity)
- Code quality validation
- Coupling/cohesion check

### Dependency Analysis (--deps)

- Read `package.json` / `pyproject.toml` / `pubspec.yaml`
- Analyze version conflicts, security vulnerabilities, packages needing updates

### Architecture Analysis (--arch)

- Find core modules
- Identify module dependencies
- Detect circular dependencies, layer violations

### Analysis Report

`.claude/vibe/reports/analysis-{date}.md`:

```markdown
# Project Analysis Report

## Overview
- Analysis date: 2025-01-06 12:00
- Analysis scope: Full

## Code Quality (85/100)
- Average complexity: 8.2 (good)
- High complexity files: 3

## Dependencies (92/100)
- Total packages: 42
- Updates needed: 3

## Architecture (78/100)
- Circular dependencies: 2 found
- Layer violations: 1

## Improvement Suggestions
1. Refactor service.py
2. Apply lodash security patch
```

## Vibe Tools (Semantic Analysis)

### Tool Invocation

All tools are called via:

```bash
node -e "import('@su-record/vibe/tools').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Recommended Tools for Analysis

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `findSymbol` | Find symbol definitions | Locate function/class implementations |
| `findReferences` | Find all references | Track usage patterns |
| `analyzeComplexity` | Complexity analysis | Measure code complexity metrics |
| `validateCodeQuality` | Quality validation | Check code quality standards |
| `saveMemory` | Save analysis results | Store analysis findings |

### Example Tool Usage in Analysis

**1. Find function definition:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.findSymbol({symbolName: 'login', searchPath: 'src/'}).then(r => console.log(r.content[0].text)))"
```

**2. Analyze complexity:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.analyzeComplexity({targetPath: 'src/services/', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**3. Validate code quality:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.validateCodeQuality({targetPath: 'src/', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**4. Save analysis results:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.saveMemory({key: 'analysis-login-module', value: 'Found 5 related files, complexity avg 6.2', category: 'analysis', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

---

ARGUMENTS: $ARGUMENTS
