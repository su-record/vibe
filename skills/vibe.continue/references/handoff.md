---
name: handoff-reference
user-invocable: false
invocation: [auto]
tier: standard
description: "Generate HANDOFF.md work handover document before session end. Auto-activates on handoff, handover, session cleanup keywords."
triggers: [handoff, handover, session cleanup, session end, context save]
priority: 60
---

# Handoff — Session Handover Document

Record work status before session end so the next session can pick up immediately.

## What is HANDOFF.md?

A file that records the current work status before context reset. Reading this file in a new session allows immediate continuation.

### Difference from `/vibe.continue`

| Item | `/vibe.continue` | Handoff |
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

## State Persistence

Persist the current state in `HANDOFF.md` itself. Record decisions, changed
files, test status, and the exact next step from the conversation, then verify
them against `git status` and recent history. If the active harness also offers
session memory, it may mirror this information there, but that optional
capability is not a correctness requirement.

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
4. Generate `HANDOFF.md` with the current context and key decisions
5. Read the completed file back and verify it against repository state

## Restoring in New Session

```
Read HANDOFF.md and continue working
```

Or use alongside VIBE auto-restore:

```
/vibe.continue
```

In this case, `/vibe.continue` reads `HANDOFF.md` and verifies the restored state against the repository.

## Done Criteria (K4)

- [ ] HANDOFF.md created with all sections filled
- [ ] Completed/in-progress/next tasks accurately listed
- [ ] Related files section includes all modified files
- [ ] Session context and key decisions are present in `HANDOFF.md`
- [ ] The saved state was read back and checked against repository state
