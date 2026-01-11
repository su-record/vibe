---
description: Restore previous session context
argument-hint: [projectPath]
---

# /vibe.continue

Restore previous session context and continue development.

## Usage

```
/vibe.continue                    # Restore context for current directory
/vibe.continue "/path/to/project" # Restore context for specific project
```

## What It Does

1. **Load Project Memories** - Retrieves saved project decisions, patterns, architecture notes
2. **Restore Context** - Loads previous session's work state (tasks, blockers, next steps)
3. **Load Coding Guides** - Applies project-specific coding standards

## Process

```
/vibe.continue
      |
      v
+---------------------------+
| vibe_start_session  |
| projectPath: $(pwd)       |
+---------------------------+
      |
      v
+---------------------------+
| Load:                     |
| - Project memories        |
| - Previous context        |
| - Coding guides           |
+---------------------------+
      |
      v
Ready to continue!
```

## Example

```
User: /vibe.continue

Claude:
Session started.

Recent Project Info:
  - project-stack: Next.js 14, TypeScript, Tailwind...
  - auth-decision: Using JWT with refresh tokens...
  - current-feature: Working on login page...

Previous Context:
  - HIGH priority from 2024-01-15 14:32
    Task: Implement password validation
    Blockers: Need to decide on complexity rules

Active Coding Guides:
  - TypeScript Standards (core): Strict mode, no any...

Ready to continue development! What would you like to work on?
```

## When to Use

- Starting a new Claude Code session
- After `/new` command
- Resuming work after a break
- Switching between projects

## Related Commands

- `/vibe.run` - Execute implementation
- `/vibe.spec` - Create SPEC document

---

**Action**: Call `vibe_start_session` with projectPath

```
vibe_start_session(projectPath: "$ARGUMENTS" || process.cwd())
```
