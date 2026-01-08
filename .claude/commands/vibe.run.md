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
/vibe.run "feature-name" ultrawork    # ULTRAWORK mode (recommended)
/vibe.run "feature-name" ulw          # Short alias for ultrawork
```

---

## **ULTRAWORK Mode** (ulw)

> Include `ultrawork` or `ulw` in your command to activate **maximum performance mode**.

### What ULTRAWORK Enables

When you include `ultrawork` (or `ulw`), ALL of these activate automatically:

| Feature | Description |
|---------|-------------|
| **Parallel Exploration** | 3+ Task(haiku) agents run simultaneously |
| **Boulder Loop** | Auto-continues until ALL phases complete |
| **Context Compression** | Aggressive auto-save at 70%+ context |
| **No Pause** | Doesn't wait for confirmation between phases |
| **External LLMs** | Auto-consults GPT/Gemini if enabled |
| **Error Recovery** | Auto-retries on failure (up to 3 times) |

### Boulder Loop (Inspired by Sisyphus)

Like Sisyphus rolling the boulder, ULTRAWORK **keeps going until done**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOULDER LOOP (ultrawork)                      │
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│   │ Phase 1  │───→│ Phase 2  │───→│ Phase 3  │───→│ Phase N  │  │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│        │               │               │               │         │
│        ↓               ↓               ↓               ↓         │
│   [Parallel]      [Parallel]      [Parallel]      [Parallel]    │
│   [Implement]     [Implement]     [Implement]     [Implement]   │
│   [Test]          [Test]          [Test]          [Test]        │
│        │               │               │               │         │
│        └───────────────┴───────────────┴───────────────┘         │
│                              │                                   │
│                              ↓                                   │
│                     ┌──────────────┐                             │
│                     │  ALL DONE?   │                             │
│                     └──────────────┘                             │
│                       │         │                                │
│                      NO        YES                               │
│                       │         │                                │
│                       ↓         ↓                                │
│                   [Continue]  [🎉 Complete!]                     │
│                                                                  │
│   NO STOPPING until acceptance criteria met or error limit hit   │
└─────────────────────────────────────────────────────────────────┘
```

### ULTRAWORK Example

```
User: /vibe.run "brick-game" ultrawork

Claude:
🚀 ULTRAWORK MODE ACTIVATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 SPEC: .vibe/specs/brick-game.md
🎯 4 Phases detected
⚡ Boulder Loop: ENABLED (will continue until all phases complete)
🔄 Auto-retry: ON (max 3 per phase)
💾 Context compression: AGGRESSIVE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏔️ BOULDER ROLLING... Phase 1/4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ [PARALLEL] Launching 3 exploration agents...
✅ Exploration complete (7.2s)
🔨 Implementing...
✅ Phase 1 complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏔️ BOULDER ROLLING... Phase 2/4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ [PARALLEL] Launching 3 exploration agents...
✅ Exploration complete (6.8s)
🔨 Implementing...
❌ Test failed: collision detection
🔄 Auto-retry 1/3...
🔨 Fixing...
✅ Phase 2 complete

[...continues automatically...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 BOULDER REACHED THE TOP!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ All 4 phases complete
✅ All acceptance criteria passed
✅ Build succeeded
✅ Tests passed

⏱️ Total: 8m 24s
📊 Retries: 2
💾 Context saved: 3 checkpoints
```

### Normal vs ULTRAWORK Comparison

| Aspect | Normal | ULTRAWORK |
|--------|--------|-----------|
| Phase transition | May pause | Auto-continues |
| On error | Reports and stops | Auto-retries (3x) |
| Context 70%+ | Warning only | Auto-compress + save |
| Exploration | Sequential possible | FORCED parallel |
| Completion | Phase-by-phase | Until ALL done |

---

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

### 3. Phase-by-Phase Implementation

Follow `<task>` section Phase order.

---

## **CRITICAL: Parallel Sub-Agent Execution**

> **MUST USE PARALLEL TASK CALLS** - This is REQUIRED, not optional.
> Sequential execution when parallel is possible = VIOLATION of this workflow.

