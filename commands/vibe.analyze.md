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

Choose a workflow to proceed with development:

| Task Scope | Recommended Approach |
|----------|----------|
| Simple fix (1-2 files) | Plan Mode |
| Complex feature (3+ files, research/verification needed) | /vibe.spec |

1. `/vibe.spec "feature-name"` - VIBE workflow (parallel research + SPEC verification)
2. Plan Mode - Quick implementation (for simple tasks)

Which approach would you like to use?
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

## Quality Gate (Mandatory)

### Analysis Quality Checklist

Before completing analysis, ALL items must be checked:

| Category | Check Item | Weight |
|----------|------------|--------|
| **Completeness** | All related files identified | 20% |
| **Completeness** | All API endpoints documented | 15% |
| **Completeness** | All data models mapped | 15% |
| **Accuracy** | File paths verified to exist | 10% |
| **Accuracy** | Line numbers accurate | 10% |
| **Depth** | Business logic explained | 10% |
| **Depth** | Dependencies mapped | 10% |
| **Actionability** | Next steps clearly defined | 10% |

### Analysis Score Calculation

```
Score = Σ(checked items × weight) / 100

Grades:
- 95-100: ✅ EXCELLENT - Comprehensive analysis
- 85-94:  ✅ GOOD - Ready for development
- 70-84:  ⚠️ FAIR - Needs more exploration
- 0-69:   ❌ POOR - Incomplete, re-analyze
```

### Analysis Depth Levels

| Level | Scope | Output |
|-------|-------|--------|
| **L1: Surface** | File names, basic structure | File list only |
| **L2: Structure** | Functions, classes, imports | Structure map |
| **L3: Logic** | Business logic, data flow | Flow diagrams |
| **L4: Deep** | Edge cases, dependencies, risks | Full analysis |

**Minimum required: L3 for feature analysis, L2 for project overview**

### Analysis Output Requirements

Every analysis MUST include:

1. **Overview Section**
   - Feature description (1 sentence)
   - Implementation status (Complete/In progress/Not implemented)
   - Related file count

2. **Structure Section**
   - API endpoints table (Method, Path, Description, Auth)
   - Core services list with key methods
   - Data models with fields and relationships

3. **Reference File List**
   - Absolute or relative paths
   - Line number ranges for key sections
   - Brief description per file

4. **Next Steps**
   - Workflow choice prompt (Plan Mode vs VIBE)
   - Specific action items if applicable

### Forbidden Incomplete Patterns

| Pattern | Issue | Required Fix |
|---------|-------|--------------|
| "and more..." | Incomplete list | List all items |
| "etc." | Vague scope | Be specific |
| "related files" without list | Missing details | Provide file paths |
| Missing line numbers | Hard to navigate | Add `:L10-50` format |
| No auth info on endpoints | Security gap | Always specify auth |

### Code Quality Analysis Thresholds

When running `--code` analysis:

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Avg Complexity | ≤10 | 11-15 | >15 |
| Max Function Length | ≤30 | 31-50 | >50 |
| High Complexity Files | 0 | 1-3 | >3 |
| Circular Dependencies | 0 | 1 | >1 |

### Dependency Analysis Thresholds

When running `--deps` analysis:

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Outdated Packages | 0-3 | 4-10 | >10 |
| Security Vulnerabilities | 0 | 1-2 (low) | Any high/critical |
| Major Version Behind | 0 | 1-2 | >2 |

---

ARGUMENTS: $ARGUMENTS
