---
description: Execute implementation from SPEC
argument-hint: "feature name" or --phase N
---

# /vibe.run

Execute **Scenario-Driven Implementation** with automatic quality verification.

> **핵심 원칙**: 시나리오가 곧 구현 단위이자 검증 기준. 모든 시나리오 통과 = 품질 보장.

## Usage

```
/vibe.run "feature-name"              # Full implementation
/vibe.run "feature-name" --phase 1    # Specific Phase only
/vibe.run "feature-name" ultrawork    # ULTRAWORK mode (recommended)
/vibe.run "feature-name" ulw          # Short alias for ultrawork
```

---

## **Scenario-Driven Development (SDD)**

> 비개발자도 품질을 신뢰할 수 있도록, **시나리오 = 구현 = 검증**을 자동화

### 핵심 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCENARIO-DRIVEN IMPLEMENTATION                │
│                                                                  │
│   Feature 파일 로드                                              │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario 1: Happy Path                                    │  │
│   │   Given → When → Then                                     │  │
│   │        ↓                                                  │  │
│   │   [구현] → [즉시 검증] → ✅ Pass                          │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario 2: Edge Case                                     │  │
│   │   Given → When → Then                                     │  │
│   │        ↓                                                  │  │
│   │   [구현] → [즉시 검증] → ❌ Fail → [수정] → ✅ Pass       │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario N: ...                                           │  │
│   │   [구현] → [즉시 검증] → ✅ Pass                          │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  📊 QUALITY REPORT                                        │  │
│   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │  │
│   │  시나리오: 5/5 통과 ✅                                    │  │
│   │  품질 점수: 94/100                                        │  │
│   │  빌드: ✅ | 테스트: ✅                                    │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 시나리오 = 구현 단위

**기존 방식 (Phase 기반)**:
```
Phase 1 → Phase 2 → Phase 3 → ... → 마지막에 검증
                                      ↓
                              "어디서 잘못됐지?"
```

**SDD 방식 (Scenario 기반)**:
```
Scenario 1 → 구현 → 검증 ✅
Scenario 2 → 구현 → 검증 ✅
Scenario 3 → 구현 → 검증 ❌ → 수정 → ✅
...
전체 통과 = 품질 보장
```

### 검증 자동화

각 시나리오 구현 후 **자동 검증**:

| 검증 항목 | 자동 체크 |
|-----------|-----------|
| Given (전제조건) | 상태/데이터 준비 확인 |
| When (행동) | 기능 실행 가능 여부 |
| Then (결과) | 예상 결과 일치 여부 |
| 코드 품질 | 복잡도, 스타일, 보안 |

### 실패 시 자동 수정

```
Scenario 검증 실패
      ↓
[원인 분석] - 어떤 Then 조건이 실패?
      ↓
[수정 구현] - 해당 부분만 수정
      ↓
[재검증] - 다시 체크
      ↓
통과할 때까지 반복 (최대 3회)
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

📄 SPEC: .claude/vibe/specs/brick-game.md
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

**Must follow `.claude/vibe/rules/`:**
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

When external LLMs are enabled in `.claude/vibe/config.json`:

| Role | Model | Condition |
|------|-------|-----------|
| Architecture/Debugging | GPT 5.2 | When `vibe gpt <key>` executed |
| UI/UX Design, Exploration | Gemini 2.5/3 | When `vibe gemini --auth` executed |

When external LLM enabled, automatically called via MCP:
- `mcp__vibe-gpt__chat` - GPT 5.2 architecture consultation
- `mcp__vibe-gemini__gemini_chat` - Gemini 질문/상담
- `mcp__vibe-gemini__gemini_analyze_code` - 코드 분석
- `mcp__vibe-gemini__gemini_review_ui` - UI/UX 리뷰
- `mcp__vibe-gemini__gemini_quick_ask` - 빠른 질문 (탐색용)

### External LLM Fallback

**IMPORTANT**: When Gemini/GPT MCP returns `"status": "fallback"`, Claude MUST handle the task directly:

```json
{
  "status": "fallback",
  "reason": "rate_limit",  // or "auth_error"
  "message": "Gemini API 할당량 초과. Claude가 직접 처리해주세요."
}
```

**Fallback behavior**:
- Do NOT retry the external LLM call
- Claude handles the task using its own capabilities
- Continue with the implementation without interruption
- Log the fallback but don't block progress

## Vibe Tools (Semantic Analysis & Memory)

Use vibe tools for accurate codebase understanding and session continuity.

### Tool Invocation

All tools are called via:
```bash
node -e "import('@su-record/vibe/tools').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Semantic Analysis Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| `findSymbol` | Find symbol definitions | `{symbolName: 'functionName', searchPath: '.'}` |
| `findReferences` | Find all references | `{symbolName: 'functionName', searchPath: '.'}` |
| `analyzeComplexity` | Analyze code complexity | `{filePath: 'src/file.ts'}` |
| `validateCodeQuality` | Validate code quality | `{filePath: 'src/file.ts'}` |

