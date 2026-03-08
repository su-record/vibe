---
description: Verify implementation against SPEC requirements
argument-hint: "feature name"
---

# /vibe.verify

**Automated Quality Verification** - Making quality trustworthy even for non-developers.

> All scenarios passed = Quality assured

## Usage

```
/vibe.verify "feature-name"              # SPEC-based verification
/vibe.verify --e2e "feature-name"        # E2E browser test (agents/e2e-tester.md)
/vibe.verify --e2e --visual              # Visual regression test
/vibe.verify --e2e --record              # Video recording
```

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## File Reading Policy (Mandatory)

- **SPEC/Feature 파일**: 반드시 `Read` 도구로 전체 파일을 읽을 것 (Grep 금지)
- **소스코드 파일**: 검증 대상 파일은 반드시 `Read` 도구로 전체 읽은 후 검증할 것
- **Grep 사용 제한**: 파일 위치 탐색(어떤 파일에 있는지 찾기)에만 사용. 파일 내용 파악에는 반드시 Read 사용
- **시나리오 검증 시**: Given/When/Then 각 단계의 구현 코드를 Read로 전체 읽어 확인할 것. Grep 매칭만으로 "구현됨"이라 판단 금지
- **부분 읽기 금지**: Grep 결과의 주변 몇 줄만 보고 판단하지 말 것. 전체 맥락을 파악해야 정확한 검증 가능

## Core Principles

```
┌─────────────────────────────────────────────────────────────────┐
│  What non-developers need to know                               │
│                                                                 │
│  ✅ Scenarios: 4/4 passed                                       │
│  📈 Quality Score: 94/100                                       │
│                                                                 │
│  Just look at this. The system handles the rest.                │
└─────────────────────────────────────────────────────────────────┘
```

## Process

### 1. Load Feature File

**Search order (check BOTH file AND folder):**

```
Step 1: Check if SPLIT structure exists (folder)
  📁 .claude/vibe/features/{feature-name}/     → Folder with _index.feature + phase files
  📁 .claude/vibe/specs/{feature-name}/         → Folder with _index.md + phase files

Step 2: If no folder, check single file
  📄 .claude/vibe/features/{feature-name}.feature → Single Feature file
  📄 .claude/vibe/specs/{feature-name}.md         → Single SPEC file

Step 3: If neither exists → Error
```

**Split structure (folder) detected:**
```
📁 .claude/vibe/features/{feature-name}/
├── _index.feature         → Master Feature (read first for scenario overview)
├── phase-1-{name}.feature → Phase 1 scenarios
├── phase-2-{name}.feature → Phase 2 scenarios
└── ...

📁 .claude/vibe/specs/{feature-name}/
├── _index.md              → Master SPEC (read first for overview)
├── phase-1-{name}.md      → Phase 1 SPEC
└── ...

→ Load _index files first, then verify phase by phase
```

**Single file detected:**
```
📄 .claude/vibe/features/{feature-name}.feature → Scenario list
📄 .claude/vibe/specs/{feature-name}.md → Verification criteria (reference)
```

**Error if NEITHER file NOR folder found:**
```
❌ Feature file not found. Searched:
   - .claude/vibe/features/{feature-name}/  (folder)
   - .claude/vibe/features/{feature-name}.feature (file)

   Run /vibe.spec "{feature-name}" first.
```

### 2. Scenario-by-Scenario Verification

Automatic verification for each scenario:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Scenario 1/4: Valid login success
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Given: User is registered
  → Verify: User creation API exists? ✅
  → Verify: Test user data available? ✅

When: Login with valid email and password
  → Verify: POST /login endpoint exists? ✅
  → Verify: Request handling logic exists? ✅

Then: Login success + JWT token returned
  → Verify: Success response code 200? ✅
  → Verify: JWT token included? ✅

✅ Scenario 1 passed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. Verification Methods (Auto-selected)

| Method | Condition | Verification Content |
|--------|-----------|---------------------|
| **Test Execution** | When test files exist | Run `npm test`, `pytest`, etc. |
| **Code Analysis** | Always | Check implementation, verify logic |
| **Build Verification** | When build script exists | Check for compile errors |
| **Type Check** | TypeScript, etc. | Check for type errors |
| **E2E Closed Loop** | `--e2e` flag or UI scenarios | Browser-based verification (see below) |

### 3.1. E2E Closed Loop Verification (`--e2e`)

**AI가 직접 브라우저를 조작하여 시나리오를 검증하고, 실패 시 자동 수정 후 재검증한다.**

```
구현 → E2E 검증 → 실패 → 수정 → 재검증 → ... → 통과
       ↑_____________________________________↓
       Closed Loop: 사람 개입 없이 AI가 완주
```

**Browser Tool Priority (토큰 효율 순):**

