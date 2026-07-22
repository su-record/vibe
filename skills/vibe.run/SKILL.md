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
Load skill `vibe.regress` with: list --feature "{feature-name}"
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

**Stakes 프로파일 (SSOT: `vibe/rules/loop-contract.md` Stakes 표):**
- `demo`/`prototype` → max_iterations 1, 리뷰 1패스, **검증 스크립트 신규 생성 금지** — 검증은 기존 테스트 러너·브라우저 게이트만 사용한다. 새 verify_*.py / 검증 전용 스크립트 파일을 만들지 않는다.
- JUDGE 검증 산출물 절제 (모든 stakes): 이번 feature 신규 검증 코드 바이트 합이 신규 구현 코드 바이트 합을 초과하면 (`git diff --numstat` 기준) P2 경고를 run-ledger 에 기록한다. advisory — 게이트 통과 여부는 불변.

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

### 1-0. Compile + validate execution packet (MANDATORY)

For a monolithic SPEC, compile it after resolving the canonical path. For a split SPEC, do not compile `_index.md`; defer this step until each active phase file is loaded in Phase Isolation Step B. Compile with `writeExecutionPacket`, then immediately verify the saved artifact with `validateExecutionPacket`.

```bash
node -e "import('file://{{VIBE_PATH}}/dist/tools/index.js').then(t => {
  const projectPath=process.cwd(), specPath='.vibe/specs/{feature-name}.md';
  const profile='{codex-or-claude-code}';
  const written=t.writeExecutionPacket({projectPath,specPath,profile});
  if(!written.ok){console.error(JSON.stringify(written.errors));process.exit(1)}
  const checked=t.validateExecutionPacket({projectPath,specPath,packetPath:written.packetPath});
  if(!checked.valid){console.error(checked.code);process.exit(1)}
  console.log(written.packetPath);
})"
```

- Codex uses profile `codex`; Claude Code uses `claude-code`.
- Split SPECs compile each active `phase-N-*.md` immediately before that phase runs; `_index.md` remains the overview ANCHOR and is not treated as a phase contract.
- Use the packet only when validation returns `valid: true`.
- `STALE_PACKET`, invalid packet, preservation-audit failure, or budget failure is blocking: recompile from the canonical SPEC and never silently fall back to an unvalidated packet.
- The packet is a derived execution view. The canonical SPEC remains the ANCHOR and source of truth.

### 1-1. Phase Isolation Protocol (Large SPEC Guard, MANDATORY for 3+ phases)

