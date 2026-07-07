---
name: vibe.continue
description: Restore previous session context for continuity — memory load, context restore, resume from last checkpoint.
argument-hint: (no arguments)
user-invocable: true
---

# /vibe.continue

Restore previous session context for continuity.

## Usage

```
/vibe.continue
```

## Process

1. Calls `core_start_session` to load project memories
2. Restores previous conversation context
3. Resumes work from last checkpoint

## When to Use

- At new session start, to pick up exactly where the previous session left off
- At 85%+ context usage: `save_memory` → `/new` → `/vibe.continue` (컨텍스트 리셋 후 즉시 복원)
- Combine with the `handoff` skill for detailed handover: Handoff writes a manual `HANDOFF.md` (work progress + notes + file list) before a session ends; `/vibe.continue` automatically restores memory + session state at the start of the next one.

---

ARGUMENTS: $ARGUMENTS
