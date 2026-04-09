---
description: Execute implementation from SPEC
argument-hint: "feature name" or --phase N
---

# /vibe.run

Execute **Scenario-Driven Implementation** with automatic quality verification.

> **Core Principle**: Scenarios are both the implementation unit and verification criteria. All scenarios passing = Quality guaranteed.

## Usage

```
/vibe.run "feature-name"              # Full implementation
/vibe.run "feature-name" --phase 1    # Specific Phase only
/vibe.run "feature-name" ultrawork    # ULTRAWORK mode (recommended)
/vibe.run "feature-name" ulw          # Short alias for ultrawork
```

---

## Codex Plugin Integration

> **Codex 플러그인 감지**: 워크플로우 시작 시 아래 명령으로 자동 감지.
>
> ```bash
> CODEX_AVAILABLE=$(node "{{VIBE_PATH}}/hooks/scripts/codex-detect.js" 2>/dev/null || echo "unavailable")
> ```
>
> `available`이면 `/codex:rescue` (구현 위임), `/codex:review` (코드 리뷰) 자동 호출. `unavailable`이면 기존 워크플로우로 동작.

---

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## File Reading Policy (Mandatory)

- **SPEC/Feature 파일**: 반드시 `Read` 도구로 전체 파일을 읽을 것 (Grep 금지)
- **소스코드 파일**: 구현/수정 대상 파일은 반드시 `Read` 도구로 전체 읽은 후 작업할 것
- **Grep 사용 제한**: 파일 위치 탐색(어떤 파일에 있는지 찾기)에만 사용. 파일 내용 파악에는 반드시 Read 사용
- **에이전트 spawn 시**: 프롬프트에 "대상 파일을 Read 도구로 전체 읽은 후 구현하라"를 반드시 포함할 것
- **부분 읽기 금지**: Grep 결과의 주변 몇 줄만 보고 수정하지 말 것. 전체 맥락을 파악해야 기존 코드와 일관된 구현 가능

## **Scenario-Driven Development (SDD)**

> Automate **Scenario = Implementation = Verification** so even non-developers can trust quality

### Core Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCENARIO-DRIVEN IMPLEMENTATION                │
│                                                                  │
│   Load Feature file                                              │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario 1: Happy Path                                    │  │
│   │   Given → When → Then                                     │  │
│   │        ↓                                                  │  │
│   │   [Implement] → [Verify immediately] → ✅ Pass            │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario 2: Edge Case                                     │  │
│   │   Given → When → Then                                     │  │
│   │        ↓                                                  │  │
│   │   [Implement] → [Verify] → ❌ Fail → [Fix] → ✅ Pass      │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario N: ...                                           │  │
│   │   [Implement] → [Verify immediately] → ✅ Pass            │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  📊 QUALITY REPORT                                        │  │
│   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │  │
│   │  Scenarios: 5/5 passed ✅                                 │  │
│   │  Quality score: 94/100                                    │  │
│   │  Build: ✅ | Tests: ✅                                    │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Scenario = Implementation Unit

**Traditional approach (Phase-based)**:
```
Phase 1 → Phase 2 → Phase 3 → ... → Verify at the end
                                      ↓
                              "Where did it go wrong?"
```

**SDD approach (Scenario-based)**:
```
Scenario 1 → Implement → Verify ✅
Scenario 2 → Implement → Verify ✅
Scenario 3 → Implement → Verify ❌ → Fix → ✅
...
All pass = Quality guaranteed
```

### Automated Verification (Closed Loop)

**자율적 AI 코딩 = 구현 + 검증 + 반복. 검증을 AI에게 맡기는 순간 루프가 닫힌다.**

After implementing each scenario, **automatic verification**:

| Verification Item | Auto Check | Method |
|-------------------|------------|--------|
| Given (precondition) | State/data preparation confirmed | Code analysis |
| When (action) | Feature execution possible | Code analysis + Build |
| Then (result) | Expected result matches | Code analysis + Test |
| Code quality | Complexity, style, security | Static analysis |
| **UI behavior** | **실제 브라우저에서 동작 확인** | **E2E Closed Loop** |

### E2E Closed Loop (UI Scenarios)

**UI 시나리오가 포함된 Feature일 때 자동 활성화.**

```
┌─────────────────────────────────────────────────────────────────┐
│  CLOSED LOOP = 구현 + 검증 + 반복                                 │
│                                                                  │
│  Scenario 구현 완료                                               │
│       ↓                                                          │
│  [E2E 검증] AI가 직접 브라우저 조작                                │
│       │   (접근성 트리 기반 — 토큰 효율적)                         │
│       ├─ PASS → Next scenario                                    │
│       └─ FAIL → Root cause analysis                              │
│              → Fix code (Read full file first)                   │
│              → Re-run failed scenario only                       │
│              → PASS? → Next scenario                             │
│              → FAIL? → Retry (max 3)                             │
│                                                                  │
│  핵심: 검증이 가벼울수록 루프는 더 많이 돈다                       │
│  - 접근성 트리: button "Sign In" = 15 chars                      │
│  - DOM 트리: div class="nav-wrapper mx-4..." = 200+ chars        │
│  - 전자를 써야 한 세션에서 수십 개 시나리오 검증 가능               │
└─────────────────────────────────────────────────────────────────┘
```

**Browser Tool Priority:**

| Priority | Tool | 용도 |
|----------|------|------|
| 1st | Agent Browser (접근성 트리) | AI 직접 조작, 최소 토큰 |
| 2nd | Playwright Test Runner | 테스트 코드 실행, pass/fail 반환 |
| 3rd | Playwright MCP (DOM) | 최후 수단, 토큰 비효율 |

**활성화 조건:**
- Feature 파일에 UI 관련 시나리오 존재 (form, button, page, navigate 등)
- `.claude/vibe/e2e/config.json`의 `closedLoop.enabled: true` (기본값)
- dev server가 실행 중 (`baseURL` 접근 가능)

### Auto-Fix on Failure