**Example - Find symbol:**
```bash
node -e "import('@su-record/vibe/tools').then(t => t.findSymbol({symbolName: 'login', searchPath: '.'}).then(r => console.log(r.content[0].text)))"
```

### Memory Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| `saveMemory` | Save important decisions | `{key: 'decision-name', value: 'content', category: 'project'}` |
| `recallMemory` | Recall saved memory | `{key: 'decision-name'}` |
| `listMemories` | List all memories | `{category: 'project'}` |

**Example - Save important decision:**
```bash
node -e "import('@su-record/vibe/tools').then(t => t.saveMemory({key: 'auth-pattern', value: 'Using JWT with refresh tokens', category: 'project'}).then(r => console.log(r.content[0].text)))"
```

### Session Management (Auto via Hooks)

- **Session start**: Hook auto-calls `startSession` to restore previous context
- **Context 80%+**: Hook auto-calls `autoSaveContext` to preserve state

## Process

### 1. Load SPEC + Feature

```
📄 .claude/vibe/specs/{feature-name}.md      → SPEC (구조, 제약, 컨텍스트)
📄 .claude/vibe/features/{feature-name}.feature → Feature (시나리오 = 구현 단위)
```

**Feature 파일이 없으면 에러**:
```
❌ Feature 파일이 없습니다.
   먼저 /vibe.spec "{feature-name}"을 실행하세요.
```

### 2. Scenario 목록 추출

Feature 파일에서 모든 Scenario 추출:

```markdown
## Scenarios to Implement

| # | Scenario | Status |
|---|----------|--------|
| 1 | 유효한 로그인 성공 | ⬜ |
| 2 | 잘못된 비밀번호 에러 | ⬜ |
| 3 | 이메일 형식 검증 | ⬜ |
| 4 | 비밀번호 찾기 링크 | ⬜ |

Total: 4 scenarios
```

### 3. Scenario-by-Scenario Implementation (핵심)

**각 시나리오마다**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 1/4: 유효한 로그인 성공
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Given: 사용자가 등록되어 있다
When: 유효한 이메일과 비밀번호로 로그인
Then: 로그인 성공 + JWT 토큰 반환

[Step 1] 구현 분석...
  - 필요한 파일: auth.service.ts, login.controller.ts
  - 관련 코드 탐색 중...

[Step 2] 구현 중...
  ✅ auth.service.ts - login() 메서드 추가
  ✅ login.controller.ts - POST /login 엔드포인트

[Step 3] 검증 중...
  ✅ Given: 테스트 사용자 생성 가능
  ✅ When: 로그인 API 호출 성공
  ✅ Then: JWT 토큰 반환 확인

✅ Scenario 1 통과!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**실패 시**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 2/4: 잘못된 비밀번호 에러
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 3] 검증 중...
  ✅ Given: 테스트 사용자 존재
  ✅ When: 잘못된 비밀번호로 로그인 시도
  ❌ Then: "Invalid credentials" 에러 메시지
     실제: "Error occurred" 반환됨

[자동 수정 1/3]
  원인: 에러 메시지 하드코딩 안됨
  수정: auth.service.ts line 42

[재검증]
  ✅ Then: "Invalid credentials" 에러 메시지

✅ Scenario 2 통과! (수정 1회)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

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

### Background Agent Pattern (ULTRAWORK) via Orchestrator

**Launch background agents for next phase via Orchestrator:**
```bash
# Start background agent (doesn't block)
node -e "import('@su-record/vibe/orchestrator').then(o => o.runAgent('Phase 2 prep: Analyze auth API endpoints', 'phase2-prep').then(r => console.log(r.content[0].text)))"

# Multiple backgrounds in parallel
node -e "import('@su-record/vibe/orchestrator').then(async o => {
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
node -e "import('@su-record/vibe/orchestrator').then(o => console.log(o.status().content[0].text))"
```

**Get result when ready:**
```bash
node -e "import('@su-record/vibe/orchestrator').then(o => o.getResult('SESSION_ID').then(r => console.log(r.content[0].text)))"
```

**Why Background Agents Matter:**

| Without Background | With Background |
|--------------------|-----------------|
| Phase 1: 60s | Phase 1: 60s (+ backgrounds running) |
| Phase 2 prep: 20s | Phase 2 prep: 0s (already done!) |
| Phase 2: 60s | Phase 2: 60s |
| **Total: 140s** | **Total: 120s** |

For 5 phases: 4 × 20s saved = **80s faster**

### Why Parallel Matters

