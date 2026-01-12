---
description: Code review with parallel agents
argument-hint: "PR#, branch, path, or options"
---

# /vibe.review

Read and follow `agents/reviewer.md` for multi-agent parallel code review.

## Usage

```
/vibe.review                         # Review current branch
/vibe.review PR#123                  # Review specific PR
/vibe.review feature/login           # Review specific branch
/vibe.review src/api/                # Review specific path

# Options
/vibe.review --analyze "login"       # Analyze mode (agents/analyzer.md)
/vibe.review --ui "설명"              # UI preview (agents/ui-previewer.md)
```

---

ARGUMENTS: $ARGUMENTS
