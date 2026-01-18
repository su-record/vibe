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

```
📄 .claude/vibe/features/{feature-name}.feature → Scenario list
📄 .claude/vibe/specs/{feature-name}.md → Verification criteria (reference)
```

**If feature file does not exist**:
```
❌ Feature file not found.
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

- `.claude/vibe/features/{feature-name}.feature` - BDD scenarios
- `.claude/vibe/specs/{feature-name}.md` - SPEC document (reference)
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

## Vibe Tools (Code Analysis & Quality)

### Tool Invocation

All tools are called via:

```bash
node -e "import('@su-record/vibe/tools').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
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
node -e "import('@su-record/vibe/tools').then(t => t.validateCodeQuality({targetPath: 'src/auth/', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**2. Analyze complexity of implementation:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.analyzeComplexity({targetPath: 'src/auth/login.ts', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**3. Find implemented feature:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.findSymbol({symbolName: 'handleLogin', searchPath: 'src/'}).then(r => console.log(r.content[0].text)))"
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
