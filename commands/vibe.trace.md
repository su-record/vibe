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
├── _index.md              → Master SPEC (read first)
├── phase-1-{name}.md      → Phase 1 SPEC
└── ...

📁 .claude/vibe/features/{feature-name}/
├── _index.feature         → Master Feature (read first)
├── phase-1-{name}.feature → Phase 1 scenarios
└── ...

→ Load all phase files, generate RTM across all phases
```

**Single file detected:**
```
📄 .claude/vibe/specs/{feature-name}.md      → SPEC
📄 .claude/vibe/features/{feature-name}.feature → Feature
```

**Additional (auto-detect):**
```
📄 src/**/*.test.ts                           → Tests (auto-detect)
```

**Error if NEITHER file NOR folder found:**
```
❌ SPEC not found. Searched:
   - .claude/vibe/specs/{feature-name}/  (folder)
   - .claude/vibe/specs/{feature-name}.md (file)

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
  ✅ SPEC: .claude/vibe/specs/login.md (5 requirements)
  ✅ Feature: .claude/vibe/features/login.feature (4 scenarios)
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
# Generate RTM
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.generateTraceabilityMatrix('login').then(m => console.log(t.formatMatrixAsMarkdown(m))))"

# Generate HTML
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.generateTraceabilityMatrix('login').then(m => console.log(t.formatMatrixAsHtml(m))))"
```

## VerificationLoop Integration

`/vibe.trace` results feed directly into the **VerificationLoop** module, which quantifies achievement rate and drives automatic re-iteration.

### Key Functions

| Function | Purpose |
|----------|---------|
| `createLoop(feature, config?)` | Initialize a new verification loop for a feature |
| `recordVerification(state, requirements)` | Record RTM results and determine next action |
| `formatVerificationResult(result, config)` | Format a single iteration result for display |
| `formatLoopSummary(state)` | Format the full loop history as readable text |
| `getUnmetRequirements(result)` | Extract failed/partial requirements for targeted fixing |
| `isImproving(state)` | Detect whether achievement rate is increasing across iterations |

### Loop Configuration

```
threshold:      90    — Minimum achievement rate (%) to pass (default)
maxIterations:  3     — Max re-verification attempts before stopping
autoRetry:      false — Whether to auto-trigger re-implementation
```

### Action Types

After each `recordVerification` call, the loop returns one of:

| Action | Condition | Meaning |
|--------|-----------|---------|
| `passed` | rate >= threshold | All requirements met — done |
| `retry` | rate < threshold AND iterations remaining | Fix unmet requirements and re-run |
| `max_iterations` | rate < threshold AND no iterations left | Report remaining gaps as TODO |

### Convergence Detection

If the achievement rate does not improve between iterations (`isImproving` returns false), the loop stops early to avoid wasted cycles.

### Example Flow

```
/vibe.trace "login"
  → RTM generated: 7/9 requirements covered (78%)
  → createLoop("login", { threshold: 90, maxIterations: 3 })
  → recordVerification(...) → action: retry (iteration 1, 3 unmet)
  → [fix unmet requirements]
  → /vibe.trace "login"
  → recordVerification(...) → action: passed (rate: 100%)
  → formatVerificationResult → display final report
```

## Options

| Option | Description |
|--------|-------------|
| `--html` | Output as HTML file |
| `--save` | Save to `.claude/vibe/reports/{feature}-rtm.md` |
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
  Delete ".claude/vibe/.last-feature"

이유: /vibe.trace는 vibe 워크플로의 마지막 Phase (Phase 7).
     완주 후에는 다음 /vibe.spec 호출 시 "빈 시작" 또는 진행 중 목록에서 다른 feature를 시작해야 한다.
     삭제하지 않으면 완료된 feature가 계속 "이어서?" 로 뜬다.

예외:
  - /vibe.trace가 에러로 중단된 경우 → 삭제하지 않음 (재시도 가능)
  - --save 또는 --html 플래그와 무관하게 항상 삭제
```

---

ARGUMENTS: {feature-name}
