# Review Output Template — Full Reference

> Loaded by vibe.review SKILL.md for the Phase 4 findings synthesis format and the final review summary format (Phase 6 Output).

## Phase 4: Findings Synthesis

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

## Output

```
CODE REVIEW SUMMARY
PR #123: Add user authentication

Reviewers: security-reviewer + 8 code-reviewer instances (per-focus) + 3 design-reviewer instances (UI)
⏱️ Started: {start_time}
⏱️ Completed: {getCurrentTime 결과}

Score: 92/100 (Good) ← Score after auto-fix

Issues Found:
- P1 Critical: 2 → 0 (✅ Auto-fixed)
- P2 Important: 5 → 1 (✅ 4 auto-fixed)
- P3 Nice-to-have: 3 (Backlog)

Auto-Fixed: 6 issues
- [SECURITY] SQL Injection ✅
- [DATA] Transaction rollback ✅
- [PERF] N+1 query ✅
- [ARCH] Circular dependency ✅
- [PERF] Unnecessary loop ✅
- [TEST] Missing edge case ✅

Remaining (Manual handling required):
- P2-arch-large-refactor.md (Architecture decision required)
- P3-style-extract-helper.md (Backlog)
- P3-docs-add-readme.md (Backlog)

✅ MERGE READY (P1/P2 resolved)
```

## Phase 7: Guide to Fix Workflow (Manual Handling Items) — Prompt Template

**Choose workflow when handling remaining issues:**

```
## Fix Workflow

Choose a workflow to fix the discovered issues:

| Task Scale | Recommended Approach |
|------------|---------------------|
| Simple fix (1-2 files) | Plan Mode |
| Complex fix (3+ files, validation needed) | /vibe.spec |

1. `/vibe.spec "fix: issue-name"` - VIBE workflow (SPEC validation + re-review)
2. Plan Mode - Quick fix (for simple tasks)

Which approach would you like to proceed with?
```