### Mandatory Parallel Exploration (Phase Start)

**BEFORE any implementation, you MUST launch these Task calls IN PARALLEL (single message, multiple tool calls):**

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: PARALLEL EXPLORATION (REQUIRED)                        │
│                                                                 │
│  Launch ALL of these in ONE message:                            │
│                                                                 │
│  Task(haiku) ─┬─→ "Analyze related files in <context>"          │
│               │                                                 │
│  Task(haiku) ─┼─→ "Check dependencies and imports"              │
│               │                                                 │
│  Task(haiku) ─┴─→ "Find existing patterns and conventions"      │
│                                                                 │
│  [If GPT enabled] + MCP(vibe-gpt): Architecture review          │
│  [If Gemini enabled] + MCP(vibe-gemini): UI/UX consultation     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓ (wait for all to complete)
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: SYNTHESIZE (Opus)                                      │
│  - Review all exploration results                               │
│  - Decide implementation approach                               │
│  - Identify files to modify/create                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: IMPLEMENT (Task sonnet)                                │
│  - Execute implementation with full context                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: TEST (Task haiku)                                      │
│  - Write tests for implemented code                             │
└─────────────────────────────────────────────────────────────────┘
```

### Parallel Task Call Pattern (MUST FOLLOW)

**Correct - Single message with multiple parallel Tasks:**
```
<message>
  Task(haiku, "Analyze src/components/ for existing patterns")
  Task(haiku, "Check package.json dependencies")
  Task(haiku, "Find usage of similar features in codebase")
</message>
→ All 3 run simultaneously, ~3x faster
```

**WRONG - Sequential calls (DO NOT DO THIS):**
```
<message>Task(haiku, "Analyze...")</message>
<message>Task(haiku, "Check...")</message>
<message>Task(haiku, "Find...")</message>
→ 3x slower, wastes time
```

### Why Parallel Matters

| Approach | Time | Cache Benefit |
|----------|------|---------------|
| Sequential (3 Tasks) | ~30s | Cache cold on each |
| **Parallel (3 Tasks)** | **~10s** | **Cache warmed once, shared** |

hi-ai ProjectCache (LRU) caches ts-morph parsing results. Parallel calls share the warmed cache.

### Phase Execution Flow

```
Phase N Start
    │
    ├─→ [PARALLEL] Task(haiku) × 2-3: Exploration
    │       - Related code analysis
    │       - Dependency check
    │       - Pattern discovery
    │
    ↓ (all complete)
    │
    ├─→ Opus: Synthesize and decide
    │
    ├─→ Task(sonnet): Implementation
    │
    ├─→ Task(haiku): Tests
    │
    ↓
Phase N Complete → Next Phase
```

---

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

⚡ Launching parallel exploration...
[Task(haiku) × 3 launched in parallel]
  - Analyzing Phaser.js project patterns
  - Checking TypeScript configuration standards
  - Finding game loop conventions

✅ Exploration complete (3 tasks, 8.2s)
📋 Synthesizing results...

🔨 Implementing Phase 1...
[Task(sonnet) - Project setup]

✅ Phase 1 complete
  - package.json created
  - TypeScript configured
  - Phaser.js installed

🚀 Starting Phase 2...

⚡ Launching parallel exploration...
[Task(haiku) × 3 launched in parallel]
  - Analyzing game scene structure
  - Checking physics engine patterns
  - Finding collision detection approaches

✅ Exploration complete (3 tasks, 7.5s)

🔨 Implementing Phase 2...
[Task(sonnet) - Game logic]

[Implementation continues...]

✅ All Phases complete!
📊 Verifying Acceptance Criteria...
  ✅ Game start/end works
  ✅ Ball-paddle collision handling
  ✅ Score display
  ✅ npm run build succeeds

🎉 Implementation complete!

⏱️ Total time: 4m 32s (vs ~12m sequential)
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

⚡ Launching parallel exploration...
[Task(haiku) × 3 launched in parallel]

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
