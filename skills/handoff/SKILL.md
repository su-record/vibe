---
name: handoff
tier: standard
description: "Generate HANDOFF.md work handover document before session end. Auto-activates on handoff, handover, session cleanup keywords."
triggers: [handoff, handover, session cleanup, session end, context save]
priority: 70
---

# Handoff — Session Handover Document

Record work status before session end so the next session can pick up immediately.

## What is HANDOFF.md?

A file that records the current work status before context reset. Reading this file in a new session allows immediate continuation.

### Difference from `/vibe.utils --continue`

| Item | `/vibe.utils --continue` | Handoff |
|------|--------------------------|---------|
| Method | Automatic session context restore | Manual handover document |
| Includes | Memory + session state | Work progress + notes + file list |
| When to use | At new session start | Before session end |
| Purpose | Quick auto-restore | Detailed handover (team/future self) |

## When to Use

- When context reaches 80-100k tokens
- After using `/compact` 3 times
- Before pausing work for an extended period
- When progress recording is needed during complex work

## VIBE Tool Integration

Use VIBE built-in tools to save current state before generating Handoff:

```bash
# Save current session context
core_auto_save_context

# Save important decisions to memory
core_save_memory --key "handoff-decision" --value "Decided on JWT for auth" --category "project"

# Verify saved memories
core_list_memories --category "project"
```

## HANDOFF.md Template

```markdown
# Work Handover Document

## Completed Tasks
- [x] Completed task 1
- [x] Completed task 2

## In Progress
- [ ] Currently working on
  - Progress: 70%
  - Next step: implement ~~

## Next Tasks
1. High priority task
2. Next task

## Notes & Cautions
- Do not touch: ~~
- Known bugs: ~~
- Temporary workarounds: ~~

## Related Files
- src/components/Login.tsx — Login form
- src/api/auth.ts — Auth API

## Last State
- Branch: feature/auth
- Last commit: abc1234
- Test status: passing
```

## Generation Steps

1. Check current changed files with `git status`
2. Check recent commits with `git log --oneline -5`
3. Organize in-progress and remaining tasks
4. Save session context with `core_auto_save_context`
5. Save key decisions with `core_save_memory`
6. Generate HANDOFF.md file

## Restoring in New Session

```
Read HANDOFF.md and continue working
```

Or use alongside VIBE auto-restore:

```
/vibe.utils --continue
```

In this case, saved decisions are also restored via `core_recall_memory`.

## Done Criteria (K4)

- [ ] HANDOFF.md created with all sections filled
- [ ] Completed/in-progress/next tasks accurately listed
- [ ] Related files section includes all modified files
- [ ] Session context saved via `core_auto_save_context`
- [ ] Key decisions saved via `core_save_memory`
