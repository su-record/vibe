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

### Phase 5: Auto-Fix (P1/P2)

**자동 수정 가능한 이슈는 바로 해결:**

```
🔧 AUTO-FIX 시작...

P1 Critical:
  1. [SECURITY] SQL Injection → parameterized query로 수정 ✅
  2. [DATA] Transaction rollback 누락 → try-finally 추가 ✅

P2 Important:
  3. [PERF] N+1 query → select_related 추가 ✅
  4. [ARCH] Circular dependency → 의존성 분리 ✅
  5. [TEST] Missing edge case → 테스트 추가 ✅

🔍 재검증 중...
  ✅ 빌드 성공
  ✅ 테스트 통과

✅ 5개 이슈 자동 수정 완료!
```

**자동 수정 불가능한 경우:**
- 아키텍처 대규모 변경 필요
- 비즈니스 로직 결정 필요
- 사용자 확인 필요한 경우

→ Phase 7에서 수동 처리 안내

### Phase 6: Graph 저장 (배운점)

**문제 → 해결 과정을 `.claude/vibe/graph/`에 저장:**

```
📝 그래프 저장 중...

생성된 파일:
- 2024-01-15-sql-injection.md
- 2024-01-15-n1-query.md
- 2024-01-15-circular-dep.md

각 파일 구조:
---
problem: SQL Injection in users.py:42
category: security
severity: P1
solution: parameterized query 사용
code_before: |
  query = f"SELECT * FROM users WHERE id = {user_id}"
code_after: |
  query = "SELECT * FROM users WHERE id = %s"
  cursor.execute(query, (user_id,))
tags: [security, sql, python]
related: [input-validation, prepared-statements]
learned_at: 2024-01-15
project: my-app
---
```

**Graph 검색 (나중에 재사용):**
```bash
# 비슷한 문제 검색
grep -r "sql-injection" .claude/vibe/graph/
grep -r "tags:.*security" .claude/vibe/graph/
```

### Phase 7: Todo File Creation (수동 처리 필요 항목)

Save **remaining** findings to `.claude/vibe/todos/`:

```
{priority}-{category}-{short-desc}.md

Examples:
- P2-arch-large-refactor.md  (자동 수정 불가)
- P3-style-extract-helper.md (백로그)
```

## Output

```
CODE REVIEW SUMMARY
PR #123: Add user authentication

Reviewers: 13 agents | Duration: 45s

Score: 92/100 (Good) ← 자동 수정 후 점수

Issues Found:
- P1 Critical: 2 → 0 (✅ 자동 수정)
- P2 Important: 5 → 1 (✅ 4개 자동 수정)
- P3 Nice-to-have: 3 (백로그)

Auto-Fixed: 6 issues
- [SECURITY] SQL Injection ✅
- [DATA] Transaction rollback ✅
- [PERF] N+1 query ✅
- [ARCH] Circular dependency ✅
- [PERF] Unnecessary loop ✅
- [TEST] Missing edge case ✅

Graph Saved: .claude/vibe/graph/ (6 files)
- 이 프로젝트에서 배운 패턴 저장됨
- 다음에 비슷한 문제 시 자동 참조

Remaining (수동 처리 필요):
- P2-arch-large-refactor.md (아키텍처 결정 필요)
- P3-style-extract-helper.md (백로그)
- P3-docs-add-readme.md (백로그)

✅ MERGE READY (P1/P2 해결됨)
```

### Phase 8: Guide to Fix Workflow (수동 처리 항목)

**남은 이슈 처리 시 워크플로우 선택:**

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