| Priority | Tool | 토큰/액션 | 사용 조건 |
|----------|------|----------|----------|
| 1st | Agent Browser (접근성 트리) | ~6-20 chars | MCP 사용 가능 시 |
| 2nd | Playwright Test Runner | pass/fail만 | 테스트 코드 실행 |
| 3rd | Playwright MCP (DOM) | ~12,000+ chars | 최후 수단 |

**Closed Loop 실행 흐름:**

```
For each UI scenario in Feature file:
  1. [Browser] Navigate → Find elements → Interact → Assert
  2. PASS → Next scenario
  3. FAIL → Collect evidence (screenshot, console errors)
       → Root cause analysis
       → Fix code (Read full file first, then edit)
       → Re-run ONLY failed scenario (max 3 retries)
  4. 3x FAIL → Report as manual fix needed
```

**핵심 원칙: 검증이 가벼워야 루프가 충분히 돈다.**
- 접근성 트리 기반: `button "Sign In"` = 15 chars
- DOM 기반: `div class="nav-wrapper mx-4 flex..."` = 200+ chars
- 전자를 사용해야 시나리오 50개도 한 세션에서 검증 가능

### 4. Quality Report (Auto-generated)

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 VERIFICATION REPORT: login                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Scenarios: 4/4 passed (100%)                                │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ # │ Scenario              │ Given │ When │ Then │ Status │  │
│  │───│───────────────────────│───────│──────│──────│────────│  │
│  │ 1 │ Valid login success   │ ✅    │ ✅   │ ✅   │ ✅     │  │
│  │ 2 │ Invalid password error│ ✅    │ ✅   │ ✅   │ ✅     │  │
│  │ 3 │ Email format validation│ ✅   │ ✅   │ ✅   │ ✅     │  │
│  │ 4 │ Forgot password link  │ ✅    │ ✅   │ ✅   │ ✅     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📈 Quality Score: 94/100                                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Item              │ Result│ Details                     │    │
│  │───────────────────│───────│─────────────────────────────│    │
│  │ Build             │ ✅    │ Success                     │    │
│  │ Tests             │ ✅    │ 12/12 passed                │    │
│  │ Type Check        │ ✅    │ 0 errors                    │    │
│  │ Complexity        │ ✅    │ All functions ≤30 lines     │    │
│  │ Code Coverage     │ ⚠️    │ 78% (target: 80%)           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  📋 Recommendations:                                             │
│  - Need 2% more code coverage (auth.service.ts line 45-52)      │
│                                                                 │
│  ⏱️ Started: {start_time}                                        │
│  ⏱️ Completed: {getCurrentTime 결과}                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Failure Report

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 VERIFICATION REPORT: login                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ❌ Scenarios: 3/4 passed (75%)                                 │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ # │ Scenario              │ Given │ When │ Then │ Status │  │
│  │───│───────────────────────│───────│──────│──────│────────│  │
│  │ 1 │ Valid login success   │ ✅    │ ✅   │ ✅   │ ✅     │  │
│  │ 2 │ Invalid password error│ ✅    │ ✅   │ ✅   │ ✅     │  │
│  │ 3 │ Email format validation│ ✅   │ ✅   │ ✅   │ ✅     │  │
│  │ 4 │ Forgot password link  │ ✅    │ ❌   │ -    │ ❌     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ❌ Failure Details:                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  Scenario 4: Forgot password link                               │
│                                                                 │
│  When: Click "Forgot password"                                  │
│  ❌ Issue: Link not implemented                                 │
│  📍 Location: LoginForm.tsx line 42                             │
│  💡 Fix: Need to add "Forgot password" link                     │
│                                                                 │
│  🔧 Auto-fix command: /vibe.run "login" --fix                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Input

- `.claude/vibe/features/{feature-name}.feature` or `.claude/vibe/features/{feature-name}/` - BDD scenarios
- `.claude/vibe/specs/{feature-name}.md` or `.claude/vibe/specs/{feature-name}/` - SPEC document (reference)
- Implemented source code

## Output

- Verification result report (terminal output)
- Passed/failed scenario list
- Items needing fixes

## Example