```
Scenario verification failed (코드 분석 또는 E2E)
      ↓
[Collect evidence]
  - E2E: screenshot, console errors, accessibility tree snapshot
  - Code: build errors, test failures, type errors
      ↓
[Root cause analysis] - Which Then condition failed?
      ↓
[Read target file FULLY] - Grep으로 훑지 말 것
      ↓
[Implement fix] - Fix only that part
      ↓
[Re-verify] - Re-run ONLY failed scenario (save tokens)
      ↓
Repeat until pass (max 3 times)
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
| **Race Review (v2.6.9)** | Multi-LLM review (GPT+Gemini) with cross-validation |

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

### Ralph Loop (Completion Verification) - CRITICAL

> **Inspired by [ghuntley.com/ralph](https://ghuntley.com/ralph)**: "Deterministically bad in an undeterministic world" - Keep iterating until TRULY complete.

**Problem**: AI often claims "complete" when implementation is partial.

**Solution**: RTM-based automated coverage verification with iteration tracking.

```
┌─────────────────────────────────────────────────────────────────┐
│                    RALPH LOOP (Mandatory)                        │
│                                                                  │
│   After ALL phases complete:                                     │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  RTM COVERAGE VERIFICATION [Iteration {{ITER}}/{{MAX}}]   │  │
│   │                                                           │  │
│   │  Generate RTM via core tools:                             │  │
│   │  → generateTraceabilityMatrix("{feature-name}")           │  │
│   │                                                           │  │
│   │  Coverage Metrics (automated):                            │  │
│   │  □ Requirements coverage: {coveragePercent}%              │  │
│   │  □ SPEC → Feature mapping: {featureCovered}/{total}       │  │
│   │  □ Feature → Test mapping: {testCovered}/{total}          │  │
│   │  □ Build successful?                                      │  │
│   │  □ Tests passing?                                         │  │
│   │                                                           │  │
│   │  UNCOVERED: {uncoveredRequirements[]}                     │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                   ┌──────────┴──────────┐                       │
│                   │  Coverage ≥ 95%?    │                       │
│                   └──────────┬──────────┘                       │
│                       │              │                          │
│                      NO            YES                          │
│                       │              │                          │
│                       ↓              ↓                          │
│              ┌────────────────┐  ┌────────────────┐             │
│              │ IMPLEMENT      │  │ ✅ TRULY DONE  │             │
│              │ UNCOVERED      │  │                │             │
│              │ REQUIREMENTS   │  │ Report final   │             │
│              │ (auto-extract) │  │ RTM coverage   │             │
│              └───────┬────────┘  └────────────────┘             │
│                      │                                          │
│                      └──────────→ [Re-generate RTM]             │
│                                                                  │
│   MAX_ITERATIONS: 5 (prevent infinite loops)                    │
│   COVERAGE_THRESHOLD: 95% (quality gate)                        │
│   ZERO TOLERANCE for scope reduction                            │
└─────────────────────────────────────────────────────────────────┘
```

**Ralph Loop with RTM:**

```bash
# Generate RTM for coverage verification
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.generateTraceabilityMatrix('{feature-name}', {projectPath: process.cwd()}).then(r => console.log(JSON.stringify(r, null, 2))))"
```

**RTM provides automated metrics:**

| Metric | Description |
|--------|-------------|
| `totalRequirements` | Total REQ-* items in SPEC |
| `specCovered` | Requirements with SPEC mapping |
| `featureCovered` | Requirements with Feature scenarios |
| `testCovered` | Requirements with test files |
| `coveragePercent` | Overall coverage percentage |
| `uncoveredRequirements` | List of missing REQ-* IDs |

**Ralph Loop Rules:**

| Rule | Description |
|------|-------------|
| **No Scope Reduction** | Never say "simplified" or "basic version" - implement FULL request |
| **Iteration Tracking** | Display `[{{ITER}}/{{MAX}}]` to show progress |
| **RTM-Based Gap List** | Use `uncoveredRequirements` array - no manual comparison |
| **Coverage Threshold** | Must reach 95% coverage to complete |
| **Max Iterations** | Stop at 5 iterations (report remaining gaps as TODO) |
| **Convergence Detection** | If coverage % unchanged between iterations → STOP (converged) |
| **Diminishing Returns** | Iteration 3+ → only implement unmet core requirements (REQ-*-001~003), rest goes to TODO |

**Ralph Loop Output Format:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 RALPH VERIFICATION [Iteration 1/5]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 RTM Coverage Report: login

Requirements Traceability:
  Total Requirements: 9
  SPEC Covered: 9/9 (100%)
  Feature Covered: 5/9 (55%)
  Test Covered: 4/9 (44%)

  ✅ REQ-login-001: Login form UI → Scenario 1 → login.test.ts
  ✅ REQ-login-002: Email validation → Scenario 2 → validation.test.ts
  ✅ REQ-login-003: Password validation → Scenario 2 → validation.test.ts
  ❌ REQ-login-004: Remember me checkbox → NOT IMPLEMENTED
  ❌ REQ-login-005: Forgot password link → NOT IMPLEMENTED
  ✅ REQ-login-006: API integration → Scenario 3 → api.test.ts
  ❌ REQ-login-007: Loading state → NOT IMPLEMENTED
  ❌ REQ-login-008: Error toast → NOT IMPLEMENTED
  ✅ REQ-login-009: Session storage → Scenario 4 → (no test)

Overall Coverage: 55% ⚠️ BELOW 95% THRESHOLD

UNCOVERED REQUIREMENTS (auto-extracted from RTM):
  1. REQ-login-004: Remember me checkbox
  2. REQ-login-005: Forgot password link
  3. REQ-login-007: Loading state
  4. REQ-login-008: Error toast notifications

⚠️ NOT COMPLETE - Implementing uncovered requirements...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 RALPH VERIFICATION [Iteration 2/5]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 RTM Coverage Report: login

Requirements Traceability:
  Total Requirements: 9
  SPEC Covered: 9/9 (100%)
  Feature Covered: 9/9 (100%)
  Test Covered: 9/9 (100%)

Overall Coverage: 100% ✅ ABOVE 95% THRESHOLD

Build: ✅ Passed
Tests: ✅ 12/12 Passed
Type Check: ✅ No errors

✅ RALPH VERIFIED COMPLETE!

📄 RTM saved: .claude/vibe/rtm/login-rtm.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When to Trigger Ralph Loop:**

1. After all phases complete
2. Before final quality report
3. Whenever user says "ultrawork" or "ralph"

**Forbidden Responses (VIOLATIONS):**

| ❌ NEVER Say | ✅ Instead |
|-------------|-----------|
| "I've implemented a basic version" | Implement the FULL version |
| "This is a simplified approach" | Implement as specified |
| "You can add X later" | Add X now |
| "For demonstration purposes" | Implement production-ready |
| "The core functionality is done" | ALL functionality must be done |

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

## Automation Level System

Magic keywords in the user input automatically set the **AutomationLevel**, which controls how much the AI self-advances vs. pausing for confirmation.

### Level Definitions

| Level | Name | Keyword(s) | Auto-advance | Auto-retry | Max Retries | Parallel Agents | Checkpoints |
|-------|------|------------|--------------|------------|-------------|-----------------|-------------|
| L0 | Manual | `manual` | No | No | 0 | No | All |
| L1 | Guided | `guided`, `verify` | No | No | 0 | No | All |
| L2 | Semi-auto | `quick` (default) | Yes | Yes | 2 | No | Key points |
| L3 | Auto | `ultrawork`, `ulw` | Yes | Yes | 3 | Yes | Checkpoint-only |
| L4 | Full-auto | `ralph`, `ralplan` | Yes | Yes | 5 | Yes | None |

### Detection Rule

The AI detects automation level from word boundaries in the user's input:

```
/vibe.run "login"              → L2 Semi-auto (default)
/vibe.run "login" ultrawork    → L3 Auto
/vibe.run "login" ralph        → L4 Full-auto
/vibe.run "login" verify       → L1 Guided
```

### Confirmation Matrix

Certain action types require user confirmation depending on the active level:

| Action | L0 | L1 | L2 | L3 | L4 |
|--------|----|----|----|----|-----|
| `destructive` | confirm | confirm | confirm | confirm | auto |
| `architecture_choice` | confirm | confirm | confirm | auto | auto |
| `implementation_scope` | confirm | confirm | confirm | auto | auto |
| `phase_advance` | confirm | confirm | auto | auto | auto |
| `fix_strategy` | confirm | confirm | auto | auto | auto |
| `retry` | confirm | auto | auto | auto | auto |

**Rule**: When confirmation is required, pause and display a checkpoint before proceeding.

---

## Interactive Checkpoints

Checkpoints are decision gates inserted at critical points in the workflow. At L3/L4, most checkpoints are **auto-resolved** using the default option.

### Checkpoint Types

| Type | When It Fires | Default Option |
|------|--------------|----------------|
| `requirements_confirm` | Before starting Phase 1 | Confirm (a) |
| `architecture_choice` | When architecture approach is ambiguous | Clean/balanced (b) |
| `implementation_scope` | Before any large scope change (6+ files) | Approve (a) |
| `verification_result` | After each VerificationLoop iteration below threshold | Continue fixing (a) |
| `fix_strategy` | When critical issues are found during quality gate | Fix all (a) |

### Checkpoint Format

When a checkpoint fires, display it in this format:

```
──────────────────────────────────────────────────
CHECKPOINT: Requirements Confirmation
──────────────────────────────────────────────────
Feature: login

