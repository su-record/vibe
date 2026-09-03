---
name: jobs-to-be-done
type: framework
applies-to: [create-prd]
---

# Jobs-to-Be-Done (JTBD) — Reference Card

## Core Concept

Users don't buy products — they **hire** them to do a job. Focus on the job, not the user persona.

> "People don't want a quarter-inch drill. They want a quarter-inch hole." — Theodore Levitt

## Job Statement Format

```
When [situation], I want to [motivation/goal], so I can [expected outcome].
```

**Example**:
- When I finish a long meeting, I want to quickly capture action items, so I can follow up without forgetting anything.
- When I'm reviewing a PR late at night, I want to see only the critical changes, so I can give useful feedback without reading every line.

## Three Layers of Jobs

| Layer | Description | Example |
|-------|-------------|---------|
| **Functional** | The practical task to be done | "Send a file to a colleague" |
| **Emotional** | How the user wants to feel | "Feel confident I sent the right version" |
| **Social** | How the user wants to be perceived | "Look organized and professional to my team" |

All three layers matter. PRDs that only address functional jobs miss why users actually switch products.

## Forces of Progress (Four Forces)

| Force | Direction | Question to Ask |
|-------|-----------|-----------------|
| Push | Away from current solution | "What frustrates users about the current way?" |
| Pull | Toward new solution | "What does the new solution promise?" |
| Anxiety | Against switching | "What risks do users fear about changing?" |
| Habit | Against switching | "What inertia keeps users in current behavior?" |

Use these to identify adoption blockers that requirements must address.

## Job Map (Stages)

Every job has 8 universal stages:

1. **Define** — Determine goals and plan the approach
2. **Locate** — Gather needed inputs and information
3. **Prepare** — Set up the environment for execution
4. **Confirm** — Verify readiness before execution
5. **Execute** — Carry out the core task
6. **Monitor** — Track progress during execution
7. **Modify** — Make adjustments as needed
8. **Conclude** — Finish and wrap up the task

Map each stage to identify where the current experience fails — those gaps become requirements.

## Job Story vs. User Story

| Format | Template | Focus |
|--------|----------|-------|
| User Story | As a [persona], I want [feature], so that [benefit] | Who the user is |
| Job Story | When [situation], I want [motivation], so I can [outcome] | Context and causality |

Job stories remove persona assumptions and focus on the triggering situation.

```
// User Story (persona-focused)
As a project manager, I want to see task status, so I know project health.

// Job Story (situation-focused)
When a stakeholder asks for a status update unexpectedly,
I want to pull up a project summary in under 10 seconds,
so I can answer confidently without scrambling through notes.
```

## PRD Integration

For each major requirement, document:

1. **The Job**: What job does this feature help users complete?
2. **Situation**: When does the need arise? (trigger context)
3. **Success Metric**: How will we know the job is being done better?
4. **Switch Moment**: What is the user currently hiring instead? (workaround)

```markdown
### Feature: Quick Status Summary

**Job**: Get an instant project health snapshot when asked unexpectedly
**Situation**: During ad-hoc stakeholder conversations or async check-ins
**Currently Hired**: Scrolling through chat history + mental approximation
**Success Metric**: Time-to-answer reduced from ~3min to <30s
```
