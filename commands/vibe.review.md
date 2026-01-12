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

### Phase 2: Parallel Agent Review (STACK-AWARE)

**Launch ONLY relevant agents based on detected stack!**

**ALWAYS RUN (Core Reviewers):**
- security-reviewer: OWASP Top 10, vulnerabilities
- data-integrity-reviewer: Data validation, constraints
- performance-reviewer: N+1 queries, memory leaks
- architecture-reviewer: Layer violations, cycles
- complexity-reviewer: Cyclomatic complexity, length
- simplicity-reviewer: Over-abstraction, dead code
- git-history-reviewer: Churn files, risk patterns
- test-coverage-reviewer: Missing tests, edge cases

**CONDITIONAL (Based on Detected Stack):**
- python-reviewer: IF .py files in diff
- typescript-reviewer: IF .ts/.tsx files OR tsconfig
- rails-reviewer: IF Gemfile has rails
- react-reviewer: IF package.json has react

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

---

ARGUMENTS: $ARGUMENTS
