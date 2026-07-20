---
name: vibe.trace
description: Generate and display Requirements Traceability Matrix (RTM) — REQ → SPEC → Feature → Code 관계 추적
argument-hint: "feature-name [--html] [--save]"
user-invocable: true
---

# /vibe.trace

Generate and display Requirements Traceability Matrix (RTM).

## Usage

```bash
/vibe.trace "feature-name"              # Generate RTM for feature
/vibe.trace "feature-name" --html       # Output as HTML
/vibe.trace "feature-name" --save       # Save to file
```

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## Description

Requirements Traceability Matrix (RTM) tracks the relationship between:
- **Requirements** (REQ-xxx-xxx)
- **SPEC sections** (Phase tasks)
- **Feature scenarios** (BDD)
- **Test files** (unit/integration tests)

## Process

### 1. Load Files

**Search order (check BOTH file AND folder):**

```
Step 1: Check if SPLIT structure exists (folder)
  📁 .vibe/specs/{feature-name}/        → Folder with _index.md + phase files
  📁 .vibe/features/{feature-name}/      → Folder with _index.feature + phase files

Step 2: If no folder, check single file
  📄 .vibe/specs/{feature-name}.md       → Single SPEC file
  📄 .vibe/features/{feature-name}.feature → Single Feature file

Step 3: If neither exists → Error
```

**Split structure (folder) detected:**
```
📁 .vibe/specs/{feature-name}/
├── _index.md              → Master SPEC (read first)
├── phase-1-{name}.md      → Phase 1 SPEC
└── ...

📁 .vibe/features/{feature-name}/
├── _index.feature         → Master Feature (read first)
├── phase-1-{name}.feature → Phase 1 scenarios
└── ...

→ Load all phase files, generate RTM across all phases
```

**Single file detected:**
```
📄 .vibe/specs/{feature-name}.md      → SPEC
📄 .vibe/features/{feature-name}.feature → Feature
```

**Additional (auto-detect):**
```
📄 src/**/*.test.ts                           → Tests (auto-detect)
```

**Error if NEITHER file NOR folder found:**
```
❌ SPEC not found. Searched:
   - .vibe/specs/{feature-name}/  (folder)
   - .vibe/specs/{feature-name}.md (file)

   Run /vibe.spec "{feature-name}" first.
```

### 2. Extract Mappings

For each requirement ID (REQ-xxx-xxx):
1. Find corresponding SPEC section
2. Find matching Feature scenario
3. Find related test file

### 3. Calculate Coverage

```
Coverage = (Full coverage items / Total requirements) × 100%

Full coverage = Has SPEC + Feature + Test
Partial = Missing one or more
None = Only in SPEC
```

### 4. Output RTM

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 REQUIREMENTS TRACEABILITY MATRIX: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Summary
| Metric            | Value    |
|-------------------|----------|
| Total Requirements| 10       |
| SPEC Coverage     | 10/10    |
| Feature Coverage  | 8/10     |
| Test Coverage     | 6/10     |
| **Overall**       | **60%**  |

## Traceability Matrix

| Requirement | SPEC | Feature | Test | Coverage |
|-------------|------|---------|------|----------|
| REQ-login-001 | ✅ Phase 1 | ✅ Scenario 1 | ✅ login.test.ts | ✅ Full |
| REQ-login-002 | ✅ Phase 1 | ✅ Scenario 2 | ❌ | ⚠️ Partial |
| REQ-login-003 | ✅ Phase 2 | ❌ | ❌ | ❌ None |

## Uncovered Requirements

The following requirements lack full coverage:

- **REQ-login-002**: Password validation
  - Missing: Test file

- **REQ-login-003**: Remember me functionality
  - Missing: Feature scenario, Test file

## Recommendations

⚠️ Coverage is at 60%. Consider:
- Add Feature scenarios for uncovered requirements
- Add test cases for uncovered requirements

⏱️ Started: {start_time}
⏱️ Completed: {getCurrentTime 결과}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Example

