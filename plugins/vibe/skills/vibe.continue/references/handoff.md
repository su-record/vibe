# Handoff Workflow and Canonical HANDOFF.md Template

Use this document before a session ends or a long pause when detailed work state must survive context reset. `vibe.continue` restores state; handoff mode first records progress, decisions, changed files, verification status, and the exact next step in `HANDOFF.md`.

## When to Generate

- Context reaches the harness's own threshold — the `context_window_80/90/95` signal, i.e. the 85% rule in CLAUDE.md. Do not hardcode an absolute token count: the window differs by model (200k vs 1M), so a fixed number is wrong for most sessions.
- The session has already been compacted three times.
- Work will pause for an extended period.
- Complex progress needs a durable record for a teammate or future session.

Automatic continue restores available session state at the start of a new session; HANDOFF.md is the manual, repository-verifiable record created before the old session ends. They complement rather than replace each other.

## Generation Procedure

1. Inspect `git status` and the five most recent commits.
2. Separate completed, in-progress, and remaining work.
3. Fill every applicable template field below from conversation and repository evidence.
4. Write `HANDOFF.md`, then read it back and verify it against repository state.
5. Durable harness memory may mirror the document, but is optional and never the correctness source.

## Restore Procedure

Run `vibe.continue`, read `HANDOFF.md`, and verify its branch, changed files, and test status before resuming from `Next immediate step`.

## Done Criteria

- [ ] HANDOFF.md exists with all applicable sections filled.
- [ ] Completed, in-progress, and remaining tasks match repository state.
- [ ] All modified files and the last commit are recorded.
- [ ] Session decisions, cautions, blockers, and exact next step are present.
- [ ] The written document was read back and checked against Git and test evidence.

---

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
/vibe.continue

# 2. Read this file if context is missing
# cat HANDOFF.md

# 3. Verify baseline
npm run build && npx vitest run

# 4. Pick up from: {{RESUME_INSTRUCTION}}
```

---

## Optional Session Memory References

When the active harness provides durable memory, record its references here:

- `{{MEMORY_KEY_1}}` — {{MEMORY_KEY_1_DESCRIPTION}}
- `{{MEMORY_KEY_2}}` — {{MEMORY_KEY_2_DESCRIPTION}}
