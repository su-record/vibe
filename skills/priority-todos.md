---
description: Priority-based TODO management (P1/P2/P3). Auto-activates when managing tasks, reviewing issues, or organizing work by priority.
---
# Priority-Based Todo Management Skill

Priority-based TODO management system

## Overview

Classify tasks by P1/P2/P3 priority to handle important items first

## Priority Levels

```
┌─────────────────────────────────────────────────────────────────┐
│  Priority Levels                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 P1 (Critical)                                               │
│  ├── Security vulnerabilities                                   │
│  ├── Data loss risk                                             │
│  ├── Production incidents                                       │
│  └── Merge-blocking issues                                      │
│                                                                 │
│  🟡 P2 (Important)                                              │
│  ├── Performance issues                                         │
│  ├── Missing tests                                              │
│  ├── Architecture violations                                    │
│  └── Technical debt                                             │
│                                                                 │
│  🔵 P3 (Nice-to-have)                                           │
│  ├── Code style                                                 │
│  ├── Refactoring suggestions                                    │
│  ├── Documentation                                              │
│  └── Optimization opportunities                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## File-Based Todo System

### Directory Structure

```
.claude/vibe/todos/
├── P1-security-sql-injection.md
├── P1-data-transaction-missing.md
├── P2-perf-n1-query.md
├── P2-test-missing-edge-case.md
├── P2-arch-circular-dependency.md
├── P3-style-extract-helper.md
├── P3-docs-add-readme.md
└── index.md
```

### Todo File Format

```markdown
# [P1] SQL Injection Vulnerability

## Summary
User input directly concatenated in SQL query without sanitization.

## Priority Justification
- 🔴 P1 (Critical)
- Category: Security
- Impact: High (data breach risk)
- Effort: Low (simple fix)

## Location
- **File**: src/api/users.py
- **Line**: 42-45
- **Function**: `get_user_by_email()`

## Current Code
```python
def get_user_by_email(email: str):
    query = f"SELECT * FROM users WHERE email = '{email}'"
    return db.execute(query)
```

## Suggested Fix
```python
def get_user_by_email(email: str):
    query = "SELECT * FROM users WHERE email = %s"
    return db.execute(query, (email,))
```

## Checklist
- [ ] Fix implemented
- [ ] Unit test added
- [ ] Security test added
- [ ] Code reviewed
- [ ] Merged

## References
- OWASP SQL Injection: https://owasp.org/www-community/attacks/SQL_Injection
- Project Security Guide: docs/security.md

## Metadata
- Created: 2026-01-11
- Author: Claude
- Review: /vibe.review PR#123
```

### Index File

```markdown
# Todo Index

## Summary
| Priority | Count | Status |
|----------|-------|--------|
| 🔴 P1 | 2 | 🚨 Blocks merge |
| 🟡 P2 | 5 | ⚠️ Should fix |
| 🔵 P3 | 3 | 💡 Backlog |

## 🔴 P1 Critical (Blocks Merge)

| # | Title | Location | Status |
|---|-------|----------|--------|
| 1 | SQL Injection | users.py:42 | ❌ Open |
| 2 | Missing Rollback | payment.py:128 | ❌ Open |

## 🟡 P2 Important

| # | Title | Location | Status |
|---|-------|----------|--------|
| 3 | N+1 Query | orders.py:78 | ❌ Open |
| 4 | Missing Tests | auth.py | ❌ Open |
| 5 | Circular Dep | services/ | ❌ Open |

## 🔵 P3 Nice-to-have

| # | Title | Location | Status |
|---|-------|----------|--------|
| 6 | Extract Helper | utils.py:45 | 💤 Backlog |
| 7 | Add README | /payment | 💤 Backlog |

---

Last updated: 2026-01-11 10:30
```

## Workflow Commands

### Create Todo

```bash
# Auto-generated from /vibe.review results
/vibe.review PR#123
# -> Creates files in .claude/vibe/todos/

# Manual creation
vibe todo add "SQL Injection in users.py" --priority P1 --category security
```

### List Todos

```bash
# Full list
vibe todo list

# By priority
vibe todo list --priority P1
vibe todo list --priority P2

# By category
vibe todo list --category security
vibe todo list --category performance
```

### Complete Todo

```bash
# Mark as complete
vibe todo done P1-security-sql-injection

# Updates checklist in file + updates index
```

### Clean Up

```bash
# Archive completed items
vibe todo archive

# Result:
# .claude/vibe/todos/P1-security-sql-injection.md
# -> .claude/vibe/todos/done/2026-01-11-P1-security-sql-injection.md
```

## Integration with TodoWrite

Integration with existing TodoWrite tool:

```javascript
TodoWrite({
  todos: [
    {
      content: "[P1] Fix SQL injection in users.py:42",
      status: "in_progress",
      activeForm: "Fixing SQL injection vulnerability",
      priority: "P1",  // extended field
      category: "security"  // extended field
    },
    {
      content: "[P2] Add missing tests for auth",
      status: "pending",
      activeForm: "Adding auth tests",
      priority: "P2",
      category: "testing"
    }
  ]
})
```

## Auto-Blocking Rules

```yaml
# .claude/vibe/config.yaml
merge_blocking:
  P1: true   # Block merge if P1 exists
  P2: false  # Warning only
  P3: false  # Ignore

notifications:
  P1: immediate  # Immediate notification
  P2: daily      # Daily summary
  P3: weekly     # Weekly summary
```

## Best Practices

1. **Handle P1 immediately**: Stop other work and fix
2. **Handle P2 before PR**: Recommended to resolve before merge
3. **P3 is backlog**: Handle when time permits
4. **Regular cleanup**: Review todos weekly
5. **Document completions**: Document how issues were resolved
