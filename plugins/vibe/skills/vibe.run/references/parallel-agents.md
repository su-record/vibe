# Parallel Agents & Model Orchestration — Full Reference

> Loaded by vibe.run SKILL.md when parallel execution patterns, parallel subagent groups, or model selection details are needed.

## Model Orchestration — Inherit by Default

**Do not pass a `model` parameter.** Subagents inherit the session model.

The complexity→tier routing that used to live here (Haiku for simple work, Sonnet
for standard, Opus for architecture) is **retired**. It was written when the
default session model was weak enough that routing *up* was the win. With a strong
default, a hardcoded tier can only route *down* — and a downgraded subagent's
misses land back on the session model to find and undo. That costs more than the
tokens it saves.

### The only exception

| Agent | Tier | Why it overrides the session model |
|-------|------|------------------------------------|
| `architect` | `opus` | Design decisions are expensive to reverse — guarantee a floor even when the session runs lower |

Every other agent (`implementer`, `tester`, `e2e-tester`, `code-reviewer`,
`security-reviewer`, `build-error-resolver`, UI/event agents) is `inherit`.
SSOT: `CLAUDE_MODEL_MAPPING` in `src/cli/postinstall/constants.ts`.

> Adding a new tier override requires an answer to: *"why must this run at this
> tier regardless of what the session is running?"* "It's a simple task" is not
> an answer — a strong model finishes simple tasks quickly at no quality cost.

### What still scales with complexity

Complexity should change **how many agents you spawn and how deep they go**, not
which model they run. See the Stakes table in `vibe/rules/loop-contract.md` — that
is the SSOT for proportional execution.

## Mandatory Parallel Exploration (Phase Start)

**BEFORE any implementation, you MUST launch these Task calls IN PARALLEL (single message, multiple tool calls):**

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: PARALLEL EXPLORATION (REQUIRED)                        │
│                                                                 │
│  Launch ALL of these in ONE message:                            │
│                                                                 │
│  Task ─┬─→ "Analyze related files in <context>"                 │
│        │                                                        │
│  Task ─┼─→ "Check dependencies and imports"                     │
│        │                                                        │
│  Task ─┴─→ "Find existing patterns and conventions"             │
│                                                                 │
│  [If GPT enabled] Bash: node "[LLM_SCRIPT]" gpt orchestrate-json "[question]"
│  [If Antigravity enabled] Bash: node "[LLM_SCRIPT]" antigravity orchestrate-json "[question]"
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓ (wait for all to complete)
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: SYNTHESIZE                                      │
│  - Review all exploration results                               │
│  - Decide implementation approach                               │
│  - Identify files to modify/create                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: IMPLEMENT + BACKGROUND AGENTS (PARALLEL)               │
│                                                                 │
│  Main Agent:                                           │
│  └─→ Execute current phase implementation                       │
│                                                                 │
│  Background Agents (run_in_background=true):             │
│  ├─→ Task: "Prepare Phase N+1 - analyze required files"         │
│  ├─→ Task: "Pre-generate test cases for current implementation" │
│  └─→ Task: "Search for related types/interfaces needed"         │
│                                                                 │
│  [ULTRAWORK] All 4 agents run simultaneously!                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓ (main completes, check backgrounds)
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: TEST + PHASE PIPELINING                                │
│                                                                 │
│  Current Phase:                                                 │
│  └─→ Task: Write tests using pre-generated cases                │
│                                                                 │
│  Next Phase Prep (from background results):                     │
│  └─→ Already have file analysis, ready to start immediately     │
└─────────────────────────────────────────────────────────────────┘
```

### Parallel Task Call Pattern (MUST FOLLOW)

**Correct — Single message with multiple parallel Tasks:**
```
<message>
  Task("Analyze src/components/ for existing patterns")
  Task("Check package.json dependencies")
  Task("Find usage of similar features in codebase")
</message>
→ All 3 run simultaneously, ~3x faster
```

**WRONG — Sequential calls (DO NOT DO THIS):**
```
<message>Task("Analyze...")</message>
<message>Task("Check...")</message>
<message>Task("Find...")</message>
→ 3x slower, wastes time
```

### Background Agent Pattern (autonomous + parallel ACT)

Use the harness's native background subagents — spawn them in one message and continue working; completion notifications arrive automatically:

```
Task (Explore, background): "Phase 2 prep: Analyze auth API endpoints"
Task (tester, background): "Pre-generate test cases for login form"
Task (Explore, background): "Find existing validation patterns"
```

No status polling is needed — the harness re-invokes you when each background agent completes. (구 자체 오케스트레이터 runAgent/status/getResult 체계는 제거됨 — 네이티브 background subagent 가 대체.)

### Phase Execution Flow (ULTRAWORK Pipeline)

```
Phase N Start
    │
    ├─→ [PARALLEL] Task × 3: Exploration
    │       - Related code analysis
    │       - Dependency check
    │       - Pattern discovery
    │
    ↓ (all complete)
    │
    ├─→ Synthesize and decide
    │
    ├─→ [PARALLEL PIPELINE] ←── KEY SPEED OPTIMIZATION
    │       │
    │       ├─→ Main: Task Implementation
    │       │
    │       └─→ Background (run_in_background=true):
    │               ├─→ Task: Phase N+1 file analysis
    │               ├─→ Task: Test case preparation
    │               └─→ Task: Type/interface lookup
    │
    ↓ (main completes)
    │
    ├─→ Task: Tests (uses pre-generated cases)
    │
    ↓
