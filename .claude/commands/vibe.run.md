---
description: Execute implementation from SPEC
argument-hint: "feature name" or --phase N
---

# /vibe.run

Execute implementation based on SPEC (Implementation Agent with Multi-Model Orchestration).

## Usage

```
/vibe.run "feature-name"              # Full implementation
/vibe.run "feature-name" --phase 1    # Specific Phase only
```

## Rules Reference

**Must follow `.vibe/rules/`:**
- `core/development-philosophy.md` - Surgical precision, modify only requested scope
- `core/quick-start.md` - Korean, DRY, SRP, YAGNI
- `standards/complexity-metrics.md` - Functions ≤20 lines, nesting ≤3 levels
- `quality/checklist.md` - Code quality checklist

## Description

Read PTCF structured SPEC document and execute implementation immediately.

> **PLAN, TASKS documents unnecessary** - SPEC is the executable prompt

## Model Orchestration

Automatically select optimal model based on task type:

```
┌─────────────────────────────────────────────────────────────┐
│               Opus 4.5 (Orchestrator)                       │
│               - Coordinate overall flow                     │
│               - Final decisions/review                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
    ┌─────────────────────┼─────────────────────┐
    ↓                     ↓                     ↓
┌─────────┐         ┌─────────┐         ┌─────────┐
│ Haiku   │         │ Sonnet  │         │ Haiku   │
│(Explore)│         │ (Impl)  │         │ (Test)  │
└─────────┘         └─────────┘         └─────────┘
```

### Task Calls by Role

| Task Type | Model | Task Parameter |
|-----------|-------|----------------|
| Codebase exploration | Haiku 4.5 | `model: "haiku"` |
| Core implementation | Sonnet 4 | `model: "sonnet"` |
| Test writing | Haiku 4.5 | `model: "haiku"` |
| Architecture decisions | Opus 4.5 | Main session |
| Final review | Opus 4.5 | Main session |

### External LLM Usage (When Enabled)

When external LLMs are enabled in `.vibe/config.json`:

| Role | Model | Condition |
|------|-------|-----------|
| Architecture/Debugging | GPT 5.2 | When `vibe gpt <key>` executed |
| UI/UX Design | Gemini 3 | When `vibe gemini <key>` executed |

When external LLM enabled, automatically called via MCP:
- `mcp__vibe-gpt__chat` - GPT 5.2 architecture consultation
- `mcp__vibe-gemini__chat` - Gemini 3 UI/UX consultation

## Semantic Code Analysis (hi-ai MCP)

Use hi-ai MCP semantic tools to accurately understand codebase before implementation:

| MCP Tool | Purpose | When Used |
|----------|---------|-----------|
| `mcp__vibe__find_symbol` | Find symbol definitions | Locate class/function |
| `mcp__vibe__find_references` | Find references | Analyze impact scope |
| `mcp__vibe__analyze_complexity` | Analyze complexity | Determine refactoring need |
| `mcp__vibe__validate_code_quality` | Validate quality | Verify post-implementation quality |

### Semantic Analysis Flow

```
Start Implementation
    │
    ├─→ find_symbol: Locate exact position of function/class to modify
    │
    ├─→ find_references: Check all places using that symbol
    │
    ├─→ analyze_complexity: Check existing code complexity
    │
    ↓
Implementation (with accurate understanding of impact scope)
    │
    ↓
validate_code_quality: Verify quality after implementation
```

### Context Management (Session Continuity)

| MCP Tool | Purpose |
|----------|---------|
| `mcp__vibe__start_session` | Start session, restore previous context |
| `mcp__vibe__auto_save_context` | Auto-save current state |
| `mcp__vibe__restore_session_context` | Restore previous session context |
| `mcp__vibe__save_memory` | Save important decisions/patterns |

**On session start**: `mcp__vibe__start_session` auto-restores previous context
**On session end**: Hook auto-executes `mcp__vibe__auto_save_context`

## Process

### 1. Read SPEC and Config

Parse `.vibe/specs/{feature-name}.md`:

| Section | Purpose |
|---------|---------|
| `<role>` | AI role definition |
| `<context>` | Background, tech stack, related code |
| `<task>` | Phase-by-phase task list |
| `<constraints>` | Constraints |
| `<output_format>` | Files to create/modify |
| `<acceptance>` | Verification criteria |

