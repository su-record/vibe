---
name: vibe.run
description: Execute implementation from SPEC
argument-hint: '"feature name" or --phase N'
user-invocable: true
---

# /vibe.run

Execute **Scenario-Driven Implementation** with automatic quality verification.

> **Core Principle**: Scenarios are both the implementation unit and verification criteria. All scenarios passing = Quality guaranteed.

## Usage

```
/vibe.run "feature-name"              # Full implementation (loops to convergence)
/vibe.run "feature-name" --phase 1    # Specific Phase only
/vibe.run "feature-name" --interactive  # Step-by-step confirmation per iteration
/vibe.run "feature-name" --max-iter 1   # Single-pass (no loop)
/vibe.run "feature-name" ultrawork    # deprecated alias: automationLevel autonomous + parallel
/vibe.run "feature-name" ulw          # deprecated alias: same as ultrawork
```

---

> **Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

> **Step Counter Reset (MANDATORY at START)**: Run this Bash command once at the very start:
>
> ```bash
> mkdir -p .vibe/metrics && printf '{"feature":"%s","startedAt":"%s","steps":0}\n' "{feature-name}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .vibe/metrics/current-run.json
> ```

## File Reading Policy (Mandatory)

- **SPEC/Feature 파일**: 반드시 `Read` 도구로 전체 파일을 읽을 것 (Grep 금지)
- **소스코드 파일**: 구현/수정 대상 파일은 반드시 `Read` 도구로 전체 읽은 후 작업할 것
- **Grep 사용 제한**: 파일 위치 탐색(어떤 파일에 있는지 찾기)에만 사용. 파일 내용 파악에는 반드시 Read 사용
- **에이전트 spawn 시**: 프롬프트에 "대상 파일을 Read 도구로 전체 읽은 후 구현하라"를 반드시 포함할 것

## **Scenario-Driven Development (SDD)**

> Automate **Scenario = Implementation = Verification** so even non-developers can trust quality

### Pre-Run Regression Check (MANDATORY, before implementation starts)

```
Load skill `regress` with: list --feature "{feature-name}"
```

- Open regressions exist → automationLevel confirm: ask user; autonomous: auto-invoke `/vibe.regress generate <slug>`
- No open regressions → silently continue

Also load `.vibe/contracts/{feature-name}.md` if present — use it as the contract reference during implementation.

### DESIGN.md Gate (UI stack only, before Phase 1)

```bash
test -f DESIGN.md
```

- **DESIGN.md present OR no UI stack** → silently continue
- **DESIGN.md absent AND UI stack present**:
  - automationLevel confirm: 한 줄 안내 — "UI 작업에 `DESIGN.md` 시각 SSOT 가 없습니다. `/vibe.design init` 으로 생성하면 시각 드리프트가 자동 검출됩니다. (생략 가능 — 1 회만 안내)"
  - automationLevel autonomous: 무음 스킵

> **권유 > 강제**. DESIGN.md 부재는 절대 vibe.run 을 블록하지 않는다.

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
│   │   [Implement] → [Verify immediately] → Pass               │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario 2: Edge Case                                     │  │
│   │   [Implement] → [Verify] → Fail → [Fix] → Pass            │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   [Quality Report: Scenarios N/N passed]                        │
└─────────────────────────────────────────────────────────────────┘
```

> **하네스-안전 증분 (Dual-Harness Doctrine)**: 시나리오는 **가장 작은 검증 단위**다. 한 시나리오 구현 → 즉시 검증 → 다음. `automationLevel: autonomous`이라도 이 단위는 무너뜨리지 않는다 (병렬은 시나리오 간, 검증은 시나리오별). 전문: `vibe/rules/principles/dual-harness-doctrine.md`.

### Automated Verification (Closed Loop)

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

Browser Tool Priority:

| Priority | Tool | 용도 |
|----------|------|------|
| 1st | Agent Browser (접근성 트리) | AI 직접 조작, 최소 토큰 |
| 2nd | Playwright Test Runner | 테스트 코드 실행, pass/fail 반환 |
| 3rd | Playwright MCP (DOM) | 최후 수단, 토큰 비효율 |

**활성화 조건:** Feature 파일에 UI 관련 시나리오 존재 + `.vibe/e2e/config.json`의 `closedLoop.enabled: true` (기본값) + dev server가 실행 중

### Auto-Fix on Failure

```
Scenario verification failed
      ↓ [Collect evidence]
      ↓ [Root cause analysis]
      ↓ [Read target file FULLY]
      ↓ [Implement fix]
      ↓ [Re-verify failed scenario only]
      Repeat until pass (stuck 감지로 종료)