```
Step A: Read _index.md (overview only — phase list, REQ IDs)
Step B: For each Phase N:
  1. RE-READ Phase N SPEC section (every time, no memory)
  2. Compile + validate Phase N execution packet using the phase file path
  3. RE-READ Phase N Feature scenarios
  4. Extract Phase N scope: files, scenarios, requirements
  5. Implement Phase N scenarios
  6. Verify Phase N
  7. Write Phase Checkpoint → .vibe/checkpoints/
  8. DISCARD Phase N details from working memory
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

## Bundled internal: arch-guard


# Arch Guard — Architecture Boundary Test Generator

> **Principle**: "Mechanical enforcement over documentation." If a rule exists only in docs, it will be violated. Turn architecture constraints into failing tests.

## When to Use

| Scenario | Signal |
|----------|--------|
| `vibe init` / `vibe update` | Auto-generate for detected stack |
| New layer/module added | Boundaries need enforcement |
| Architecture violation found in review | Prevent recurrence with test |
| "Services should not import UI" type rules | Turn into automated check |

## Core Flow

```
DETECT → INFER → GENERATE → VERIFY
```

### Step 1: DETECT — Identify Project Architecture

Analyze the project to determine its layer structure:

```
Parallel exploration:
- Agent 1: Scan directory structure (src/, app/, lib/, etc.)
- Agent 2: Read existing architecture docs (CLAUDE.md, README, ADR)
- Agent 3: Analyze import graph (which files import what)
```

**Common patterns to detect:**

| Pattern | Layers | Typical Stacks |
|---------|--------|----------------|
| MVC | Controller → Service → Model | Rails, NestJS, Spring |
| Clean Architecture | UI → Application → Domain → Infrastructure | General |
| Feature-based | Feature A ↛ Feature B internals | Next.js, React |
| Hexagonal | Adapters → Ports → Domain | DDD projects |
| Component hierarchy | Page → Feature → Shared → UI Primitives | Frontend |

### Step 2: INFER — Define Boundary Rules

From detected structure, generate rules:

```typescript
// Rule format
interface ArchRule {
  name: string;           // "service-no-ui-import"
  from: string;           // Glob pattern: "src/services/**"
  cannotImport: string[]; // ["src/components/**", "src/pages/**"]
  canImport: string[];    // ["src/models/**", "src/utils/**"]
  reason: string;         // "Services must be UI-agnostic"
}
```

**Default rules by stack:**

| Stack | Rule |
|-------|------|
| Next.js / React | `components/` cannot import from `pages/` or `app/` |
| Next.js / React | `lib/` cannot import from `components/` |
| NestJS | `*.service.ts` cannot import from `*.controller.ts` |
| NestJS | `*.module.ts` is the only valid cross-boundary import |
| General TS | `src/domain/` cannot import from `src/infra/` |
| General TS | No circular dependencies between top-level dirs |
| Python Django | `models.py` cannot import from `views.py` |
| Python FastAPI | `schemas/` cannot import from `routers/` |

### Step 3: GENERATE — Create Test File

Output: `tests/arch-guard.test.ts` (or equivalent for stack)

```typescript
/**
 * Architecture Boundary Tests
 * Generated by arch-guard skill
 *
 * These tests enforce architectural constraints mechanically.
 * If a test fails, it means an import violates the intended architecture.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Helper: extract imports from a file
function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

// Helper: resolve relative import to absolute path
function resolveImport(fromFile: string, importPath: string): string {
  if (importPath.startsWith('.')) {
    return path.resolve(path.dirname(fromFile), importPath);
  }
  return importPath; // external package
}

// Helper: glob files matching pattern
function globFiles(pattern: string, baseDir: string): string[] {
  // Use fast-glob or manual recursive scan
  // Implementation depends on available dependencies
}

describe('Architecture Boundaries', () => {
  // GENERATED RULES GO HERE
  // Each rule becomes a test case:

  it('services cannot import UI components', () => {
    const serviceFiles = globFiles('src/services/**/*.ts', process.cwd());
    const violations: string[] = [];

    for (const file of serviceFiles) {
      const imports = extractImports(file);
      for (const imp of imports) {
        const resolved = resolveImport(file, imp);
        if (resolved.includes('/components/') || resolved.includes('/pages/')) {
          violations.push(`${file} imports ${imp}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
```

### Step 4: VERIFY — Run and Fix

1. Run the generated tests: `npx vitest run tests/arch-guard.test.ts`
2. If violations found:
   - Report each violation with file:line
   - Suggest fix (move shared code to appropriate layer)
   - Do NOT auto-fix — violations need human review

## Output Files

| File | Purpose |
|------|---------|
| `tests/arch-guard.test.ts` | Executable boundary tests |
| `.vibe/arch-rules.json` | Machine-readable rules (for CI) |

## Customization

Users can add custom rules to `.vibe/arch-rules.json`:

```json
{
  "rules": [
    {
      "name": "no-direct-db-in-handlers",
      "from": "src/handlers/**",
      "cannotImport": ["src/db/**"],
      "reason": "Handlers must use services, not direct DB access"
    }
  ]
}
```

The test generator reads this file and adds custom rules to the test suite.

## Integration

- `vibe init` → auto-detect and generate initial arch-guard tests
- `vibe update` → refresh rules if directory structure changed
- Pre-commit hook → run arch-guard tests before commit
- `vibe.review` (skill) → code-reviewer (focus: architecture) checks against arch-rules.json

## Bundled internal: exec-plan


# ExecPlan — Self-Contained Execution Plan Generator

> **Principle**: "If the agent can't see it, it doesn't exist." Every decision, file path, pattern, and verification step must be explicit in the plan — no implicit knowledge allowed.

## When to Use

Before `/vibe.run`, generate an ExecPlan to make execution deterministic:

| Scenario | Signal |
|----------|--------|
| Complex SPEC (3+ phases) | Agent needs long autonomous execution |
| Team/multi-agent execution | Multiple agents need shared understanding |
| Context window pressure | Plan survives `/new` session handoff |
| Unfamiliar codebase | Agent can't rely on implicit knowledge |

## Core Flow

```
SPEC + Feature → ANALYZE → RESOLVE → GENERATE → PERSIST
```

### Step 1: ANALYZE — Extract Everything Needed

Read the SPEC and Feature files, then extract:

```
For each Phase → For each Scenario:
  1. Requirements (REQ-* IDs)
  2. Given/When/Then conditions
  3. Affected files (MUST exist — verify with Glob)
  4. Dependencies (imports, packages)
  5. Existing patterns to follow (read actual code, don't assume)
```

**Parallel exploration** (3+ agents):
- Agent 1: Map all file paths mentioned/implied in SPEC → verify they exist
- Agent 2: For each affected file, extract current interfaces/types/exports
- Agent 3: Find existing patterns (naming conventions, error handling, test structure)

### Step 2: RESOLVE — Eliminate All Ambiguity

For every decision point in the SPEC, resolve it NOW:

| Ambiguity | Resolution |
|-----------|------------|
| "Add validation" | → Which fields? What rules? What error messages? |
| "Handle errors" | → Which error codes? What response format? |
| "Follow existing pattern" | → Copy the ACTUAL pattern code into the plan |
| "Update tests" | → Which test file? What test framework? What assertions? |

**Rule**: If you'd need to "figure it out later", resolve it now. The plan must be executable by an agent with ZERO codebase knowledge.

### Step 3: GENERATE — Write the ExecPlan

Output format: `.vibe/specs/{feature-name}-execplan.md`

```markdown
# ExecPlan: {feature-name}

## Meta
- SPEC: .vibe/specs/{name}.md
- Feature: .vibe/features/{name}.feature
- Generated: {timestamp}
- Phases: {count}
- Scenarios: {count}

## Pre-flight Checks
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes (baseline)
- [ ] Required files exist: {list}

## Phase {N}: {phase-name}

### Environment
- Files to modify: {exact paths}
- Files to create: {exact paths}
- Dependencies to add: {package@version}
- Patterns to follow: (inline code snippets from codebase)

### Scenario {N}.{M}: {scenario-name}

**Given**: {precondition}
→ Setup: {exact code/commands to establish precondition}

**When**: {action}
→ Implement: {step-by-step implementation instructions}
  - File: {path}
  - Location: after line containing `{anchor text}`
  - Code: (inline snippet)
  - Imports needed: {list}

**Then**: {expected result}
→ Verify:
  - Command: `{test command}`
  - Expected: {output/behavior}
  - Fallback: {what to do if verification fails}

### Phase {N} Gate
- [ ] Build: `npm run build`
- [ ] Tests: `npx vitest run {relevant-test-files}`
- [ ] Type check: `npx tsc --noEmit`

## Completion Criteria
- Coverage threshold: ≥95%
- All scenarios passing
- No regressions in existing tests
- RTM: `generateTraceabilityMatrix("{feature-name}")`
```

### Step 4: PERSIST — Save and Link

1. Save ExecPlan to `.vibe/specs/{feature-name}-execplan.md`
2. Save session context: `save_memory("execplan-{feature}", {summary})`
3. Output execution command:

```
Ready to execute:
  /vibe.run "{feature-name}" ultrawork

Or hand off to new session:
  /vibe.continue
  → Load: .vibe/specs/{feature-name}-execplan.md
```

## Quality Checks

| Check | Criteria |
|-------|----------|
| No implicit knowledge | Every file path verified with Glob |
| No "figure it out" | Every decision resolved with actual code |
| Survives handoff | Plan readable without any prior context |
| Inline patterns | Actual code snippets, not "follow existing pattern" |
| Verification steps | Every scenario has a concrete verification command |

## Anti-patterns

- "See the existing implementation" → Copy the relevant code inline
- "Follow the pattern in X" → Show the actual pattern
- "Standard error handling" → Specify exact error codes and messages
- "Update tests accordingly" → Name the test file, framework, and assertions

## Bundled internal: restraint


# Restraint — Don't Write It, Don't Tune It (Yet)

Two constraints, one gate:

- **No premature code.** New abstractions must be *pulled* by a demonstrated
  need, never pushed by "might need it later." Once the code exists, deleting
  it costs more than never writing it.
- **No premature optimization.** Performance work must be *pulled* by a
  measurement, never by a hunch.

## The YAGNI Ladder (code axis)

Satisfy the need at the **highest** rung that covers it; lower rungs are
blocked while a higher one applies:

1. **Not needed** — the requirement doesn't ask for it → don't build it
2. **Stdlib / built-ins** already do it (`crypto`, `Intl`, `pathlib`, …)
3. **Native platform feature** does it (`<input type="date">`, CSS `:has()`, DB constraints)
4. **Already-installed dependency** covers it — check the lockfile, don't guess
5. **One line** — a single expression; no new file, no class
6. **Minimal code** — only now, and nothing for "later"

Tie-break: native beats a one-liner; stdlib beats a dependency. Generalize
only when a *second* caller exists.

## Pike's Rules (optimization axis)

- You can't tell where a program spends its time — bottlenecks surprise.
  **Measure; don't guess.**
- Don't tune until one part *measurably* overwhelms the rest.
- Fancy algorithms are slow when n is small — and n is usually small.
  Ask "what's n?" before "what's the Big-O?"
- Simple algorithms + the right data structures beat clever code. Data dominates.

Optimization is justified only when ALL hold: a measured bottleneck exists →
it dominates runtime → the fix is the simplest change addressing it → you
re-measure after.

## Blocked Impulses

| Impulse | Constraint | Counter |
|---|---|---|
| helper / utility / wrapper / manager class | rungs 1–5 | a stdlib call or one line usually suffices |
| config system for one value | rung 1 | a `const` is the config |
| generic `Processor(strategy, validator…)` | rung 1 | one concrete function until a second caller exists |
| "add a cache here" / "parallelize this" | measure first | is this path even hot? Often it's I/O |
| swap in a B-tree / trie / skip list | what's n? | O(n²) with n=100 is microseconds |
| "this loop looks slow" | measure first | the bottleneck is probably elsewhere |

## Overrides — Restraint Never Erodes These

1. **Security and trust-boundary work are requirements**, not optional
   complexity. Input validation, auth checks, escaping stay in — "one line"
   is no excuse to drop them.
2. **Deliberate simplifications get a comment + upgrade path**, so the next
   reader sees a *choice*, not an oversight:

   ```ts
   // Global lock is enough at current throughput.
   // Switch to per-account locking if write contention shows up.
   const lock = new Mutex();
   ```
