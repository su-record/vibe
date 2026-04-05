# Work Handover: {{FEATURE_OR_TASK_NAME}}

**Date**: {{DATE}}
**Branch**: {{GIT_BRANCH}}
**Author**: {{AUTHOR}}
**Session context**: {{CONTEXT_PERCENT}}% used

---

## Status at Handoff

| Area | Status | Notes |
|------|--------|-------|
| Build | {{BUILD_STATUS}} | `npm run build` |
| Tests | {{TEST_STATUS}} | `npx vitest run` |
| Type check | {{TYPECHECK_STATUS}} | `npx tsc --noEmit` |
| Lint | {{LINT_STATUS}} | |

---

## Completed Work

- [x] {{COMPLETED_TASK_1}}
- [x] {{COMPLETED_TASK_2}}
- [x] {{COMPLETED_TASK_3}}

Last commit: `{{LAST_COMMIT_HASH}}` — {{LAST_COMMIT_MESSAGE}}

---

## In Progress (resume here)

### {{IN_PROGRESS_TASK_NAME}}

- Progress: {{PROGRESS_PERCENT}}%
- Current state: {{CURRENT_STATE_DESCRIPTION}}
- Next immediate step: {{NEXT_STEP}}
- Blocking question (if any): {{BLOCKER_OR_NONE}}

**Where to look first:**
- `{{KEY_FILE_1}}` — {{KEY_FILE_1_CONTEXT}}
- `{{KEY_FILE_2}}` — {{KEY_FILE_2_CONTEXT}}

---

## Remaining Tasks (in priority order)

1. **[P1]** {{P1_TASK}} — must complete before merge
2. **[P2]** {{P2_TASK}} — complete before PR review
3. **[P3]** {{P3_TASK}} — nice-to-have

---

## Decisions Made This Session

| Decision | Rationale | Alternatives Rejected |
|----------|-----------|----------------------|
| {{DECISION_1}} | {{RATIONALE_1}} | {{ALTERNATIVES_1}} |
| {{DECISION_2}} | {{RATIONALE_2}} | {{ALTERNATIVES_2}} |

---

## Do Not Touch

- `{{FRAGILE_FILE_1}}` — {{REASON_1}}
- `{{FRAGILE_FILE_2}}` — {{REASON_2}}

---

## Known Issues / Workarounds

- {{KNOWN_ISSUE_1}}
- {{KNOWN_ISSUE_2}}

---

## All Modified Files

```
{{GIT_STATUS_OUTPUT}}
```

---

## How to Resume

```bash
# 1. Load context
/vibe.utils --continue

# 2. Read this file if context is missing
# cat HANDOFF.md

# 3. Verify baseline
npm run build && npx vitest run

# 4. Pick up from: {{RESUME_INSTRUCTION}}
```

---

## Session Memory Keys

The following keys were saved with `core_save_memory`:

- `{{MEMORY_KEY_1}}` — {{MEMORY_KEY_1_DESCRIPTION}}
- `{{MEMORY_KEY_2}}` — {{MEMORY_KEY_2_DESCRIPTION}}