```

**Termination conditions (loop-contract JUDGE):**
- PASS → 다음 scenario
- stuck (같은 failure가 이전 라운드와 동일, `loop-ledger.js check-stuck`) → automationLevel confirm: 사용자 질문; autonomous: TODO + next scenario

---

## **ULTRAWORK Mode** (ulw) — deprecated alias

> 루프 시맨틱은 `vibe/rules/loop-contract.md`를 따른다. `ultrawork`/`ulw`는 `automationLevel: autonomous` + 병렬 ACT의 deprecated 별칭이다.
> 전체 Boulder Loop 다이어그램, automation level 정의, confirmation matrix: `references/ultrawork-mode.md`

`ultrawork` 또는 `ulw` 포함 시 vibe.run-specific 동작:
- 병렬 탐색 (3+ Task agents 동시)
- 비대화형 (중단점 없음)
- Race Review (GPT+Antigravity) 기본 활성화
- stuck 시 TODO 기록 후 다음 시나리오로 (사용자 질문 없음)

---

## Scope & Ledger Rules

### Run Ledger Tracking

Every `/vibe.run` invocation is automatically recorded in `.vibe/metrics/run-ledger.json` (fields: `runStarted`, `runFeature`, `verifyPassed`, `verifyAt`). The `verifyPassed` flag is reset to `false` at run start and only set to `true` when `/vibe.verify` completes and records its result via `verify-ledger.js`. If the session ends without running `/vibe.verify`, the Stop hook will emit a warning to stderr; if `verifyGate.mode` is set to `"block"` in `.vibe/config.json`, the first Stop event will be blocked (once per run, loop-prevention flag prevents repeated blocking). The auto-commit hook also skips the commit unless `verifyPassed === true` and `verifyAt > runStarted`.

### Interactive Checkpoints

Checkpoints are decision gates inserted at critical points. At L3/L4, most are **auto-resolved** using the default option.

| Type | When It Fires | Default Option |
|------|--------------|----------------|
| `requirements_confirm` | Before starting Phase 1 | Confirm (a) |
| `architecture_choice` | When architecture approach is ambiguous | Clean/balanced (b) |
| `implementation_scope` | Before any large scope change (6+ files) | Approve (a) |
| `fix_strategy` | When critical issues are found during quality gate | Fix all (a) |

Checkpoint format example:
```
──────────────────────────────────────────────────
CHECKPOINT: Requirements Confirmation
──────────────────────────────────────────────────
Options:
  a) Confirm — Proceed as stated.
  b) Revise — Modify before proceeding.
  c) Abort — Cancel.
Default: a
──────────────────────────────────────────────────
```

---

## Process

### 1. Load SPEC + Feature

**Search order:**
```
Step 1: Check split structure (folder)
  .vibe/specs/{feature-name}/        → Folder: _index.md + phase files
  .vibe/features/{feature-name}/     → Folder: _index.feature + phase files

Step 2: If no folder, check single file
  .vibe/specs/{feature-name}.md
  .vibe/features/{feature-name}.feature

