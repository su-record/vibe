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

### Phase 1: Tech Stack Detection & Target Analysis

**Detect project tech stack FIRST before launching reviewers:**

```
📋 Tech Stack Detection
├── Read package.json      → TypeScript, React, Node.js
├── Read pyproject.toml    → Python, FastAPI, Django
├── Read Gemfile           → Ruby, Rails
├── Read pubspec.yaml      → Flutter, Dart
├── Read go.mod            → Go
├── Read CLAUDE.md         → Explicit tech stack declaration
└── Analyze file extensions in changed files
```

**Detection Logic:**
```javascript
// Stack detection from project files
const stack = {
  typescript: hasFile("package.json") && (hasDep("typescript") || hasFile("tsconfig.json")),
  react: hasDep("react") || hasDep("next"),
  python: hasFile("pyproject.toml") || hasFile("requirements.txt"),
  rails: hasFile("Gemfile") && hasDep("rails"),
  go: hasFile("go.mod"),
  flutter: hasFile("pubspec.yaml")
};
```

**Changed Files Analysis:**
```
git diff --name-only HEAD~1
├── src/components/*.tsx  → React reviewer needed
├── app/api/*.py          → Python reviewer needed
├── app/models/*.rb       → Rails reviewer needed
└── No .ts files          → Skip TypeScript reviewer
```

### Phase 2: Parallel Agent Review (STACK-AWARE)

**Launch ONLY relevant agents based on detected stack!**

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 PARALLEL AGENT LAUNCH (Stack-Aware Selection)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ ALWAYS RUN (Core Reviewers)                                 │
│  ├── security-reviewer      # OWASP Top 10, vulnerabilities     │
│  ├── data-integrity-reviewer # Data validation, constraints     │
│  ├── performance-reviewer   # N+1 queries, memory leaks         │
│  ├── architecture-reviewer  # Layer violations, cycles          │
│  ├── complexity-reviewer    # Cyclomatic complexity, length     │
│  ├── simplicity-reviewer    # Over-abstraction, dead code       │
│  ├── git-history-reviewer   # Churn files, risk patterns        │
│  └── test-coverage-reviewer # Missing tests, edge cases         │
│                                                                 │
│  🔍 CONDITIONAL (Based on Detected Stack)                       │
│  ├── python-reviewer        # IF: .py files in diff             │
│  ├── typescript-reviewer    # IF: .ts/.tsx files OR tsconfig    │
│  ├── rails-reviewer         # IF: Gemfile has rails             │
│  └── react-reviewer         # IF: package.json has react        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Stack-Aware Agent Invocation:**
```javascript
// Core reviewers (ALWAYS)
const coreAgents = [
  "security-reviewer",
  "data-integrity-reviewer",
  "performance-reviewer",
  "architecture-reviewer",
  "complexity-reviewer",
  "simplicity-reviewer",
  "git-history-reviewer",
  "test-coverage-reviewer"
];

// Language reviewers (CONDITIONAL)
const languageAgents = [];
if (stack.python || changedFiles.some(f => f.endsWith('.py'))) {
  languageAgents.push("python-reviewer");
}
if (stack.typescript || changedFiles.some(f => f.match(/\.tsx?$/))) {
  languageAgents.push("typescript-reviewer");
}
if (stack.react) {
  languageAgents.push("react-reviewer");
}
if (stack.rails) {
  languageAgents.push("rails-reviewer");
}

// Launch ALL selected agents in parallel
const allAgents = [...coreAgents, ...languageAgents];
```

**Example Output:**
```
📦 Detected Stack: TypeScript + React + Node.js
📄 Changed Files: 12 (.tsx: 8, .ts: 3, .json: 1)

🚀 Launching 10 agents (8 core + 2 language-specific):
   ✅ security-reviewer
   ✅ data-integrity-reviewer
   ✅ performance-reviewer
   ✅ architecture-reviewer
   ✅ complexity-reviewer
   ✅ simplicity-reviewer
   ✅ git-history-reviewer
   ✅ test-coverage-reviewer
   ✅ typescript-reviewer  ← Detected: tsconfig.json
   ✅ react-reviewer       ← Detected: react in package.json
   ⏭️ python-reviewer      ← Skipped: No Python files
   ⏭️ rails-reviewer       ← Skipped: No Gemfile
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

Save findings to `.claude/vibe/todos/`:

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
│  📁 Todos created: .claude/vibe/todos/ (10 files)                      │
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