Phase N Complete
    │
    ↓ (Background results ready — NO WAIT for Phase N+1 exploration!)
    │
Phase N+1 Start (IMMEDIATE — exploration already done!)
```

**Speed Comparison:**

| Mode | Phase Time | 5 Phases Total |
|------|------------|----------------|
| Sequential | ~2min/phase | ~10min |
| Parallel Exploration | ~1.5min/phase | ~7.5min |
| **ULTRAWORK Pipeline** | **~1min/phase** | **~5min** |

**Why Pipeline is Faster:**
- Background agents prepare next phase WHILE current phase implements
- No idle time between phases
- Test cases pre-generated during implementation
- Cache stays warm across parallel tasks

## Parallel Subagent Groups

> 별도 "팀" 에이전트는 없다 — 상황별로 **네이티브 서브에이전트를 병렬 스폰**한다
> (단일 메시지, 다중 Task 호출). 아래는 상황 → 병렬 구성 매핑.

**병렬 구성 선택 기준:**

| 조건 | 병렬 구성 |
|------|-----------|
| 시나리오 1-2개, 파일 1-2개 | 기존 병렬 모드 (추가 구성 없음) |
| 시나리오 3개+, 일반 모드 | implementer + tester + Explore (3 병렬) |
| ULTRAWORK 또는 복잡도 20+ | architect + implementer + tester + code-reviewer (4 병렬) |

**상황별 병렬 스폰:**

| 상황 | 활성화 조건 | 병렬 서브에이전트 |
|------|------------|------------------|
| Review Debate | `/vibe.review` 후 P1/P2 이슈 2개 이상 | security-reviewer + code-reviewer 인스턴스(focus별) |
| Debug | 동일 빌드/테스트 실패 3회 이상, 또는 root cause stuck | build-error-resolver + Explore + code-reviewer (focus: correctness) |
| Research | `/vibe.spec` Step 3 리서치 단계 | Explore × N + native WebSearch |
| Security | auth/payment/user-data/crypto 파일 변경, 또는 `security` 키워드 | security-reviewer + code-reviewer (focus: data-integrity) |
| Migration | package.json 주요 의존성 버전 변경, 또는 `migration` 키워드 | Explore(변경 영향 조사) + implementer + tester |
| Fullstack | SPEC에 frontend + backend 파일 모두 포함, 또는 `fullstack` 키워드 | implementer(FE) + implementer(BE) + tester |

## External LLM Usage (When Enabled)

When external LLMs are enabled in `.vibe/config.json`:

| Role | Method | Condition |
|------|--------|-----------|
| User direct query | `gpt.question`, `antigravity.question` | Hook auto-handles |
| Internal orchestration | Call global script via Bash | Claude calls directly |

**Claude internal calls (directly via Bash):**
```bash
# [LLM_SCRIPT] = {{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js

# GPT call (short prompt - CLI arg)
node "[LLM_SCRIPT]" gpt orchestrate-json "[question content]"

# Antigravity call
node "[LLM_SCRIPT]" antigravity orchestrate-json "[question content]"

# Long prompt - use --input file (write JSON file first with Write tool)
node "[LLM_SCRIPT]" gpt orchestrate-json --input "[SCRATCHPAD]/input.json"
```

### External LLM Fallback

**When GPT/Antigravity hook fails, Claude MUST handle the task directly:**
- Do NOT retry the external LLM call
- Claude handles the task using its own capabilities
- Continue with the implementation without interruption
- Log the fallback but don't block progress

## Codex Plugin Integration

> **Codex 플러그인 감지**: 워크플로우 시작 시 아래 명령으로 자동 감지.

```bash
CODEX_AVAILABLE=$(node "{{VIBE_PATH}}/hooks/scripts/codex-detect.js" 2>/dev/null || echo "unavailable")
```

`available`이면 `/codex:rescue` (구현 위임), `/codex:review` (코드 리뷰) 자동 호출.

**독립 시나리오 위임:**
```
/codex:rescue "Implement scenario: {scenario-name}. Files: {file-list}. Requirements: {requirements-summary}" --background
```

**위임 기준:**
- 시나리오 간 파일 의존성 없음 (독립적)
- 시나리오 복잡도 중간 이하
- 의존성 있는 시나리오는 Claude가 직접 구현
