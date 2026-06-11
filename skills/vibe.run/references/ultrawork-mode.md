# ULTRAWORK Mode — Automation Level Reference

> Loaded by vibe.run SKILL.md when user includes `ultrawork` or `ulw` keyword.
>
> **루프 시맨틱(ANCHOR/ACT/JUDGE/RECORD/stuck/max_iterations)의 SSOT는 `vibe/rules/loop-contract.md`다.** `ultrawork`/`ulw`는 `automationLevel: autonomous` + 병렬 ACT의 deprecated 별칭이다. 루프 자체는 모든 실행의 기본 동작이며, ultrawork는 그 루프를 자율(비대화형)·병렬 모드로 돌리는 축을 제어한다.

## What `automationLevel: autonomous` Enables

`ultrawork` (또는 `ulw`, `.vibe/config.json`의 `automationLevel: autonomous`) 설정 시 활성화:

| Feature | Description |
|---------|-------------|
| **Parallel Exploration** | 3+ Task(haiku) agents run simultaneously (ACT 병렬화) |
| **Loop (기본 동작)** | 모든 실행의 기본 — exit=게이트 통과 또는 stuck 또는 max_iterations |
| **Context Compression** | Aggressive auto-save at 70%+ context |
| **No Pause** | stuck·SPEC 게이트 외 확인 없음 (`automationLevel: autonomous`) |
| **External LLMs** | Auto-consults GPT/Antigravity if enabled |
| **Error Recovery** | stuck 시 TODO 기록 후 다음으로 (사용자 질문 없음) |
| **Race Review** | Multi-LLM review (GPT+Antigravity) with cross-validation |

## Boulder Loop — Parallel ACT Visualization

루프 자체는 loop-contract의 기본 동작이다. Boulder Loop는 `automationLevel: autonomous`에서 **병렬 ACT**가 어떻게 실행되는지를 보여주는 다이어그램이다:

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
│   loop-contract EXIT: 게이트 통과 │ stuck │ max_iterations       │
└─────────────────────────────────────────────────────────────────┘
```

## Example Session (automationLevel: autonomous)

```
User: /vibe.run "brick-game" ultrawork

Claude:
AUTONOMOUS MODE (automationLevel: autonomous)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SPEC: .vibe/specs/brick-game.md
4 Phases detected
Loop: ENABLED (exit = 게이트 통과 | stuck | max_iterations=10)
Parallel ACT: ON
automationLevel: autonomous (stuck → auto-TODO, no confirmation)
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

## confirm vs autonomous Comparison

| Aspect | `automationLevel: confirm` (default) | `automationLevel: autonomous` (ultrawork) |
|--------|--------------------------------------|-------------------------------------------|
| Loop | ANCHOR→ACT→JUDGE→RECORD (기본 동작) | 동일 |
| Confirmation gates | stuck·SPEC에서 질문 | stuck 포함 전부 skip → TODO |
| On error | Reports, asks before retry | Auto-retries, auto-TODO on stuck |
| Context 70%+ | Warning only | Auto-compress + save |
| Exploration | Sequential possible | FORCED parallel |

## Automation Level System

**automationLevel**은 루프가 사람 개입 없이 얼마나 자율적으로 진행하는지를 제어한다. `.vibe/config.json`에서 설정하거나, deprecated 별칭 키워드로 런타임 오버라이드 가능.

### Level Definitions

| Level | Name | 설정 방법 | Auto-advance | Auto-retry | Stuck Behavior | Parallel Agents | Checkpoints |
|-------|------|-----------|--------------|------------|----------------|-----------------|-------------|
| L0 | Manual | `manual` | No | No | Ask user every step | No | All |
| L1 | Guided | `guided`, `verify`(deprecated) | No | No | Ask user on stuck | No | All |
| L2 | confirm | default | Yes | Yes (low cap: 2) | Ask user after 2 retries | No | Key points |
| L3 | autonomous | `automationLevel: autonomous` / `ultrawork`(dep) / `ulw`(dep) | Yes | Yes (no cap) | Auto-TODO + proceed | Yes | Checkpoint-only |
| L4 | Full-auto | `ralph`(deprecated) / `ralplan`(deprecated) | Yes | Yes (no cap) | Auto-TODO + proceed | Yes | None |

### Detection Rule (deprecated aliases)

```
/vibe.run "login"              → L2 confirm (default)
/vibe.run "login" ultrawork    → L3 autonomous (deprecated alias)
/vibe.run "login" ralph        → L4 Full-auto (deprecated alias, exit=coverage-100)
/vibe.run "login" verify       → L1 Guided (deprecated alias)
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