Step 3: If neither → Error: "Run /vibe.spec first"
```

**Split structure:** Load `_index.md` first, then phase files in order. Execute phases sequentially (or per `--phase` flag).

### 1-1. Phase Isolation Protocol (Large SPEC Guard, MANDATORY for 3+ phases)

```
Step A: Read _index.md (overview only — phase list, REQ IDs)
Step B: For each Phase N:
  1. RE-READ Phase N SPEC section (every time, no memory)
  2. RE-READ Phase N Feature scenarios
  3. Extract Phase N scope: files, scenarios, requirements
  4. Implement Phase N scenarios
  5. Verify Phase N
  6. Write Phase Checkpoint → .vibe/checkpoints/
  7. DISCARD Phase N details from working memory
Step C: Next Phase
```

**Phase Checkpoint** (`.vibe/checkpoints/{feature}-phase-{N}.md`):

```markdown
# Checkpoint: {feature} Phase {N}

## Completed
- Scenario 1: {name} ✅

## Files Changed
- src/auth.service.ts (added login(), validateToken())

## State for Next Phase
- Auth service exports: login(), logout(), validateToken()

## Remaining Phases
- Phase {N+1}: {name} — {scenario count} scenarios
```

**SPEC Re-anchoring (Before EVERY scenario):** Re-read the EXACT Given/When/Then from Feature file (not from memory). Compare: "Am I implementing what the SPEC says, or what I think it says?"

**Scope Lock (Per Phase):**

```
At Phase start, declare:
  MODIFY: [list of files this phase will touch]
  CREATE: [list of files this phase will create]
  DO NOT TOUCH: everything else
```

**Context Pressure:**

| Context Level | Action |
|---------------|--------|
| < 50% | Normal execution |
| 50-85% | Save checkpoint, trim exploration results |
| 85%+ | Save checkpoint → `/new` → resume from checkpoint |
| Phase boundary | Always save checkpoint |

### 1-2. SPEC-First Gate

> SPEC is the source of truth for code. To modify code, update the SPEC first.

```
Discovery: "An API endpoint not in SPEC is needed"
    ├─ Already in SPEC? YES → Implement
    ├─ Not in SPEC but within scope? → Add to SPEC + Feature → Implement
    └─ Outside scope? → TODO in .vibe/todos/out-of-scope-{item}.md
```

SPEC changes and code changes must be in the **same commit**.

### 2. Extract Scenario List

```markdown
| # | Scenario | Status |
|---|----------|--------|
| 1 | Valid login success | ⬜ |
| 2 | Invalid password error | ⬜ |
```

### 3. Scenario-by-Scenario Implementation

> Read `references/parallel-agents.md` for full parallel exploration patterns, background agents, parallel subagent group selection, and model routing.

**For each scenario:**
1. [Parallel exploration] Task(haiku) × 3 — related code, deps, patterns
2. [Implement] Write/edit the minimum required code
3. [Verify] Check Given/When/Then; E2E if UI scenario
4. [Auto-fix loop] On failure: collect evidence → root cause → fix → re-verify

**UI/UX Design Intelligence (auto-triggered before Phase 1 if UI keywords in SPEC):**
- Task(haiku, `design-system-gen`): framework-specific component guidelines + chart/viz library advice (viz advice conditional on chart keywords)
- Load `.vibe/design-system/{project}/MASTER.md` if present

### 4. Brand Assets (New project only)

> Read `references/brand-assets.md` when SPEC contains brand context and this is the first run.

Trigger conditions: first run (no favicon.ico) + SPEC has brand context + Antigravity API key configured.

### 5. Race Code Review

> Read `references/race-review.md` for full Race Review invocation, confidence matrix, and quality gate thresholds.

After all scenarios: GPT + Antigravity review in parallel. ULTRAWORK enables this by default.

### 6. Quality Report (Auto-generated)

```
┌─────────────────────────────────────────────────────────────────┐
│  QUALITY REPORT: {feature}                                       │
├─────────────────────────────────────────────────────────────────┤
│  Scenarios: N/N passed                                          │
│  Quality score: 94/100                                          │
│  Build: ✅ | Tests: ✅ | Types: ✅ | Race review: ✅             │
│  Started: {start_time}  Completed: {getCurrentTime}             │
└─────────────────────────────────────────────────────────────────┘
```

### 7. Update Feature File

Auto-update scenario status with `Last verified` timestamp and quality score.

### 8. Coverage Verification Loop (RTM)

> 루프 시맨틱은 `vibe/rules/loop-contract.md`를 따른다. 여기서의 exit 기준은 `coveragePercent === 100`. RTM 다이어그램, 출력 형식, 반복 규칙: `references/ralph-loop.md`

After ALL phases complete:

```bash
# generateTraceabilityMatrix is synchronous — no .then()
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => { const r = t.generateTraceabilityMatrix('{feature-name}', {projectPath: process.cwd()}); console.log(JSON.stringify(r, null, 2)); })"
```

> Default SPEC path is `.vibe/specs/<feature>.md`. `status === 'empty'` must be treated as failed/not-applicable — never as 100% pass.

JUDGE: `coveragePercent === 100` → 루프 종료. stuck(연속 2회 동일 커버리지) → automationLevel confirm이면 사용자 질문; autonomous이면 TODO + done.

---

## Core Tools (Semantic Analysis & Memory)

```bash
# All tools via:
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

