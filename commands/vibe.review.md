---
description: Multi-agent parallel code review with priority-based findings
argument-hint: "PR number, branch name, or file path"
---

# /vibe.review

**Parallel Agent Code Review** - 13+ specialists review simultaneously

## Usage

```
/vibe.review                         # Review current branch
/vibe.review PR#123                  # Review specific PR
/vibe.review feature/login           # Review specific branch
/vibe.review src/api/                # Review specific path
```

## Priority System

| Priority | Criteria | Action |
|----------|----------|--------|
| P1 | Security vulnerabilities, data loss, crashes | Block merge, fix immediately |
| P2 | Performance issues, architecture violations, missing tests | Fix before merge |
| P3 | Style, refactoring suggestions, documentation | Add to backlog |

## Process

### Phase 1: Tech Stack Detection

Detect project tech stack FIRST before launching reviewers:

```
Read package.json      -> TypeScript, React, Node.js
Read pyproject.toml    -> Python, FastAPI, Django
Read Gemfile           -> Ruby, Rails
Read pubspec.yaml      -> Flutter, Dart
Read go.mod            -> Go
Read CLAUDE.md         -> Explicit tech stack declaration
```

### Phase 2: Parallel Agent Review (STACK-AWARE) via Orchestrator

**Execution via Orchestrator (12+ agents in parallel):**
```bash
node -e "import('@su-record/vibe/orchestrator').then(o => o.review(['FILE_PATHS'], ['DETECTED_STACKS']).then(r => console.log(r.content[0].text)))"
```

**Example:**
```bash
# Review changed files with TypeScript + React stack
node -e "import('@su-record/vibe/orchestrator').then(o => o.review(['src/api/users.ts', 'src/components/Login.tsx'], ['TypeScript', 'React']).then(r => console.log(r.content[0].text)))"
```

**Core Reviewers (Always Run):**
| Agent | Focus |
|-------|-------|
| security-reviewer | OWASP Top 10, vulnerabilities |
| data-integrity-reviewer | Data validation, constraints |
| performance-reviewer | N+1 queries, memory leaks |
| architecture-reviewer | Layer violations, cycles |
| complexity-reviewer | Cyclomatic complexity, length |
| simplicity-reviewer | Over-abstraction, dead code |
| git-history-reviewer | Churn files, risk patterns |
| test-coverage-reviewer | Missing tests, edge cases |

**Stack-Specific Reviewers (Conditional):**
| Agent | Condition |
|-------|-----------|
| python-reviewer | .py files in diff |
| typescript-reviewer | .ts/.tsx files OR tsconfig |
| rails-reviewer | Gemfile has rails |
| react-reviewer | package.json has react |

### Phase 3: Deep Analysis

After agent results:

1. **System Context**: Component interactions, data flow, external dependencies
2. **Stakeholder Perspectives**: Developers, Ops, Security, Business
3. **Edge Cases**: Race conditions, resource exhaustion, network failures
4. **Multiple Angles**: Technical excellence, business value, risk management

### Phase 4: Findings Synthesis

```
REVIEW FINDINGS

P1 CRITICAL (Blocks Merge) - N issues
1. [SECURITY] SQL Injection in user query
   Location: src/api/users.py:42
   Fix: Use parameterized queries

P2 IMPORTANT (Should Fix) - N issues
2. [PERF] N+1 query in user list
3. [ARCH] Circular dependency detected

P3 NICE-TO-HAVE (Enhancement) - N issues
4. [STYLE] Consider extracting helper function
```

### Phase 5: Todo File Creation

Save findings to `.claude/vibe/todos/`:

```
{priority}-{category}-{short-desc}.md

Examples:
- P1-security-sql-injection.md
- P2-perf-n1-query.md
- P3-style-extract-helper.md
```

## Output

```
CODE REVIEW SUMMARY
PR #123: Add user authentication

Reviewers: 13 agents | Duration: 45s

Score: 72/100 (Needs Work)

Issues Found:
- P1 Critical: 2 (BLOCKS MERGE)
- P2 Important: 5
- P3 Nice-to-have: 3

By Category:
- Security: 2
- Performance: 3
- Architecture: 1
- Testing: 2
- Style: 2

Todos created: .claude/vibe/todos/ (10 files)

MERGE BLOCKED - Fix P1 issues first

Next Steps:
1. Fix P1-security-sql-injection.md
2. Fix P1-data-transaction-rollback.md
3. Re-run: /vibe.review
```

### Phase 6: Guide to Fix Workflow

**Ask user to choose workflow** when fix is requested:

```
## Fix Workflow

발견된 이슈를 수정하려면 워크플로우를 선택하세요:

| 작업 규모 | 권장 방식 |
|----------|----------|
| 간단한 수정 (1-2 파일) | Plan Mode |
| 복잡한 수정 (3+ 파일, 검증 필요) | /vibe.spec |

1. `/vibe.spec "fix: issue-name"` - VIBE 워크플로우 (SPEC 검증 + 재리뷰)
2. Plan Mode - 빠른 수정 (간단한 작업용)

어떤 방식으로 진행할까요?
```

- Wait for user's choice before proceeding
- If user chooses VIBE → wait for `/vibe.spec` command
- If user chooses Plan Mode → proceed with EnterPlanMode

## Vibe Tools (Code Analysis)

### Tool Invocation

All tools are called via:

```bash
node -e "import('@su-record/vibe/tools').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Recommended Tools for Review

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `validateCodeQuality` | Code quality check | Overall code quality scan |
| `analyzeComplexity` | Complexity metrics | Check function complexity |
| `findSymbol` | Find definitions | Locate implementations |
| `findReferences` | Find all usages | Track symbol usage |
| `saveMemory` | Save findings | Store important review findings |

### Example Tool Usage in Review

**1. Validate code quality before review:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.validateCodeQuality({targetPath: 'src/', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**2. Analyze complexity of changed files:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.analyzeComplexity({targetPath: 'src/api/users.ts', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**3. Save critical finding for reference:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.saveMemory({key: 'review-pr123-critical', value: 'SQL injection in users.py:42', category: 'review', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

---

ARGUMENTS: $ARGUMENTS
