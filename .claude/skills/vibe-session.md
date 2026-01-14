---
# prettier-ignore
description: Session management with context restoration and memory persistence. Use when starting new sessions, restoring previous work, or managing context.
---

# VIBE SESSION Skill

Activate this skill when the user wants to:
- Continue previous work
- Restore session context
- Save important decisions
- Manage context usage

## Session Commands

| Command | Function |
|---------|----------|
| `/vibe.continue` | Restore previous session |
| `save_memory` | Save important decisions |
| `start_session` | Initialize with context |

## Context Management

### At 70%+ Context Usage

```
❌ /compact 사용 금지 (정보 손실/왜곡 위험)
✅ save_memory로 중요 결정사항 저장 → /new로 새 세션
```

### Model Selection

- **Haiku**: Exploration/search (subagent default)
- **Sonnet**: Implementation/debugging
- **Opus**: Architecture/complex logic

## Trigger Keywords

- continue, resume
- restore session, previous work
- save context, save memory
- context management
