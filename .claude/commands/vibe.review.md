---
description: Multi-agent parallel code review with priority-based findings
argument-hint: "PR number, branch name, or file path"
---

# /vibe.review

**Parallel Agent Code Review** - 13+ specialists review simultaneously

## Usage

```
/vibe.review                    # Review current branch
/vibe.review PR#123             # Review specific PR
/vibe.review feature/login      # Review specific branch
/vibe.review src/api/           # Review specific path
```

## Core Principle

```
┌─────────────────────────────────────────────────────────────────┐
│  All experts review simultaneously = Fast & Thorough            │
│                                                                 │
│  🔴 P1 (Critical): Blocks merge - MUST fix                      │
│  🟡 P2 (Important): Should fix - Before merge                   │
│  🔵 P3 (Nice-to-have): Enhancement - When time permits          │
└─────────────────────────────────────────────────────────────────┘
```

## Process

### Phase 1: Setup & Target Determination

```
📋 Review Target Analysis
├── Collect PR metadata (gh pr view)
├── Gather changed files (git diff --name-only)
├── Detect languages/frameworks
└── Identify related test files
```

### Phase 2: Parallel Agent Review (CRITICAL)

**Launch ALL agents simultaneously!**

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 PARALLEL AGENT LAUNCH (Run ALL at the same time)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Security & Safety                                              │
│  ├── security-reviewer      # OWASP Top 10, vulnerabilities     │
│  └── data-integrity-reviewer # Data validation, constraints     │
│                                                                 │
│  Performance & Architecture                                     │
│  ├── performance-reviewer   # N+1 queries, memory leaks         │
│  └── architecture-reviewer  # Layer violations, cycles          │
│                                                                 │
│  Code Quality                                                   │
│  ├── complexity-reviewer    # Cyclomatic complexity, length     │
│  └── simplicity-reviewer    # Over-abstraction, dead code       │
│                                                                 │
│  Language Specific (auto-detect)                                │
│  ├── python-reviewer        # PEP8, type hints, async patterns  │
│  ├── typescript-reviewer    # Type safety, ESLint rules         │
│  ├── rails-reviewer         # N+1, ActiveRecord, DHH style      │
│  └── react-reviewer         # Hook rules, re-renders, a11y      │
│                                                                 │
│  Context Analysis                                               │
│  ├── git-history-reviewer   # Churn files, risk patterns        │
│  └── test-coverage-reviewer # Missing tests, edge cases         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Agent invocation (ALL IN PARALLEL):**
```
Task(model: "haiku", subagent_type: "Explore", prompt: "Security review for...")
Task(model: "haiku", subagent_type: "Explore", prompt: "Performance review for...")
Task(model: "haiku", subagent_type: "Explore", prompt: "Architecture review for...")
... (ALL IN PARALLEL)
```

### Phase 3: Ultra-Thinking Deep Analysis

Deep analysis after agent results:

```markdown
## Deep Analysis Dimensions

1. **System Context**
   - Component interactions
   - Data flow
   - External dependencies

2. **Stakeholder Perspectives**
   - Developers: Maintainability
   - Ops: Deployment risk
   - Security: Vulnerabilities
   - Business: Impact

3. **Edge Cases & Failure Scenarios**
   - Race conditions
   - Resource exhaustion
   - Network failures
   - Malicious input

4. **Multiple Angles**
   - Technical excellence
   - Business value
   - Risk management
   - Team dynamics
```

### Phase 4: Findings Synthesis

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 REVIEW FINDINGS                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 P1 CRITICAL (Blocks Merge) - 2 issues                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  1. [SECURITY] SQL Injection in user query                      │
│     📍 src/api/users.py:42                                      │
│     💡 Use parameterized queries                                │
│                                                                 │
│  2. [DATA] Missing transaction rollback                         │
│     📍 src/services/payment.py:128                              │
│     💡 Wrap in try/except with rollback                         │
│                                                                 │
│  🟡 P2 IMPORTANT (Should Fix) - 5 issues                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  3. [PERF] N+1 query in user list                               │
│  4. [ARCH] Circular dependency detected                         │
│  5. [TEST] Missing edge case tests                              │
│  ...                                                            │
│                                                                 │
│  🔵 P3 NICE-TO-HAVE (Enhancement) - 3 issues                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  8. [STYLE] Consider extracting helper function                 │
│  ...                                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 5: Todo File Creation

Save findings to `.vibe/todos/`:

```markdown
## File Naming Convention

{priority}-{category}-{short-desc}.md

Examples:
- P1-security-sql-injection.md
- P2-perf-n1-query.md
- P3-style-extract-helper.md
```

**Todo File Format:**
```markdown
# [P1] SQL Injection Vulnerability

## Summary
User input directly concatenated in SQL query

## Location
- File: src/api/users.py
- Line: 42
- Function: get_user_by_email()

## Current Code
```python
query = f"SELECT * FROM users WHERE email = '{email}'"
```

## Suggested Fix
```python
query = "SELECT * FROM users WHERE email = %s"
cursor.execute(query, (email,))
```

## References
- OWASP SQL Injection: https://owasp.org/...
- Project DB Guide: docs/database.md

## Status
- [ ] Fix implemented
- [ ] Tests added
- [ ] Review approved
```

### Phase 6: Optional E2E Testing

```
Suggest E2E tests based on project type:
├── Web: /vibe.e2e (Playwright)
├── iOS: Xcode Test
├── Android: Espresso
└── API: Contract Test
```

## Output

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 CODE REVIEW SUMMARY                                          │
│  PR #123: Add user authentication                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Reviewers: 13 agents | Duration: 45s                           │
│                                                                 │
│  📈 Score: 72/100 (Needs Work)                                  │
│                                                                 │
│  Issues Found:                                                  │
│  ├── 🔴 P1 Critical: 2 (BLOCKS MERGE)                           │
│  ├── 🟡 P2 Important: 5                                         │
│  └── 🔵 P3 Nice-to-have: 3                                      │
│                                                                 │
│  By Category:                                                   │
│  ├── Security: 2                                                │
│  ├── Performance: 3                                             │
│  ├── Architecture: 1                                            │
│  ├── Testing: 2                                                 │
│  └── Style: 2                                                   │
│                                                                 │
│  📁 Todos created: .vibe/todos/ (10 files)                      │
│                                                                 │
│  ❌ MERGE BLOCKED - Fix P1 issues first                         │
│                                                                 │
│  Next Steps:                                                    │
│  1. Fix P1-security-sql-injection.md                            │
│  2. Fix P1-data-transaction-rollback.md                         │
│  3. Re-run: /vibe.review                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Priority Guidelines

| Priority | Criteria | Action |
|----------|----------|--------|
| 🔴 P1 | Security vulnerabilities, data loss, crashes | Block merge, fix immediately |
| 🟡 P2 | Performance issues, architecture violations, missing tests | Fix before merge |
| 🔵 P3 | Style, refactoring suggestions, documentation | Add to backlog |

## Related Commands

- `/vibe.e2e` - Run E2E tests
- `/vibe.compound` - Document solutions
- `/vibe.verify` - SPEC-based verification

---

ARGUMENTS: $ARGUMENTS