Check `.vibe/config.json`:
- External LLM enablement (`models.gpt.enabled`, `models.gemini.enabled`)

### 2. Check Feature File

`.vibe/features/{feature-name}.feature`:
- Check BDD Scenarios
- Use as test cases

### 3. Phase-by-Phase Implementation (Parallel Task Calls)

Follow `<task>` section Phase order:

```
Phase Start
    │
    ├─→ Task(haiku): Codebase analysis
    │       "Analyze related files and patterns"
    │
    ├─→ [GPT enabled] MCP(vibe-gpt): Architecture review
    │       "Review if this design is appropriate"
    │
    ├─→ [Gemini enabled] MCP(vibe-gemini): UI/UX consultation
    │       "Suggest UI implementation direction"
    │
    ↓
Opus: Synthesize analysis results, decide implementation direction
    │
    ↓
Task(sonnet): Core implementation
    "Implement code according to SPEC"
    │
    ↓
Task(haiku): Write tests
    "Write tests for implemented code"
    │
    ↓
Opus: Final review and next Phase
```

**Parallel execution example:**
```javascript
// Independent tasks run in parallel
Task(haiku) - Code analysis
Task(haiku) - Dependency check
// → Run simultaneously

// Sequential tasks
Task(sonnet) - Implementation (after analysis complete)
Task(haiku) - Tests (after implementation complete)
```

1. **Related code analysis**: Task(haiku) explores `<context>` related code
2. **File creation/modification**: Task(sonnet) implements per `<output_format>`
3. **Constraint compliance**: Check `<constraints>`
4. **Run verification**: Execute verification commands

### 4. Acceptance Criteria Verification

Check `<acceptance>` checklist:
- [ ] Each criterion pass status
- [ ] Tests pass
- [ ] Build succeeds

### 5. Update SPEC

Check completed Tasks:
```markdown
## Task
<task>
### Phase 1: Backend
1. [x] Write DB schema ✅
2. [x] API endpoint ✅
...
</task>
```

## TRUST 5 Principles

Follow during implementation:

| Principle | Description |
|-----------|-------------|
| **T**est-first | Write tests first |
| **R**eadable | Clear code |
| **U**nified | Consistent style |
| **S**ecured | Consider security |
| **T**rackable | Logging, monitoring |

## Input

- `.vibe/specs/{feature-name}.md` (PTCF SPEC)
- `.vibe/features/{feature-name}.feature` (BDD)
- `CLAUDE.md` (project context)

## Output

- Implemented code files
- Test files
- Updated SPEC document (checkmarks)

## Example

```
User: /vibe.run "brick-game"

Claude:
📄 Reading SPEC: .vibe/specs/brick-game.md

<role> analysis:
- Web game senior developer
- Phaser.js expert

<context> analysis:
- Tech stack: Phaser.js, TypeScript
- New project

<task> analysis:
- Phase 1: Project setup (3 tasks)
- Phase 2: Game logic (5 tasks)
- Phase 3: UI/UX (3 tasks)
- Phase 4: Testing (2 tasks)

🚀 Starting Phase 1...

✅ Phase 1 complete
  - package.json created
  - TypeScript configured
  - Phaser.js installed

🚀 Starting Phase 2...
[Implementation continues...]

✅ All Phases complete!
📊 Verifying Acceptance Criteria...
  ✅ Game start/end works
  ✅ Ball-paddle collision handling
  ✅ Score display
  ✅ npm run build succeeds

🎉 Implementation complete!
```

### Phase-specific Execution

```
User: /vibe.run "brick-game" --phase 2

Claude:
📄 Reading SPEC: .vibe/specs/brick-game.md
🎯 Executing Phase 2 only.

Phase 2: Game Logic
1. [ ] Paddle movement implementation
2. [ ] Ball physics engine
3. [ ] Brick collision handling
4. [ ] Score system
5. [ ] Game over conditions

🚀 Starting implementation...
```

## Error Handling

On failure:
1. Check error message
2. Review `<constraints>`
3. Fix code and retry
4. If continues to fail, report to user

## Next Step

```
/vibe.verify "brick-game"
```

---

ARGUMENTS: $ARGUMENTS
