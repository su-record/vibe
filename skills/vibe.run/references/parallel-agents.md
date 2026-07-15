# Parallel Agents & Model Orchestration — Full Reference

> Loaded by vibe.run SKILL.md when parallel execution patterns, parallel subagent groups, or model selection details are needed.

## Model Orchestration (Intelligent Routing)

Automatically select optimal model based on **task complexity analysis**.

### Complexity-Based Model Selection

| Complexity Score | Model | When to Use |
|------------------|-------|-------------|
| 0-7 (Low) | **Haiku** | Simple fixes, searches, single file changes |
| 8-19 (Medium) | **Sonnet** | Standard features, 3-5 files, integrations |
| 20+ (High) | **Opus** | Architecture, security, multi-service, 6+ files |

### Complexity Signals

| Signal | Score |
|--------|-------|
| Architecture change | +15 |
| Security implication | +12 |
| Multi-service | +8 |
| Refactoring | +12 |
| 6+ files | +15 |
| 3-5 files | +8 |
| New feature | +5 |
| Bug fix | -3 |
| Documentation | -5 |

### Agent × Model Selection

Tier-variant agents were consolidated — the model is a Task parameter, not a separate agent:

| Agent | Low | Medium | High |
|-------|-------------|-----------------|-------------|
| Explore (native) | `model: "haiku"` | `model: "sonnet"` | `model: "opus"` |
| implementer | `model: "haiku"` | `model: "sonnet"` | `model: "opus"` |
| architect | `model: "haiku"` | `model: "sonnet"` | `model: "opus"` |

### Task Calls by Role

| Task Type | Model | Task Parameter |
|-----------|-------|----------------|
| Simple search | Haiku | `model: "haiku"` |
| Codebase exploration | Haiku/Sonnet | Auto-selected |
| Core implementation | Sonnet | `model: "sonnet"` |
| Test writing | Haiku | `model: "haiku"` |
| Architecture decisions | Opus | Main session |
| Final review | Opus | Main session |

## Mandatory Parallel Exploration (Phase Start)

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
│  [If GPT enabled] Bash: node "[LLM_SCRIPT]" gpt orchestrate-json "[question]"
│  [If Antigravity enabled] Bash: node "[LLM_SCRIPT]" antigravity orchestrate-json "[question]"
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
│  STEP 3: IMPLEMENT + BACKGROUND AGENTS (PARALLEL)               │
│                                                                 │
│  Main Agent (sonnet):                                           │
│  └─→ Execute current phase implementation                       │
│                                                                 │
│  Background Agents (haiku, run_in_background=true):             │
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
│  └─→ Task(haiku): Write tests using pre-generated cases         │
│                                                                 │
│  Next Phase Prep (from background results):                     │
│  └─→ Already have file analysis, ready to start immediately     │
└─────────────────────────────────────────────────────────────────┘
```

### Parallel Task Call Pattern (MUST FOLLOW)

**Correct — Single message with multiple parallel Tasks:**
```
<message>
  Task(haiku, "Analyze src/components/ for existing patterns")
  Task(haiku, "Check package.json dependencies")
  Task(haiku, "Find usage of similar features in codebase")
</message>
→ All 3 run simultaneously, ~3x faster
```

**WRONG — Sequential calls (DO NOT DO THIS):**
```
<message>Task(haiku, "Analyze...")</message>
<message>Task(haiku, "Check...")</message>
<message>Task(haiku, "Find...")</message>
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
    ├─→ [PARALLEL] Task(haiku) × 3: Exploration
    │       - Related code analysis
    │       - Dependency check
    │       - Pattern discovery
    │
    ↓ (all complete)
    │
    ├─→ Opus: Synthesize and decide
    │
    ├─→ [PARALLEL PIPELINE] ←── KEY SPEED OPTIMIZATION
    │       │
    │       ├─→ Main: Task(sonnet) Implementation
    │       │
    │       └─→ Background (run_in_background=true):
    │               ├─→ Task(haiku): Phase N+1 file analysis
    │               ├─→ Task(haiku): Test case preparation
    │               └─→ Task(haiku): Type/interface lookup
    │
    ↓ (main completes)
    │
    ├─→ Task(haiku): Tests (uses pre-generated cases)
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