Requirements:
  1. User can log in with email and password
  2. Invalid credentials show an error message
  3. Remember me persists session for 30 days

Options:
  a) Confirm
     Proceed with these requirements as stated.
  b) Revise
     Modify or clarify requirements before proceeding.
  c) Abort
     Cancel this workflow.

Default: a
──────────────────────────────────────────────────
```

### Auto-Resolution (L3/L4)

At automation levels L3 and L4, checkpoints that do not require confirmation are auto-resolved:

```
[AUTO] CHECKPOINT: implementation_scope → option a (Approve) [auto-resolved]
```

---

## Rules Reference

**Must follow `~/.claude/vibe/rules/` (global):**

- `core/development-philosophy.md` - Surgical precision, modify only requested scope
- `core/quick-start.md` - Korean, DRY, SRP, YAGNI
- `standards/complexity-metrics.md` - Functions ≤20 lines, nesting ≤3 levels
- `quality/checklist.md` - Code quality checklist

**Language guide:** `~/.claude/vibe/languages/{stack}.md` (global reference)

---

## Coding Guidelines (Mandatory)

### Type Safety: Use Types Explicitly

> **Core Principle**: Use types explicitly in every language that has a type system!

Type definitions are not just language syntax — they are a **core engineering philosophy for simplifying and controlling complex software**.

### Applies to ALL Typed Languages

| Category | Languages | Key Principle |
|----------|-----------|---------------|
| **Static Typed** | Java, C#, C++, Go, Rust, Swift, Kotlin, Scala | Types = compile-time contracts |
| **Gradual Typed** | TypeScript, Python (typing), PHP (typed), Ruby (RBS) | Types = optional safety nets |
| **Functional** | Haskell, OCaml, F#, Elm | Types = logical proofs |

### Universal Anti-Patterns (All Languages)

| ❌ Forbidden Pattern | Why | ✅ Instead |
|---------------------|-----|-----------|
| Type escape hatches (`any`, `Any`, `Object`, `void*`, `interface{}`) | Loses type info, runtime errors | Concrete types or `unknown` + guards |
| Type suppression (`@ts-ignore`, `# type: ignore`, `@SuppressWarnings`) | Hides errors | Fix actual type issues |
| Raw generic types (`List`, `Map` without params) | Loses type safety | `List<User>`, `Map<String, Order>` |
| Excessive casting (`as`, `(Type)`, `unsafe`) | Bypasses compiler | Type guards or pattern matching |

### Language-Specific Guidelines

**TypeScript/JavaScript:**
```typescript
// ❌ BAD
function process(data: any): any { return data.foo; }

// ✅ GOOD
function process(data: unknown): Result {
  if (isValidData(data)) return data.foo;
  throw new Error('Invalid');
}
```

**Python:**
```python
# ❌ BAD
def process(data: Any) -> Any: return data["key"]

# ✅ GOOD
def process(data: UserData) -> str: return data["name"]
```

**Java/Kotlin:**
```java
// ❌ BAD
List items = new ArrayList();  // Raw type
Object data = getData();       // Lost type info

// ✅ GOOD
List<User> users = new ArrayList<>();
User user = getUser();
```

**Go:**
```go
// ❌ BAD
func process(data interface{}) interface{} { ... }

// ✅ GOOD
func process(data UserRequest) (UserResponse, error) { ... }
```

**Rust:**
```rust
// ❌ BAD (unnecessary unsafe or Box<dyn Any>)
let data: Box<dyn Any> = get_data();

// ✅ GOOD
let data: UserData = get_data()?;
```

