---
# prettier-ignore
description: SPEC-based implementation with ULTRAWORK mode for maximum performance. Use when implementing features, running development tasks, or executing SPEC phases.
---

# VIBE RUN Skill

Activate this skill when the user wants to:
- Implement a feature from SPEC
- Run development tasks
- Use ULTRAWORK mode for parallel execution
- Execute Boulder Loop for continuous progress

## ULTRAWORK Mode

Add `ultrawork` or `ulw` keyword for maximum performance:

**Activated Features:**
- Parallel subagent exploration (3+ concurrent)
- Background agents preparing next phase
- Phase pipelining (no wait time between phases)
- Boulder Loop (auto-progress until complete)
- Auto-retry on errors (max 3 times)
- Auto-compress at 70%+ context
- Continuous execution without confirmation

## Speed Comparison

| Mode | Per Phase | 5 Phases |
|------|-----------|----------|
| Sequential | ~2min | ~10min |
| Parallel Exploration | ~1.5min | ~7.5min |
| **ULTRAWORK Pipeline** | **~1min** | **~5min** |

## Trigger Keywords

- run, implement, execute
- ultrawork, ulw
- develop, build, create
- boulder loop, auto-progress
