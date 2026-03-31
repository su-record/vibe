---
name: exec-plan
description: "Convert SPEC into a self-contained execution plan that agents can run autonomously for hours. Use when a SPEC has 3+ phases, multiple files to change, or complex dependencies between tasks. Produces a plan with explicit file paths, interface extracts, and acceptance criteria so agents never need to 'figure out' context. Must use this skill when launching long-running autonomous work, parallelizing implementation across agents, or when user says 'execute this spec' or 'run this plan'."
triggers: [exec plan, execution plan, autonomous plan, self-contained plan, long-running]
priority: 70
---

# ExecPlan — Self-Contained Execution Plan Generator

> **Principle**: "If the agent can't see it, it doesn't exist." Every decision, file path, pattern, and verification step must be explicit in the plan — no implicit knowledge allowed.

## When to Use

Before `/vibe.run`, generate an ExecPlan to make execution deterministic:

| Scenario | Signal |
|----------|--------|
| Complex SPEC (3+ phases) | Agent needs long autonomous execution |
| Team/multi-agent execution | Multiple agents need shared understanding |
| Context window pressure | Plan survives `/new` session handoff |
| Unfamiliar codebase | Agent can't rely on implicit knowledge |

## Core Flow

```
SPEC + Feature → ANALYZE → RESOLVE → GENERATE → PERSIST
```

### Step 1: ANALYZE — Extract Everything Needed

Read the SPEC and Feature files, then extract:

```
For each Phase → For each Scenario:
  1. Requirements (REQ-* IDs)
  2. Given/When/Then conditions
  3. Affected files (MUST exist — verify with Glob)
  4. Dependencies (imports, packages)
  5. Existing patterns to follow (read actual code, don't assume)
```

**Parallel exploration** (3+ agents):
- Agent 1: Map all file paths mentioned/implied in SPEC → verify they exist
- Agent 2: For each affected file, extract current interfaces/types/exports
- Agent 3: Find existing patterns (naming conventions, error handling, test structure)

### Step 2: RESOLVE — Eliminate All Ambiguity

For every decision point in the SPEC, resolve it NOW:

| Ambiguity | Resolution |
|-----------|------------|
| "Add validation" | → Which fields? What rules? What error messages? |
| "Handle errors" | → Which error codes? What response format? |
| "Follow existing pattern" | → Copy the ACTUAL pattern code into the plan |
| "Update tests" | → Which test file? What test framework? What assertions? |

**Rule**: If you'd need to "figure it out later", resolve it now. The plan must be executable by an agent with ZERO codebase knowledge.

### Step 3: GENERATE — Write the ExecPlan

Output format: `.claude/vibe/specs/{feature-name}-execplan.md`

```markdown
# ExecPlan: {feature-name}

## Meta
- SPEC: .claude/vibe/specs/{name}.md
- Feature: .claude/vibe/features/{name}.feature
- Generated: {timestamp}
- Phases: {count}
- Scenarios: {count}

## Pre-flight Checks
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes (baseline)
- [ ] Required files exist: {list}

## Phase {N}: {phase-name}

### Environment
- Files to modify: {exact paths}
- Files to create: {exact paths}
- Dependencies to add: {package@version}
- Patterns to follow: (inline code snippets from codebase)

### Scenario {N}.{M}: {scenario-name}

**Given**: {precondition}
→ Setup: {exact code/commands to establish precondition}

**When**: {action}
→ Implement: {step-by-step implementation instructions}
  - File: {path}
  - Location: after line containing `{anchor text}`
  - Code: (inline snippet)
  - Imports needed: {list}

**Then**: {expected result}
→ Verify:
  - Command: `{test command}`
  - Expected: {output/behavior}
  - Fallback: {what to do if verification fails}

### Phase {N} Gate
- [ ] Build: `npm run build`
- [ ] Tests: `npx vitest run {relevant-test-files}`
- [ ] Type check: `npx tsc --noEmit`

## Completion Criteria
- Coverage threshold: ≥95%
- All scenarios passing
- No regressions in existing tests
- RTM: `generateTraceabilityMatrix("{feature-name}")`
```

### Step 4: PERSIST — Save and Link

1. Save ExecPlan to `.claude/vibe/specs/{feature-name}-execplan.md`
2. Save session context: `save_memory("execplan-{feature}", {summary})`
3. Output execution command:

```
Ready to execute:
  /vibe.run "{feature-name}" ultrawork

Or hand off to new session:
  /vibe.utils --continue
  → Load: .claude/vibe/specs/{feature-name}-execplan.md
```

## Quality Checks

| Check | Criteria |
|-------|----------|
| No implicit knowledge | Every file path verified with Glob |
| No "figure it out" | Every decision resolved with actual code |
| Survives handoff | Plan readable without any prior context |
| Inline patterns | Actual code snippets, not "follow existing pattern" |
| Verification steps | Every scenario has a concrete verification command |

## Anti-patterns

- "See the existing implementation" → Copy the relevant code inline
- "Follow the pattern in X" → Show the actual pattern
- "Standard error handling" → Specify exact error codes and messages
- "Update tests accordingly" → Name the test file, framework, and assertions