```
User: /vibe.trace "login"

Claude:
📊 Generating RTM for "login"...

Loading files:
  ✅ SPEC: .vibe/specs/login.md (5 requirements)
  ✅ Feature: .vibe/features/login.feature (4 scenarios)
  ✅ Tests: 3 test files found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 REQUIREMENTS TRACEABILITY MATRIX: login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Summary
| Metric            | Value    |
|-------------------|----------|
| Total Requirements| 5        |
| SPEC Coverage     | 5/5      |
| Feature Coverage  | 4/5      |
| Test Coverage     | 3/5      |
| **Overall**       | **60%**  |

## Traceability Matrix

| Requirement | SPEC | Feature | Test | Coverage |
|-------------|------|---------|------|----------|
| REQ-login-001 | ✅ | ✅ | ✅ | ✅ Full |
| REQ-login-002 | ✅ | ✅ | ✅ | ✅ Full |
| REQ-login-003 | ✅ | ✅ | ✅ | ✅ Full |
| REQ-login-004 | ✅ | ✅ | ❌ | ⚠️ Partial |
| REQ-login-005 | ✅ | ❌ | ❌ | ❌ None |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Tool Integration

The RTM generation uses core tools:

```bash
# Generate RTM (generateTraceabilityMatrix is synchronous — no .then())
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => { const m = t.generateTraceabilityMatrix('login', {projectPath: process.cwd()}); console.log(t.formatMatrixAsMarkdown(m)); })"

# Generate HTML
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => { const m = t.generateTraceabilityMatrix('login', {projectPath: process.cwd()}); console.log(t.formatMatrixAsHtml(m)); })"
```

> **Note:** Default SPEC path is `.vibe/specs/<feature>.md` (falls back to `.claude/vibe/specs/` then `.claude/specs/` for legacy projects).
> `status === 'empty'` means the gate MUST be treated as failed/not-applicable, never as 100% pass.

## Post-Trace Gates

After `/vibe.trace` completes and the RTM is displayed, two downstream mechanisms consume the result.

### Empty-result gate

`generateTraceabilityMatrix` returns `status: 'empty'` when no `REQ-<feature>-NNN` IDs are found in the SPEC. This state **must be treated as a gate failure**, not as 100% coverage. When the matrix status is `empty`, report it explicitly and do not proceed as if the feature is verified.

```
RTM status === 'empty'
  → Coverage gate: FAILED (no requirements to trace)
  → Action: run /vibe.spec to add REQ-IDs before re-running /vibe.trace
```

### Run-ledger flow

`/vibe.verify` records its outcome through `hooks/scripts/verify-ledger.js`, binding the current run ID and command-result evidence. This writes `verifyPassed` and `verifyAt` into `.vibe/metrics/run-ledger.json`. Downstream gates consume this record:

| Gate | Behavior |
|------|----------|
| `auto-commit` | Commits only when `verifyPassed === true` AND `verifyAt > runStarted` |
| Stop hook | Warns when `runStarted && !verifyPassed`; blocks once if `verifyGate.mode === 'block'` |

**To register a passing trace as verified**, run `/vibe.verify` after `/vibe.trace` reports acceptable coverage. The verify skill records the current run ID and command evidence internally — you do not invoke the ledger CLI manually.

```
/vibe.trace "login"         → RTM: 9/9 (100%)
/vibe.verify "login"        → runs checks → records pass + run ID + command results
                            → .vibe/metrics/run-ledger.json updated
auto-commit / Stop gate     → verifyPassed=true, gate clears
```

If `/vibe.verify` is skipped, `auto-commit` will log the skip reason and abort the commit.

## Options

| Option | Description |
|--------|-------------|
| `--html` | Output as HTML file |
| `--save` | Save to `.vibe/reports/{feature}-rtm.md` |
| `--json` | Output as JSON |

## Coverage Targets

| Coverage Level | Status |
|----------------|--------|
| 90-100% | ✅ Excellent - Ready for release |
| 70-89% | ⚠️ Good - Minor gaps |
| 50-69% | ⚠️ Fair - Significant gaps |
| 0-49% | ❌ Poor - Major gaps |

---

## `.last-feature` 포인터 삭제 (워크플로 완주)

```
/vibe.trace가 정상 완료되면 (RTM 출력 + 사용자 확인 후):
  Delete ".vibe/.last-feature"

이유: /vibe.trace는 vibe 워크플로의 마지막 Phase (Phase 7).
     완주 후에는 다음 /vibe.spec 호출 시 "빈 시작" 또는 진행 중 목록에서 다른 feature를 시작해야 한다.
     삭제하지 않으면 완료된 feature가 계속 "이어서?" 로 뜬다.

예외:
  - /vibe.trace가 에러로 중단된 경우 → 삭제하지 않음 (재시도 가능)
  - --save 또는 --html 플래그와 무관하게 항상 삭제
```

---

ARGUMENTS: {feature-name}
