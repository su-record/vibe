# ULTRAWORK Mode — Full Reference

> Loaded by vibe.run SKILL.md when user includes `ultrawork` or `ulw` keyword.

## What ULTRAWORK Enables

When you include `ultrawork` (or `ulw`), ALL of these activate automatically:

| Feature | Description |
|---------|-------------|
| **Parallel Exploration** | 3+ Task(haiku) agents run simultaneously |
| **Boulder Loop** | Auto-continues until ALL phases complete |
| **Context Compression** | Aggressive auto-save at 70%+ context |
| **No Pause** | Doesn't wait for confirmation between phases |
| **External LLMs** | Auto-consults GPT/Antigravity if enabled |
| **Error Recovery** | Loops until 100% or stuck; on stuck auto-records TODO and proceeds (no user prompt) |
| **Race Review (v2.6.9)** | Multi-LLM review (GPT+Antigravity) with cross-validation |

## Boulder Loop (Inspired by Sisyphus)

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
│                   [Continue]  [Complete!]                        │
│                                                                  │
│   NO STOPPING until acceptance criteria met or error limit hit   │
└─────────────────────────────────────────────────────────────────┘
```

## ULTRAWORK Example Session

```
User: /vibe.run "brick-game" ultrawork

Claude:
ULTRAWORK MODE ACTIVATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SPEC: .vibe/specs/brick-game.md
4 Phases detected
Boulder Loop: ENABLED (will continue until all phases complete)
Auto-retry: ON (loop until 100% or stuck → auto-TODO)
Context compression: AGGRESSIVE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOULDER ROLLING... Phase 1/4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[PARALLEL] Launching 3 exploration agents...
Exploration complete (7.2s)
Implementing...
Phase 1 complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOULDER ROLLING... Phase 2/4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[PARALLEL] Launching 3 exploration agents...
Exploration complete (6.8s)
Implementing...
Test failed: collision detection
Auto-retry [iteration 1]...
Fixing...
Phase 2 complete

[...continues automatically...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOULDER REACHED THE TOP!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All 4 phases complete
All acceptance criteria passed
Build succeeded
Tests passed

Total: 8m 24s
Retries: 2
Context saved: 3 checkpoints
```

## Normal vs ULTRAWORK Comparison

| Aspect | Normal | ULTRAWORK |
|--------|--------|-----------|
| Phase transition | May pause | Auto-continues |
| On error | Reports and stops | Auto-retries (3x) |
| Context 70%+ | Warning only | Auto-compress + save |
| Exploration | Sequential possible | FORCED parallel |
| Completion | Phase-by-phase | Until ALL done |

## Automation Level System

Magic keywords in the user input automatically set the **AutomationLevel**, which controls how much the AI self-advances vs. pausing for confirmation.

### Level Definitions

| Level | Name | Keyword(s) | Auto-advance | Auto-retry | Stuck Behavior | Parallel Agents | Checkpoints |
|-------|------|------------|--------------|------------|----------------|-----------------|-------------|
| L0 | Manual | `manual` | No | No | Ask user every step | No | All |
| L1 | Guided | `guided`, `verify` | No | No | Ask user on stuck | No | All |
| L2 | Semi-auto | `quick` (default) | Yes | Yes (low cap: 2) | Ask user after 2 retries | No | Key points |
| L3 | Auto | `ultrawork`, `ulw` | Yes | Yes (no cap) | Auto-TODO + proceed | Yes | Checkpoint-only |
| L4 | Full-auto | `ralph`, `ralplan` | Yes | Yes (no cap) | Auto-TODO + proceed | Yes | None |

### Detection Rule

```
/vibe.run "login"              → L2 Semi-auto (default)
/vibe.run "login" ultrawork    → L3 Auto
/vibe.run "login" ralph        → L4 Full-auto
/vibe.run "login" verify       → L1 Guided
```

### Confirmation Matrix

| Action | L0 | L1 | L2 | L3 | L4 |
|--------|----|----|----|----|-----|
| `destructive` | confirm | confirm | confirm | confirm | auto |
| `architecture_choice` | confirm | confirm | confirm | auto | auto |
| `implementation_scope` | confirm | confirm | confirm | auto | auto |
| `phase_advance` | confirm | confirm | auto | auto | auto |
| `fix_strategy` | confirm | confirm | auto | auto | auto |
| `retry` | confirm | auto | auto | auto | auto |

**Rule**: When confirmation is required, pause and display a checkpoint before proceeding.