**C#:**
```csharp
// ❌ BAD
object data = GetData();
dynamic result = Process(data);

// ✅ GOOD
UserData data = GetData();
Result result = Process(data);
```

### Type Safety Rules (Universal)

| Rule | Description |
|------|-------------|
| **Boundary Validation** | Validate only at system boundaries (API, JSON, user input) |
| **Internal Trust** | After validation, pass only precise types internally |
| **No Type Escape** | Never use escape hatches to "fix" type errors |
| **Explicit Signatures** | Specify types in function/method signatures |
| **Generics with Params** | Always use generics with type parameters |

### Quality Gate: Type Violations Block Merge

| Violation | Action |
|-----------|--------|
| Type escape hatches (`any`, `Any`, `Object`, `interface{}`, etc.) | ❌ Block |
| Type suppression comments | ❌ Block |
| Raw generic types | ❌ Block |
| Missing function return types | ⚠️ Warning |
| Excessive type casting | ⚠️ Warning |

## Description

Read PTCF structured SPEC document and execute implementation immediately.

> **PLAN, TASKS documents unnecessary** - SPEC is the executable prompt

## Model Orchestration (Intelligent Routing)

Automatically select optimal model based on **task complexity analysis**.

### Complexity-Based Model Selection

| Complexity Score | Model | When to Use |
|------------------|-------|-------------|
| 0-7 (Low) | **Haiku** | Simple fixes, searches, single file changes |
| 8-19 (Medium) | **Sonnet** | Standard features, 3-5 files, integrations |
| 20+ (High) | **Opus** | Architecture, security, multi-service, 6+ files |

### Complexity Signals

The following signals increase complexity score:

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

Each agent has tier variants for cost optimization:

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

### External LLM Usage (When Enabled)

When external LLMs are enabled in `.claude/vibe/config.json`:

| Role | Method | Condition |
|------|--------|-----------|
| User direct query | `gpt.question`, `gemini.question` | Hook auto-handles |
| Internal orchestration | Call global script via Bash | Claude calls directly |

**User questions (Hook auto-handles):**
- `gpt.question` - GPT architecture consultation
- `gemini.question` - Gemini Q&A/consultation

**Claude internal calls (directly via Bash):**
```bash
# Usage: node llm-orchestrate.js <provider> <mode> [systemPrompt] [prompt]
#   - If systemPrompt omitted, uses default
#   - If systemPrompt is "-", uses default and treats next argument as prompt

# [LLM_SCRIPT] = {{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js

# GPT call (short prompt - CLI arg)
node "[LLM_SCRIPT]" gpt orchestrate-json "[question content]"

# Gemini call
node "[LLM_SCRIPT]" gemini orchestrate-json "[question content]"

# Custom system prompt usage
node "[LLM_SCRIPT]" gpt orchestrate-json "You are a code reviewer" "[question content]"

# Long prompt - use --input file (write JSON file first with Write tool)
# JSON format: {"prompt": "your prompt here"}
node "[LLM_SCRIPT]" gpt orchestrate-json --input "[SCRATCHPAD]/input.json"
```

### External LLM Fallback

**IMPORTANT**: When GPT/Gemini hook fails, Claude MUST handle the task directly:

**Fallback behavior**:
- Do NOT retry the external LLM call
- Claude handles the task using its own capabilities
- Continue with the implementation without interruption
- Log the fallback but don't block progress

## Core Tools (Semantic Analysis & Memory)

Use core tools for accurate codebase understanding and session continuity.

### Tool Invocation

All tools are called via:
```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
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
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.findSymbol({symbolName: 'login', searchPath: '.'}).then(r => console.log(r.content[0].text)))"
```

### Memory Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| `saveMemory` | Save important decisions | `{key: 'decision-name', value: 'content', category: 'project'}` |
| `recallMemory` | Recall saved memory | `{key: 'decision-name'}` |
| `listMemories` | List all memories | `{category: 'project'}` |

**Example - Save important decision:**
```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.saveMemory({key: 'auth-pattern', value: 'Using JWT with refresh tokens', category: 'project'}).then(r => console.log(r.content[0].text)))"
```

### Session Management (Auto via Hooks)

- **Session start**: Hook auto-calls `startSession` to restore previous context
- **Context 80%+**: Hook auto-calls `autoSaveContext` to preserve state

## Process

### 1. Load SPEC + Feature

**Search order (check BOTH file AND folder):**

```
Step 1: Check if SPLIT structure exists (folder)
  📁 .claude/vibe/specs/{feature-name}/        → Folder with _index.md + phase files
  📁 .claude/vibe/features/{feature-name}/      → Folder with _index.feature + phase files

Step 2: If no folder, check single file
  📄 .claude/vibe/specs/{feature-name}.md       → Single SPEC file
  📄 .claude/vibe/features/{feature-name}.feature → Single Feature file

Step 3: If neither exists → Error
```

**Split structure (folder) detected:**
```
📁 .claude/vibe/specs/{feature-name}/
├── _index.md              → Master SPEC (read first for overview)
├── phase-1-{name}.md      → Phase 1 SPEC
├── phase-2-{name}.md      → Phase 2 SPEC
└── ...

📁 .claude/vibe/features/{feature-name}/
├── _index.feature         → Master Feature (read first for scenario overview)
├── phase-1-{name}.feature → Phase 1 scenarios
├── phase-2-{name}.feature → Phase 2 scenarios
└── ...

→ Load _index.md first, then load phase files in order
→ Execute phases sequentially (or per --phase flag)
```

**Single file detected:**
```
📄 .claude/vibe/specs/{feature-name}.md      → SPEC (structure, constraints, context)
📄 .claude/vibe/features/{feature-name}.feature → Feature (scenario = implementation unit)
```

**Error if NEITHER file NOR folder found:**
```
❌ SPEC not found. Searched:
   - .claude/vibe/specs/{feature-name}/  (folder)
   - .claude/vibe/specs/{feature-name}.md (file)

   Run /vibe.spec "{feature-name}" first.
```

### 1-1. Phase Isolation Protocol (Large SPEC Guard)

> **Problem**: Large SPECs (3+ phases, 5+ scenarios) overflow context — agent drifts from SPEC by Phase 3.
> **Solution**: Load only the current phase's SPEC section. Re-anchor before each scenario.

