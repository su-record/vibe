---
name: capability-loop
description: "When an agent fails, diagnose which capability is missing and build it into the repo. Activates after repeated agent failures, tool errors, or when a task keeps failing in the same way. Analyzes failure transcripts, identifies the missing guardrail/tool/abstraction/doc, and creates it permanently. Use this skill whenever you see 3+ similar failures, an agent hitting the same wall repeatedly, or the user asking 'why does this keep failing'."
triggers: [capability loop, failure loop, build capability, missing capability, agent failed, why did it fail]
priority: 75
---

# Capability Loop — Failure → Capability Building

> **Principle**: "Ask what capability is missing, not why it failed." Every failure is a missing tool, guardrail, abstraction, or piece of documentation. Build the capability so the failure NEVER recurs.

## When to Use

| Trigger | Signal |
|---------|--------|
| Agent fails a task | Error, wrong output, timeout, confusion |
| Same error occurs twice | Pattern of missing capability |
| Agent asks clarifying question | Information not discoverable |
| Review finds recurring issue | Systemic gap, not one-off mistake |
| Manual intervention needed | Agent should have been self-sufficient |

## Core Flow

```
FAILURE → DIAGNOSE → CLASSIFY → BUILD → VERIFY → PERSIST
```

### Step 1: DIAGNOSE — What Capability is Missing?

Do NOT ask "why did it fail?" Instead ask: **"What would have prevented this failure?"**

```
Diagnosis questions (answer ALL):

1. TOOL: Did the agent lack a tool to accomplish the task?
   → Missing CLI command, missing API, missing utility function

2. GUARDRAIL: Did the agent do something it shouldn't have?
   → Missing lint rule, missing test, missing hook check

3. ABSTRACTION: Did the agent struggle with unnecessary complexity?
   → Missing helper, missing wrapper, missing shared module

4. DOCUMENTATION: Did the agent lack discoverable information?
   → Missing CLAUDE.md entry, missing code comment, missing type definition

5. FEEDBACK: Did the agent not know it was doing the wrong thing?
   → Missing error message, missing test assertion, missing type error
```

### Step 2: CLASSIFY — What Type of Capability?

| Category | Example | Where to Build |
|----------|---------|---------------|
| **Tool** | "No way to validate schema" | New CLI command or skill |
| **Guardrail** | "Accidentally deleted migration" | New hook or test |
| **Abstraction** | "Copy-pasted auth logic 3 times" | New shared module |
| **Documentation** | "Didn't know config format" | CLAUDE.md or code comments |
| **Feedback** | "Didn't realize test was wrong" | Better error messages or types |

### Step 3: BUILD — Create the Capability

Based on classification, build the appropriate artifact:

#### Tool → New Skill or Command
```
1. Create skills/{capability-name}/SKILL.md
2. Add triggers for automatic activation
3. Test with a simulated scenario
```

#### Guardrail → New Test or Hook
```
1. Add test to tests/arch-guard.test.ts (if structural)
2. Or add check to hooks/scripts/ (if runtime)
3. Verify it catches the original failure
```

#### Abstraction → New Module
```
1. Extract shared code into appropriate location
2. Update existing callers to use new abstraction
3. Add tests for the abstraction
```

#### Documentation → CLAUDE.md or Inline
```
1. If it's a constraint/gotcha → add to CLAUDE.md "Gotchas" section
2. If it's discoverable from code → add code comment or type definition
3. If it's a pattern → add to relevant language rule file
```

#### Feedback → Better Types or Errors
```
1. Add TypeScript type that prevents the mistake at compile time
2. Or add runtime validation with clear error message
3. Or add test that catches the mistake early
```

### Step 4: VERIFY — Reproduce and Confirm Fix

```
1. Reproduce the original failure scenario
2. Confirm the new capability prevents it
3. Run existing tests to verify no regressions
4. If the capability is a test, verify it FAILS without the fix
```

### Step 5: PERSIST — Record for Future Reference

Save the capability-building decision:

```
save_memory("capability-{name}", {
  failure: "description of what failed",
  diagnosis: "what capability was missing",
  category: "tool|guardrail|abstraction|documentation|feedback",
  solution: "what was built",
  files_changed: ["list of files"]
})
```

Update `.claude/vibe/capabilities-log.md`:

```markdown
## {date} — {capability-name}

**Failure**: {what happened}
**Missing**: {what capability was absent}
**Built**: {what was created}
**Files**: {list}
**Prevents**: {what class of failures this prevents}
```

## Decision Tree

```
Agent failed
    │
    ├─ Could a TOOL have done it automatically?
    │   YES → Build tool (skill/command/script)
    │
    ├─ Should the agent have been PREVENTED from doing it?
    │   YES → Build guardrail (hook/test/lint rule)
    │
    ├─ Was the agent REPEATING work that should be shared?
    │   YES → Build abstraction (module/helper/utility)
    │
    ├─ Did the agent lack KNOWLEDGE it needed?
    │   YES → Add documentation (CLAUDE.md/comments/types)
    │
    └─ Did the agent not KNOW it was wrong?
        YES → Build feedback (types/errors/tests)
```

## Anti-patterns

- "Add a note to be more careful" → Build a guardrail instead
- "Document the right way to do it" → If possible, make the wrong way a compile/test error
- "Tell the agent to check X first" → Make X discoverable automatically
- "It was a one-off mistake" → If it happened once, it will happen again. Build the capability.

## Integration Points

- After `/vibe.run` failure → auto-trigger capability-loop diagnosis
- After `/vibe.review` findings → suggest capability-loop for recurring patterns
- After manual agent correction → prompt "What capability would have prevented this?"
