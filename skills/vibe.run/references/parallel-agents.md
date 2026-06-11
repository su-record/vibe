# Parallel Agents & Model Orchestration — Full Reference

> Loaded by vibe.run SKILL.md when parallel execution patterns, agent teams, or model selection details are needed.

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

### Agent Tier System

| Agent | Low (Haiku) | Medium (Sonnet) | High (Opus) |
|-------|-------------|-----------------|-------------|
| explorer | explorer-low | explorer-medium | explorer |
| implementer | implementer-low | implementer-medium | implementer |
| architect | architect-low | architect-medium | architect |

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

### Background Agent Pattern (ULTRAWORK) via Orchestrator

```bash
# Start background agent (doesn't block)
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/infra/orchestrator/index.js').then(o => o.runAgent('Phase 2 prep: Analyze auth API endpoints', 'phase2-prep').then(r => console.log(r.content[0].text)))"

# Multiple backgrounds in parallel
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/infra/orchestrator/index.js').then(async o => {
  await Promise.all([
    o.runAgent('Phase 2 prep: Analyze auth API endpoints', 'phase2-prep'),
    o.runAgent('Pre-generate test cases for login form', 'test-prep'),
    o.runAgent('Find existing validation patterns', 'pattern-finder')
  ]);
  console.log('All background agents started');
})"
```

**Check background agent status:**
```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/infra/orchestrator/index.js').then(o => console.log(o.status().content[0].text))"
```

**Get result when ready:**
```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/infra/orchestrator/index.js').then(o => o.getResult('SESSION_ID').then(r => console.log(r.content[0].text)))"
```

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

## Agent Teams

### Dev Team (Full)

> **팀 정의**: `agents/teams/dev-team.md` 참조
> 설정: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `teammateMode: in-process`

**활성화 조건:**
- ULTRAWORK 모드 + 3개 이상 시나리오
- 또는 복잡도 점수 20+ (High)

### Lite Team (Normal Mode)

> **팀 정의**: `agents/teams/lite-team.md` 참조

**활성화 조건:**
- 일반 모드 + 3개 이상 시나리오
- 복잡도 점수 8-19 (Medium)
- 단순 구현(1-2 파일, 시나리오 2개 이하)에서는 기존 병렬 모드 유지

**팀 선택 기준:**

| 조건 | 팀 |
|------|-----|
| 시나리오 1-2개, 파일 1-2개 | 기존 병렬 모드 (팀 없음) |
| 시나리오 3개+, 일반 모드 | **Lite Team (3명)** |
| ULTRAWORK 또는 복잡도 20+ | Dev Team Full (4명) |

### Review Team

> **팀 정의**: `agents/teams/review-debate-team.md` 참조

**활성화 조건:**
- `/vibe.review` 실행 후 P1 또는 P2 이슈 2개 이상 발견 시
- Agent Teams 환경변수 활성화 상태

### Debug Team

> **팀 정의**: `agents/teams/debug-team.md` 참조

**활성화 조건:**
- 동일 빌드/테스트 실패 3회 이상
- architecture-level uncertainty during review (stuck on root cause)

### Research Team

> **팀 정의**: `agents/teams/research-team.md` 참조

**활성화 조건:**
- `/vibe.spec` Step 3 리서치 단계
- Agent Teams 환경변수 활성화 상태

### Security Team

> **팀 정의**: `agents/teams/security-team.md` 참조

**활성화 조건:**
- auth, payment, user-data, crypto 관련 파일 변경 감지 시
- 또는 수동으로 `security` 키워드 지정 시

### Migration Team

> **팀 정의**: `agents/teams/migration-team.md` 참조

**활성화 조건:**
- package.json 주요 의존성 버전 변경 감지 시
- 또는 수동으로 `migration` 키워드 지정 시

### Fullstack Team

> **팀 정의**: `agents/teams/fullstack-team.md` 참조

**활성화 조건:**
- SPEC에 frontend + backend 파일이 모두 포함된 경우
- 또는 수동으로 `fullstack` 키워드 지정 시

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