**Phase Isolation Rules (MANDATORY for 3+ phases):**

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE ISOLATION PROTOCOL                                       │
│                                                                  │
│  ❌ WRONG: Load entire SPEC → implement all phases              │
│  ✅ RIGHT: Load _index overview → per-phase load → implement    │
│                                                                  │
│  Step A: Read _index.md (overview only — phase list, REQ IDs)   │
│  Step B: For each Phase N:                                       │
│    1. RE-READ Phase N SPEC section (every time, no memory)       │
│    2. RE-READ Phase N Feature scenarios                          │
│    3. Extract Phase N scope: files, scenarios, requirements      │
│    4. Implement Phase N scenarios                                 │
│    5. Verify Phase N                                             │
│    6. Write Phase Checkpoint → .claude/vibe/checkpoints/         │
│    7. DISCARD Phase N details from working memory                │
│  Step C: Next Phase — go to Step B                               │
└─────────────────────────────────────────────────────────────────┘
```

**Phase Checkpoint Format** (`.claude/vibe/checkpoints/{feature}-phase-{N}.md`):

```markdown
# Checkpoint: {feature} Phase {N}

## Completed
- Scenario 1: {name} ✅
- Scenario 2: {name} ✅

## Files Changed
- src/auth.service.ts (added login(), validateToken())
- src/auth.controller.ts (POST /login, POST /refresh)

## State for Next Phase
- Auth service exports: login(), logout(), validateToken(), refreshToken()
- JWT secret configured in .env (JWT_SECRET)
- Test baseline: 12 tests passing

## Remaining Phases
- Phase {N+1}: {name} — {scenario count} scenarios
- Phase {N+2}: {name} — {scenario count} scenarios
```

**SPEC Re-anchoring (Before EVERY scenario):**

```
Before implementing Scenario X:
  1. Re-read the EXACT Given/When/Then from Feature file (not from memory!)
  2. Compare: "Am I about to implement what the SPEC says, or what I think it says?"
  3. If single-file SPEC: re-read only the current phase section (use line offsets)
  4. If split SPEC: re-read only phase-N-{name}.md
```

**Scope Lock (Per Phase):**

```
At Phase start, declare:
  MODIFY: [list of files this phase will touch]
  CREATE: [list of files this phase will create]
  DO NOT TOUCH: everything else

If implementation requires files outside scope:
  → STOP. Re-read SPEC. Is this actually needed?
  → If yes: add to scope with explicit justification
  → If no: you're drifting. Return to SPEC.
```

**Context Pressure Handling:**

| Context Level | Action |
|---------------|--------|
| < 50% | Normal execution |
| 50-70% | Save checkpoint, trim exploration results |
| 70%+ | Save checkpoint → `/new` → resume from checkpoint |
| Phase boundary | Always save checkpoint regardless of context level |

### 1-2. SPEC-First Gate (Level 3: Spec = Source of Truth)

> **Principle**: SPEC is the source of truth for code. To modify code, update the SPEC first.

**When a change not in the SPEC is needed during implementation:**

```
Discovery during implementation: "An API endpoint not in SPEC is needed"
    │
    ├─ Already in SPEC?
    │   YES → Implement as-is
    │
    ├─ Not in SPEC but within SPEC scope?
    │   YES → Add to SPEC first (Edit tool → SPEC file)
    │       → Add corresponding scenario to Feature file
    │       → Then implement
    │
    └─ Outside SPEC scope?
        YES → Record as TODO and exclude from current scope
              .claude/vibe/todos/out-of-scope-{item}.md
```

**Required when changing SPEC:**

1. Update REQ-* IDs in SPEC file (add new requirements)
2. Add corresponding scenarios to Feature file
3. New REQ-* must be traceable in RTM after implementation

**Reverse direction also applies — when requirements change from code:**

```
Test failure → "Is this behavior correct?"
    │
    ├─ Check SPEC → If SPEC is correct, fix the code
    │
    └─ If SPEC is wrong → Fix SPEC first → Then fix code
        (Changing code without updating SPEC causes SPEC ↔ code drift)
```

**Extended Git commit rules:**

- SPEC changes and code changes must be in the same commit
- Committing feature code without SPEC changes → warning (except intentional refactoring)

### 2. Extract Scenario List

Extract all Scenarios from Feature file:

```markdown
## Scenarios to Implement

| # | Scenario | Status |
|---|----------|--------|
| 1 | Valid login success | ⬜ |
| 2 | Invalid password error | ⬜ |
| 3 | Email format validation | ⬜ |
| 4 | Password reset link | ⬜ |

Total: 4 scenarios
```

### 3. Scenario-by-Scenario Implementation (Core)

**For each scenario**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 1/4: Valid login success
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Given: User is registered
When: Login with valid email and password
Then: Login success + JWT token returned

[Step 1] Analyzing implementation...
  - Required files: auth.service.ts, login.controller.ts
  - Exploring related code...

[Step 2] Implementing...
  ✅ auth.service.ts - Added login() method
  ✅ login.controller.ts - POST /login endpoint

[Step 3] Verifying...
  ✅ Given: Test user creation possible
  ✅ When: Login API call succeeded
  ✅ Then: JWT token return confirmed

✅ Scenario 1 passed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**On failure**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 2/4: Invalid password error
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 3] Verifying...
  ✅ Given: Test user exists
  ✅ When: Login attempt with wrong password
  ❌ Then: "Invalid credentials" error message
     Actual: "Error occurred" returned

[Auto-fix 1/3]
  Cause: Error message not properly set
  Fix: auth.service.ts line 42

[Re-verify]
  ✅ Then: "Invalid credentials" error message

✅ Scenario 2 passed! (1 fix)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## **CRITICAL: Parallel Sub-Agent Execution**

> **MUST USE PARALLEL TASK CALLS** - This is REQUIRED, not optional.
> Sequential execution when parallel is possible = VIOLATION of this workflow.

### Codex 병렬 구현 (Codex 플러그인 활성화 시)

> **활성화 조건**: Codex 플러그인 설치 + 독립적인 시나리오 2개 이상
> 미설치 시 기존 Claude 서브에이전트 방식으로 동작.

독립적인 시나리오(파일 의존성 없음)를 Codex에 위임하여 Claude와 **병렬 구현**:

```
/codex:rescue "Implement scenario: {scenario-name}. Files: {file-list}. Requirements: {requirements-summary}" --background
```

- Claude는 다음 시나리오를 **동시에** 구현
- Codex 완료 시 `/codex:result`로 결과 확인
- 충돌 발생 시 Claude가 merge 판단

**위임 기준**:
- 시나리오 간 파일 의존성 없음 (독립적)
- 시나리오 복잡도 중간 이하
- 의존성 있는 시나리오는 Claude가 직접 구현

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
│  [If GPT enabled] Bash: node "[LLM_SCRIPT]" gpt-codex orchestrate-json "[question]"
│  [If Gemini enabled] Bash: node "[LLM_SCRIPT]" gemini orchestrate-json "[question]"
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

core ProjectCache (LRU) caches ts-morph parsing results. Parallel calls share the warmed cache.

### UI/UX Design Intelligence (Auto-triggered before Phase 1)

> **조건**: SPEC 또는 Feature에 UI/UX 키워드 포함 시 자동 실행
> **비활성화**: `.claude/vibe/config.json`에 `"uiUxAnalysis": false` 설정

**Phase 1 시작 전, 2개 에이전트 자동 실행:**

| Agent | Condition | Role |
|-------|-----------|------|
| ④ ui-stack-implementer | **항상 실행** | 프레임워크별 컴포넌트 가이드라인 제공 |
| ⑤ ui-dataviz-advisor | **조건부** (chart/dashboard/visualization 키워드) | 차트/시각화 라이브러리 추천 |

**실행 방법:**

```text
# ④ 항상 실행 (Haiku)
Task(subagent_type="ui-stack-implementer",
  prompt="Provide implementation guidelines for project '{project}' using {detected_stack}. Use core_ui_stack_search for framework-specific patterns.")