| Tool | Purpose |
|------|---------|
| `findSymbol` | Find symbol definitions |
| `findReferences` | Find all references |
| `analyzeComplexity` | Analyze code complexity |
| `validateCodeQuality` | Validate code quality |
| `saveMemory` | Save important decisions |
| `recallMemory` | Recall saved memory |
| `listMemories` | List all memories |

Session management: start hook auto-calls `startSession`; context 80%+ triggers `autoSaveContext`.

---

## Coding Guidelines (Mandatory)

> Read `references/race-review.md` for full type safety guidelines, language-specific examples, and the type-violation detection/escalation table.

**TypeScript — core rule:**
```typescript
// BAD
function process(data: any): any { return data.foo; }

// GOOD
function process(data: unknown): Result {
  if (isValidData(data)) return data.foo;
  throw new Error('Invalid');
}
```

No `any` / `as any` / `@ts-ignore` — fix at root. Explicit return types on all functions.

**Detection outcome:** Type violations are detected by static analysis and injected as `additionalContext`; commit-level enforcement occurs at the auto-commit verify gate.

---

## Rules Reference

- `core/development-philosophy.md` — Surgical precision, modify only requested scope
- `core/quick-start.md` — Korean, DRY, SRP, YAGNI
- `standards/complexity-metrics.md` — Functions ≤50 lines, nesting ≤3 levels
- `quality/checklist.md` — Code quality checklist
- Language guide: `~/.claude/vibe/languages/{stack}.md`

---

## TRUST 5 Principles

| Principle | Description |
|-----------|-------------|
| **T**est-first | Write tests first |
| **R**eadable | Clear code |
| **U**nified | Consistent style |
| **S**ecured | Consider security |
| **T**rackable | Logging, monitoring |

---

## Auto-Retrospective (Post-Implementation)

After ALL phases complete, save to `.vibe/retros/{feature-name}.md`:

```markdown
## Retrospective: {feature-name}
### What Worked / What Didn't / Key Decisions / Lessons Learned
```

Keep under 20 lines. Save key lessons via `core_save_memory`. Update `claude-progress.txt`.

---

## Input / Output

**Input:** `.vibe/specs/{feature-name}.md`, `.vibe/features/{feature-name}.feature`, `CLAUDE.md`

**Output:** Implemented code files, test files, updated SPEC (checkmarks)

---

## Next Step

```
/vibe.verify "feature-name"
```

---

ARGUMENTS: $ARGUMENTS