| Approach | Time | Cache Benefit |
|----------|------|---------------|
| Sequential (3 Tasks) | ~30s | Cache cold on each |
| **Parallel (3 Tasks)** | **~10s** | **Cache warmed once, shared** |

hi-ai ProjectCache (LRU) caches ts-morph parsing results. Parallel calls share the warmed cache.

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
    ↓ (Background results ready - NO WAIT for Phase N+1 exploration!)
    │
Phase N+1 Start (IMMEDIATE - exploration already done!)
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

---

1. **Related code analysis**: Task(haiku) explores `<context>` related code
2. **File creation/modification**: Task(sonnet) implements per `<output_format>`
3. **Constraint compliance**: Check `<constraints>`
4. **Run verification**: Execute verification commands

### 4. Gemini 코드 리뷰 + 자동 수정 (NEW)

모든 시나리오 구현 완료 후, **Gemini가 코드를 리뷰하고 피드백 기반으로 자동 수정**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 GEMINI CODE REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] Gemini에게 구현 코드 전송...
  - 변경된 파일: auth.service.ts, auth.controller.ts, ...

[Step 2] Gemini 리뷰 결과:
  ┌─────────────────────────────────────────────────────┐
  │ 📝 Gemini Feedback                                  │
  │                                                     │
  │ 1. [개선] auth.service.ts:24                        │
  │    비밀번호 비교 시 timing attack 방지 필요         │
  │    → crypto.timingSafeEqual() 사용 권장            │
  │                                                     │
  │ 2. [개선] auth.controller.ts:15                     │
  │    rate limiting 미적용                             │
  │    → 로그인 시도 제한 추가 권장                    │
  │                                                     │
  │ 3. [스타일] auth.service.ts:42                      │
  │    매직 넘버 사용                                   │
  │    → 상수로 추출 권장                              │
  └─────────────────────────────────────────────────────┘

[Step 3] 피드백 기반 자동 수정...
  ✅ auth.service.ts:24 - timingSafeEqual 적용
  ✅ auth.controller.ts:15 - rate limiter 추가
  ✅ auth.service.ts:42 - 상수 추출

[Step 4] 재검증...
  ✅ 빌드 성공
  ✅ 테스트 통과

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Gemini 리뷰 완료! 3개 개선사항 반영
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**MUST: Gemini MCP 호출 (필수)**

Gemini MCP가 활성화된 경우, **반드시** 아래 MCP를 호출하여 코드 리뷰를 받아야 합니다:

```
mcp__vibe-gemini__gemini_analyze_code({
  code: "[변경된 파일들의 전체 코드]",
  context: "SPEC 요구사항: [요약]\n시나리오: [구현한 시나리오 목록]",
  focus: "security,performance,best-practices"
})
```

**호출 순서:**
1. 변경된 모든 파일 내용을 `code` 파라미터에 포함
2. SPEC의 핵심 요구사항을 `context`에 요약
3. MCP 호출 실행
4. 응답의 피드백 항목별로 코드 수정
5. 빌드/테스트 재실행

**fallback 처리:**
- `"status": "fallback"` 응답 시 → 스킵하고 다음 단계로 진행
- 네트워크 에러 시 → 1회 재시도 후 스킵

**리뷰 적용 규칙:**

| 피드백 유형 | 처리 |
|------------|------|
| 보안 취약점 | 즉시 자동 수정 |
| 성능 개선 | 즉시 자동 수정 |
| 베스트 프랙티스 | 자동 수정 |
| 스타일/취향 | 선택적 적용 (프로젝트 컨벤션 우선) |

**조건:**
- Gemini MCP가 활성화된 경우에만 실행 (`vibe gemini --auth`)
- fallback 응답 시 스킵하고 다음 단계로 진행
- 수정 후 반드시 빌드/테스트 재검증

### 5. Quality Report (자동 생성)

모든 시나리오 완료 + Gemini 리뷰 후 **품질 리포트 자동 생성**:

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 QUALITY REPORT: login                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 시나리오: 4/4 통과                                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ # │ Scenario                  │ Status │ Retries │        │  │
│  │───│───────────────────────────│────────│─────────│        │  │
│  │ 1 │ 유효한 로그인 성공         │ ✅     │ 0       │        │  │
│  │ 2 │ 잘못된 비밀번호 에러       │ ✅     │ 1       │        │  │
│  │ 3 │ 이메일 형식 검증           │ ✅     │ 0       │        │  │
│  │ 4 │ 비밀번호 찾기 링크         │ ✅     │ 0       │        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📈 품질 점수: 94/100                                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 항목              │ 결과  │ 비고                        │    │
│  │───────────────────│───────│─────────────────────────────│    │
│  │ 빌드              │ ✅    │ npm run build 성공          │    │
│  │ 테스트            │ ✅    │ 12/12 통과                  │    │
│  │ 타입 검사         │ ✅    │ 에러 0개                    │    │
│  │ 복잡도            │ ✅    │ 모든 함수 ≤30줄            │    │
│  │ 보안              │ ✅    │ 취약점 0개                  │    │
│  │ Gemini 리뷰       │ ✅    │ 3개 개선사항 반영           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ⏱️ 총 소요: 3m 42s                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**사용자가 확인할 것**:
- 시나리오 통과율 (4/4 = 100%)
- 품질 점수 (94/100)
- 빌드/테스트 상태