# ⑤ 조건부 실행 (Haiku) — SPEC에 차트/대시보드/시각화 키워드 포함 시
Task(subagent_type="ui-dataviz-advisor",
  prompt="Recommend data visualization approach for project '{project}'. Use core_ui_search for chart types and react-performance patterns.")
```

**디자인 시스템 자동 참조:**
- `.claude/vibe/design-system/{project}/MASTER.md` 존재 시 자동 로드
- 구현 에이전트가 CSS 변수, 폰트, 색상 팔레트를 직접 참조
- 페이지별 오버라이드 `pages/{page}.md` 존재 시 우선 적용

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

### Agent Teams — Dev Team

> **팀 정의**: `agents/teams/dev-team.md` 참조
> 설정: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `teammateMode: in-process` (`~/.claude/settings.json` 전역 — postinstall 자동 설정)

**활성화 조건 (Dev Team Full — 4명):**
- ULTRAWORK 모드 + 3개 이상 시나리오
- 또는 복잡도 점수 20+ (High)

### Agent Teams — Lite Team (Normal Mode)

> **팀 정의**: `agents/teams/lite-team.md` 참조

**활성화 조건 (Lite Team — 3명):**
- 일반 모드 + 3개 이상 시나리오
- 복잡도 점수 8-19 (Medium)
- 단순 구현(1-2 파일, 시나리오 2개 이하)에서는 기존 병렬 모드 유지

**팀 선택 기준:**

| 조건 | 팀 |
|------|-----|
| 시나리오 1-2개, 파일 1-2개 | 기존 병렬 모드 (팀 없음) |
| 시나리오 3개+, 일반 모드 | **Lite Team (3명)** |
| ULTRAWORK 또는 복잡도 20+ | Dev Team Full (4명) |

### Agent Teams — Review Team

> **팀 정의**: `agents/teams/review-debate-team.md` 참조

**활성화 조건:**

- `/vibe.review` 실행 후 P1 또는 P2 이슈 2개 이상 발견 시
- Agent Teams 환경변수 활성화 상태

### Agent Teams — Debug Team

> **팀 정의**: `agents/teams/debug-team.md` 참조

**활성화 조건:**

- 동일 빌드/테스트 실패 3회 이상
- UltraQA `architecture_question` 상태 진입 시

### Agent Teams — Research Team

> **팀 정의**: `agents/teams/research-team.md` 참조

**활성화 조건:**

- `/vibe.spec` Step 3 리서치 단계
- Agent Teams 환경변수 활성화 상태

### Agent Teams — Security Team

> **팀 정의**: `agents/teams/security-team.md` 참조

**활성화 조건:**

- auth, payment, user-data, crypto 관련 파일 변경 감지 시
- 또는 수동으로 `security` 키워드 지정 시

### Agent Teams — Migration Team

> **팀 정의**: `agents/teams/migration-team.md` 참조

**활성화 조건:**

- package.json 주요 의존성 버전 변경 감지 시
- 또는 수동으로 `migration` 키워드 지정 시

### Agent Teams — Fullstack Team

> **팀 정의**: `agents/teams/fullstack-team.md` 참조

**활성화 조건:**

- SPEC에 frontend + backend 파일이 모두 포함된 경우
- 또는 수동으로 `fullstack` 키워드 지정 시

---

1. **Related code analysis**: Task(haiku) explores `<context>` related code
2. **File creation/modification**: Task(sonnet) implements per `<output_format>`
3. **Constraint compliance**: Check `<constraints>`
4. **Run verification**: Execute verification commands

### 4. Brand Assets Generation (Optional)

When starting a **new project** with brand context in SPEC, auto-generate app icons and favicons:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 BRAND ASSETS GENERATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Check] Brand assets exist? → Skip if favicon.ico exists
[Check] Gemini API configured? → Required for image generation
[Check] SPEC has brand context? → Extract app name, colors, style

[Generate] Creating app icon with Gemini Image API...
  - Prompt: "App icon for [AppName], [style], [color]..."
  - Generated: 512x512 master icon

[Resize] Creating platform variants...
  ✅ favicon.ico (16/32/48)
  ✅ favicon-16x16.png
  ✅ favicon-32x32.png
  ✅ apple-touch-icon.png (180x180)
  ✅ android-chrome-192x192.png
  ✅ android-chrome-512x512.png
  ✅ site.webmanifest

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Brand assets generated in public/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**SPEC Brand Context Example:**

```xml
<context>
Brand:
  - App Name: MyApp
  - Primary Color: #2F6BFF
  - Style: Modern, minimalist, flat design
  - Icon Concept: Abstract geometric shape