```
User: /vibe.verify "login"

Claude:
📄 Loading Feature: .claude/vibe/features/login.feature
🔍 Starting verification...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Scenario 1/4: Valid login success
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Given: User registered - OK
  ✅ When: Login attempt - OK
  ✅ Then: JWT token returned - OK
✅ Passed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Scenario 2/4: Invalid password error
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Given: OK
  ✅ When: OK
  ✅ Then: OK
✅ Passed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Scenario 3/4: Email format validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Given: OK
  ✅ When: OK
  ✅ Then: OK
✅ Passed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Scenario 4/4: Forgot password link
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Given: OK
  ❌ When: "Forgot password" link - missing
  - Then: (skipped)
❌ Failed!

┌─────────────────────────────────────────────────────────────────┐
│  📊 VERIFICATION REPORT: login                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ❌ Scenarios: 3/4 passed (75%)                                 │
│                                                                 │
│  | # | Scenario              | Status |                         │
│  |---|───────────────────────|────────|                         │
│  | 1 | Valid login success   | ✅     |                         │
│  | 2 | Invalid password error| ✅     |                         │
│  | 3 | Email format validation| ✅    |                         │
│  | 4 | Forgot password link  | ❌     |                         │
│                                                                 │
│  📈 Quality Score: 75/100                                       │
│                                                                 │
│  ❌ Fixes needed:                                                │
│  - Scenario 4: Add "Forgot password" link in LoginForm.tsx      │
│                                                                 │
│  🔧 Auto-fix: /vibe.run "login" --fix                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Tools (Code Analysis & Quality)

### Tool Invocation

All tools are called via:

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Recommended Tools for Verification

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `validateCodeQuality` | Code quality validation | Check complexity, style violations |
| `analyzeComplexity` | Complexity analysis | Verify function length, nesting depth |
| `findSymbol` | Find implementations | Verify feature implementation exists |
| `findReferences` | Find usages | Check if all references are correct |

### Example Tool Usage in Verification

**1. Validate code quality:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.validateCodeQuality({targetPath: 'src/auth/', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**2. Analyze complexity of implementation:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.analyzeComplexity({targetPath: 'src/auth/login.ts', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**3. Find implemented feature:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.findSymbol({symbolName: 'handleLogin', searchPath: 'src/'}).then(r => console.log(r.content[0].text)))"
```

## Next Step

On verification pass:

```
Complete! Proceed to next feature.
```

On verification fail:

```
/vibe.run "feature-name" --fix  # Fix failed scenarios
```

---

## Quality Gate (Mandatory)

### Verification Quality Checklist

Before marking verification complete, ALL items must pass:

| Category | Check Item | Weight |
|----------|------------|--------|
| **Scenario Coverage** | All scenarios from feature file tested | 25% |
| **Given Verification** | All preconditions validated | 15% |
| **When Verification** | All actions executable | 15% |
| **Then Verification** | All expected outcomes confirmed | 20% |
| **Build Status** | Project builds without errors | 10% |
| **Test Status** | All existing tests pass | 10% |
| **Type Check** | No TypeScript/type errors | 5% |

### Verification Score Calculation

```
Score = (passed_scenarios / total_scenarios) × 100

Grades:
- 100%:   ✅ PERFECT - All scenarios pass
- 90-99%: ⚠️ ALMOST - Minor gaps, review needed
- 70-89%: ❌ INCOMPLETE - Significant gaps
- 0-69%:  ❌ FAILED - Major implementation missing
```

### Pass/Fail Criteria

| Metric | Pass Threshold | Action on Fail |
|--------|----------------|----------------|
| Scenario pass rate | 100% | Run `/vibe.run --fix` |
| Build status | Success | Fix build errors first |
| Test pass rate | 100% | Fix failing tests |
| Type check | 0 errors | Fix type errors |

### Verification Methods Matrix

| Method | Trigger Condition | What It Checks |
|--------|-------------------|----------------|
| **Code Analysis** | Always | Implementation exists |
| **Test Execution** | Test files exist | Logic correctness |
| **Build Verification** | Build script exists | Compilation success |
| **Type Check** | tsconfig.json exists | Type safety |
| **Lint Check** | ESLint config exists | Code style |

### Scenario Verification Depth

For each scenario, verify at THREE levels:

| Level | Verification | Example |
|-------|--------------|---------|
| **L1: Existence** | Code/function exists | `login()` function defined |
| **L2: Logic** | Implementation is correct | Validates email format |
| **L3: Integration** | Works with other components | Returns valid JWT |

### Auto-Fix Triggers

| Verification Failure | Auto-Fix Action |
|----------------------|-----------------|
| Missing implementation | Generate skeleton from scenario |
| Test failure | Analyze and suggest fix |
| Build error | Show error location |
| Type error | Suggest type annotations |

### Verification Report Requirements

Every verification MUST produce:

1. **Scenario Summary Table**
   - Scenario name
   - Given/When/Then status (✅/❌)
   - Overall status

2. **Quality Metrics**
   - Build status
   - Test pass count
   - Type error count
   - Code coverage percentage

3. **Failure Details** (if any)
   - Exact failure point (Given/When/Then)
   - Expected vs actual
   - File path and line number
   - Suggested fix command

4. **Recommendations**
   - Specific files to modify
   - Auto-fix command if available

---

ARGUMENTS: $ARGUMENTS