**이것만 보면 품질을 신뢰할 수 있음.**

### 6. Update Feature File

시나리오 상태 자동 업데이트:

```markdown
## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 유효한 로그인 성공 | AC-1 | ✅ |
| 잘못된 비밀번호 에러 | AC-2 | ✅ |
| 이메일 형식 검증 | AC-3 | ✅ |
| 비밀번호 찾기 링크 | AC-4 | ✅ |

**Last verified**: 2024-01-15 14:32
**Quality score**: 94/100
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

- `.claude/vibe/specs/{feature-name}.md` (PTCF SPEC)
- `.claude/vibe/features/{feature-name}.feature` (BDD)
- `CLAUDE.md` (project context)

## Output

- Implemented code files
- Test files
- Updated SPEC document (checkmarks)

## Example

```
User: /vibe.run "login"

Claude:
📄 Loading SPEC: .claude/vibe/specs/login.md
📄 Loading Feature: .claude/vibe/features/login.feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Scenarios to Implement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| # | Scenario | Status |
|---|----------|--------|
| 1 | 유효한 로그인 성공 | ⬜ |
| 2 | 잘못된 비밀번호 에러 | ⬜ |
| 3 | 이메일 형식 검증 | ⬜ |
| 4 | 비밀번호 찾기 링크 | ⬜ |

Total: 4 scenarios

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 1/4: 유효한 로그인 성공
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Given: 사용자가 등록되어 있다
When: 유효한 이메일과 비밀번호로 로그인
Then: 로그인 성공 + JWT 토큰 반환

⚡ [PARALLEL] 탐색 중...
✅ 탐색 완료 (2.1s)

🔨 구현 중...
  ✅ auth.service.ts - login() 추가
  ✅ auth.controller.ts - POST /login

🔍 검증 중...
  ✅ Given: OK
  ✅ When: OK
  ✅ Then: OK

✅ Scenario 1 통과!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 2/4: 잘못된 비밀번호 에러
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔨 구현 중...
  ✅ auth.service.ts - 비밀번호 검증 로직

🔍 검증 중...
  ✅ Given: OK
  ✅ When: OK
  ❌ Then: "Invalid credentials" 에러 메시지
     실제: "Error" 반환

🔄 자동 수정 1/3...
  수정: auth.service.ts line 42

🔍 재검증...
  ✅ Then: OK

✅ Scenario 2 통과! (수정 1회)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 3/4: 이메일 형식 검증
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔨 구현 중...
🔍 검증 중...
✅ Scenario 3 통과!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 4/4: 비밀번호 찾기 링크
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔨 구현 중...
🔍 검증 중...
✅ Scenario 4 통과!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 GEMINI CODE REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 Gemini에게 코드 전송 중...
📝 Gemini 피드백:
  1. [보안] timing attack 방지 필요 → 수정 중...
  2. [성능] 불필요한 DB 호출 → 수정 중...

✅ 2개 개선사항 자동 반영
🔍 재검증... ✅ 통과

┌─────────────────────────────────────────────────────────────────┐
│  📊 QUALITY REPORT: login                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 시나리오: 4/4 통과                                          │
│                                                                 │
│  | # | Scenario              | Status | Retries |               │
│  |---|───────────────────────|───────|─────────|               │
│  | 1 | 유효한 로그인 성공     | ✅    | 0       |               │
│  | 2 | 잘못된 비밀번호 에러   | ✅    | 1       |               │
│  | 3 | 이메일 형식 검증       | ✅    | 0       |               │
│  | 4 | 비밀번호 찾기 링크     | ✅    | 0       |               │
│                                                                 │
│  📈 품질 점수: 94/100                                           │
│  빌드: ✅ | 테스트: ✅ | 타입: ✅ | Gemini: ✅ (2개 반영)       │
│                                                                 │
│  ⏱️ 총 소요: 3m 42s                                             │
└─────────────────────────────────────────────────────────────────┘

🎉 구현 완료! 모든 시나리오 통과 + Gemini 리뷰 반영.
```

### Phase-specific Execution

```
User: /vibe.run "brick-game" --phase 2

Claude:
📄 Reading SPEC: .claude/vibe/specs/brick-game.md
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