</context>
```

**Trigger Conditions:**
- First `/vibe.run` execution (no existing icons)
- SPEC contains brand/design context
- Gemini API key configured (`vibe gemini key <key>`)

**Manual Generation:**
```bash
# [LLM_SCRIPT] = {{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js
node "[LLM_SCRIPT]" gemini image "App icon for MyApp, primary color #2F6BFF, square format 1:1, simple recognizable design, works well at small sizes, no text or letters, solid or gradient background, modern minimalist" --output "./public/app-icon.png"
```

---

### 5. Race Code Review (GPT + Gemini) + Auto-Fix (v2.6.9)

After all scenarios are implemented, **GPT and Gemini review in parallel with cross-validation**:

> **ULTRAWORK Default**: In ULTRAWORK mode, race review is automatically enabled.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 RACE CODE REVIEW (GPT + Gemini)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] Parallel review execution...
  ├─ GPT Codex: Reviewing...
  └─ Gemini: Reviewing...

[Step 2] Cross-validation results:
  ┌──────────────────────────────────────────────────────────────────┐
  │ Issue                          │ GPT │ Gemini │ Codex │ Confidence│
  │────────────────────────────────│─────│────────│───────│───────────│
  │ Timing attack in password      │ ✅  │ ✅     │ ✅    │ 100% → P1 │
  │ Rate limiting missing          │ ✅  │ ✅     │ ✅    │ 100% → P1 │
  │ Magic number usage             │ ✅  │ ❌     │ ❌    │ 50% → P2  │
  └──────────────────────────────────────────────────────────────────┘

  Summary: 3 issues (P1: 2, P2: 1)

[Step 3] Auto-fixing P1/P2 issues...
  ✅ auth.service.ts:24 - Applied timingSafeEqual (P1)
  ✅ auth.controller.ts:15 - Added rate limiter (P1)
  ✅ auth.service.ts:42 - Extracted constant (P2)

[Step 4] Re-verifying...
  ✅ Build succeeded
  ✅ Tests passed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Race review complete! 3 improvements (2 P1, 1 P2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Race Review Invocation (GPT + Gemini in parallel via Bash):**

**🚨 Use --input file to avoid CLI argument length limits and Windows pipe issues.**

1. Save code to review into `[SCRATCHPAD]/review-code.txt` (using Write tool)
2. Write JSON input file `[SCRATCHPAD]/review-input.json` (using Write tool):
   - `{"prompt": "Review this code for security, performance, and best practices. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. Code: [CODE_CONTENT]"}`
   - Where `[CODE_CONTENT]` is the code text (properly JSON-escaped inside the prompt string)
3. Script path: `[LLM_SCRIPT]` = `{{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js`
4. Run GPT + Gemini in PARALLEL (two Bash tool calls at once):

```bash
# GPT review (Bash tool call 1)
node "[LLM_SCRIPT]" gpt orchestrate-json --input "[SCRATCHPAD]/review-input.json"
```

```bash
# Gemini review (Bash tool call 2 - run in parallel)
node "[LLM_SCRIPT]" gemini orchestrate-json --input "[SCRATCHPAD]/review-input.json"
```

**Confidence-based Priority:**

| Confidence | Priority | Action |
|------------|----------|--------|
| 100% (3/3 or 2/2) | P1 | Auto-fix immediately |
| 67% (2/3) | P1 | Auto-fix immediately |
| 50% (1/2) or 33% (1/3) | P2 | Auto-fix with review |

**Fallback handling:**
- If one LLM fails → Use remaining LLM results (reduced confidence)
- If all fail → Skip and proceed (log warning)

**Review application rules:**

| Feedback Type | Action |
|---------------|--------|
| Security vulnerability (P1) | Auto-fix immediately |
| Performance improvement (P1/P2) | Auto-fix immediately |
| Best practices (P2) | Auto-fix |
| Style/preference (P3) | Apply selectively |

**Conditions:**
- **ULTRAWORK**: Race review enabled by default
- **Normal mode**: Use `--race` flag to enable
- Must re-verify build/tests after fixes

### Codex Code Review (Codex 플러그인 활성화 시)

GPT+Gemini race와 **동시에** Codex review 실행:

```
/codex:review
```

결과를 race review 교차 검증에 포함 — 3중 리뷰:

```markdown
| Issue | GPT | Gemini | Codex | Confidence |
|-------|-----|--------|-------|------------|
| {이슈} | ✅/❌ | ✅/❌ | ✅/❌ | {%} |
```

### 6. Quality Report (Auto-generated)

After all scenarios complete + Gemini review, **quality report is auto-generated**:

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 QUALITY REPORT: login                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Scenarios: 4/4 passed                                       │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ # │ Scenario                  │ Status │ Retries │        │  │
│  │───│───────────────────────────│────────│─────────│        │  │
│  │ 1 │ Valid login success       │ ✅     │ 0       │        │  │
│  │ 2 │ Invalid password error    │ ✅     │ 1       │        │  │
│  │ 3 │ Email format validation   │ ✅     │ 0       │        │  │
│  │ 4 │ Password reset link       │ ✅     │ 0       │        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📈 Quality score: 94/100                                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Item              │ Result │ Notes                       │    │
│  │───────────────────│────────│─────────────────────────────│    │
│  │ Build             │ ✅     │ npm run build succeeded     │    │
│  │ Tests             │ ✅     │ 12/12 passed                │    │
│  │ Type check        │ ✅     │ 0 errors                    │    │
│  │ Complexity        │ ✅     │ All functions ≤30 lines     │    │
│  │ Security          │ ✅     │ 0 vulnerabilities           │    │
│  │ Race review       │ ✅     │ 3 improvements applied      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ⏱️ Started: {start_time}                                        │
│  ⏱️ Completed: {getCurrentTime 결과}                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**What users should check**:
- Scenario pass rate (4/4 = 100%)
- Quality score (94/100)
- Build/test status

**This alone is enough to trust quality.**

### 7. Update Feature File

Auto-update scenario status:

```markdown
## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| Valid login success | AC-1 | ✅ |
| Invalid password error | AC-2 | ✅ |
| Email format validation | AC-3 | ✅ |
| Password reset link | AC-4 | ✅ |

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
| 1 | Valid login success | ⬜ |
| 2 | Invalid password error | ⬜ |
| 3 | Email format validation | ⬜ |
| 4 | Password reset link | ⬜ |

Total: 4 scenarios

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 1/4: Valid login success
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Given: User is registered
When: Login with valid email and password
Then: Login success + JWT token returned

⚡ [PARALLEL] Exploring...
✅ Exploration complete (2.1s)

🔨 Implementing...
  ✅ auth.service.ts - Added login()
  ✅ auth.controller.ts - POST /login

🔍 Verifying...
  ✅ Given: OK
  ✅ When: OK
  ✅ Then: OK

✅ Scenario 1 passed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 2/4: Invalid password error
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔨 Implementing...
  ✅ auth.service.ts - Password validation logic

🔍 Verifying...
  ✅ Given: OK
  ✅ When: OK
  ❌ Then: "Invalid credentials" error message
     Actual: "Error" returned

🔄 Auto-fix 1/3...
  Fix: auth.service.ts line 42

🔍 Re-verifying...
  ✅ Then: OK

✅ Scenario 2 passed! (1 fix)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 3/4: Email format validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔨 Implementing...
🔍 Verifying...
✅ Scenario 3 passed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 4/4: Password reset link
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔨 Implementing...
🔍 Verifying...
✅ Scenario 4 passed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 GEMINI CODE REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 Sending code to Gemini...
📝 Gemini feedback:
  1. [Security] Need timing attack prevention → Fixing...
  2. [Performance] Unnecessary DB call → Fixing...

✅ 2 improvements auto-applied
🔍 Re-verifying... ✅ Passed

┌─────────────────────────────────────────────────────────────────┐
│  📊 QUALITY REPORT: login                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Scenarios: 4/4 passed                                       │
│                                                                 │
│  | # | Scenario              | Status | Retries |               │
│  |---|───────────────────────|───────|─────────|               │
│  | 1 | Valid login success   | ✅    | 0       |               │
│  | 2 | Invalid password error| ✅    | 1       |               │
│  | 3 | Email format validation| ✅   | 0       |               │
│  | 4 | Password reset link   | ✅    | 0       |               │
│                                                                 │
│  📈 Quality score: 94/100                                       │
│  Build: ✅ | Tests: ✅ | Types: ✅ | Gemini: ✅ (2 applied)     │
│                                                                 │
│  ⏱️ Started: {start_time}                                        │
│  ⏱️ Completed: {getCurrentTime 결과}                             │
└─────────────────────────────────────────────────────────────────┘

🎉 Implementation complete! All scenarios passed + Gemini review applied.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 AUTO REVIEW (13+ Agents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ [PARALLEL] 13 expert agents reviewing...
  - security-reviewer ✅
  - performance-reviewer ✅
  - architecture-reviewer ✅
  - ...

📋 Review results:
  - P1 Critical: 0
  - P2 Important: 2
  - P3 Nice-to-have: 1

🔧 Auto-fixing P2 issues...
  1. [PERF] N+1 query → Fixed
  2. [ARCH] Circular dependency → Fixed

✅ Auto Review complete! 2 issues auto-resolved.
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

---

## Quality Gate (Mandatory)

### Implementation Quality Checklist

Before marking any scenario as complete, ALL items must pass:

| Category | Check Item | Weight |
|----------|------------|--------|
| **Functionality** | All Given/When/Then conditions verified | 20% |
| **Functionality** | Edge cases handled per scenario | 10% |
| **Code Quality** | No `any` types in TypeScript | 10% |
| **Code Quality** | Functions ≤30 lines, nesting ≤3 levels | 10% |
| **Code Quality** | No hardcoded values (use constants) | 5% |
| **Security** | Input validation implemented | 10% |
| **Security** | Authentication/authorization checked | 5% |
| **Error Handling** | Try-catch or error states present | 10% |
| **Error Handling** | User-friendly error messages | 5% |
| **Testing** | Unit tests exist for core logic | 10% |
| **Performance** | No N+1 queries or unnecessary loops | 5% |

### Quality Score Calculation

```
Score = Σ(checked items × weight) / 100

Grades:
- 95-100: ✅ EXCELLENT - Ready to merge
- 90-94:  ⚠️ GOOD - Minor improvements required before merge
- 80-89:  ⚠️ FAIR - Significant improvements required
- 0-79:   ❌ POOR - Major fixes needed
```

### Quality Gate Thresholds

| Gate | Minimum Score | Condition |
|------|---------------|-----------|
| **Scenario Complete** | 95 | Each scenario must score ≥95 |
| **Phase Complete** | 95 | Average of all scenarios ≥95 |
| **Feature Complete** | 95 | All phases complete + Gemini review |

### Auto-Fix Triggers

| Issue Type | Auto-Fix Action |
|------------|-----------------|
| Missing error handling | Add try-catch wrapper |
| Hardcoded values | Extract to constants file |
| Missing input validation | Add validation schema |
| Function too long | Suggest split points |
| N+1 query detected | Add eager loading |

### Auto-Fix 실패 시 Codex Rescue (Codex 플러그인 활성화 시)

P1 auto-fix가 **3회 실패** 시, Codex에 위임:

```
/codex:rescue "Fix P1 issue: {issue-description}. File: {file-path}. Error: {error-message}"
```

Codex 수정 완료 후 재검증. Codex도 실패 시 TODO 파일에 기록.

### Forbidden Patterns (Block Merge)

| Pattern | Why Forbidden | Detection |
|---------|---------------|-----------|
| `console.log` | Debug code in production | Regex scan |
| `// TODO` without issue | Untracked work | Comment scan |
| `any` type | Type safety bypass | TypeScript check |
| `@ts-ignore` | Type error suppression | TypeScript check |
| Empty catch blocks | Silent error swallowing | AST analysis |
| Commented-out code | Dead code | Comment scan |

---

## Auto-Retrospective (Post-Implementation)

After ALL phases complete successfully, **automatically** perform a brief retrospective:

### Retrospective Template

```
## Retrospective: {feature-name}

### What Worked
- [List effective patterns, tools, approaches used]

### What Didn't
- [List issues, failures, unexpected blockers]

### Key Decisions
- [Important architectural or implementation decisions made during this run]

### Lessons Learned
- [Principle format: "When X, do Y because Z"]
```

### Execution Steps

1. Generate retrospective based on the implementation session
2. Save to `.claude/vibe/retros/{feature-name}.md`
3. Save key lessons via `core_save_memory` (for cross-session recall)
4. Update `claude-progress.txt` with final status

**Important:**

- Keep it concise (under 20 lines)
- Focus on **project-specific** insights, not generic knowledge
- Only save to memory if the lesson is actionable and non-obvious

---

## Next Step

```
/vibe.verify "brick-game"
```

---

ARGUMENTS: $ARGUMENTS
