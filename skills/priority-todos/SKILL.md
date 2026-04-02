---
name: priority-todos
tier: standard
description: "Priority-based TODO management (P1/P2/P3). Auto-activates when managing tasks, reviewing issues, or organizing work by priority."
triggers: [todo, priority, P1, P2, P3, task management, issue, organize]
priority: 60
---

# Priority-Based Todo Management

## Pre-check (K1)

> Do you need structured priority tracking? For 1-2 item task lists, use inline TODOs. This system is for multi-issue tracking across reviews and sessions.

## Priority Definitions

| Priority | Meaning | Action | Examples |
|----------|---------|--------|----------|
| P1 | **Blocks merge** | Fix immediately | Security vulnerability, data loss risk, production incident |
| P2 | **Should fix** | Fix before PR | Performance issue, missing tests, architecture violation |
| P3 | **Backlog** | Fix when time permits | Code style, refactoring suggestion, documentation |

## Directory Structure

```
.claude/vibe/todos/
├── P1-security-sql-injection.md
├── P2-perf-n1-query.md
├── P3-style-extract-helper.md
├── index.md                      # Summary table with counts/status
└── done/                         # Archived completed items
```

## Workflow

```
/vibe.review → Creates P1/P2/P3 todo files + updates index.md
     ↓
Fix P1 first (blocks merge)
     ↓
Fix P2 before PR (warning only)
     ↓
P3 → backlog (weekly review)
     ↓
Mark done → moves to done/ with date prefix
```

## Todo File Format

Each file follows: `# [P1] Title` → Summary → Priority Justification → Location (file:line) → Suggested Fix → Checklist (fix, test, review, merge).

## Rules

- P1 exists → merge is **blocked**
- P2 → warning only, recommended to resolve
- P3 → no blocking, backlog
- Weekly cleanup: review and archive completed items

## Done Criteria (K4)

- [ ] All P1 items resolved before merge
- [ ] P2 items reviewed and either resolved or documented
- [ ] index.md reflects current state
- [ ] Completed items archived to `done/` directory
