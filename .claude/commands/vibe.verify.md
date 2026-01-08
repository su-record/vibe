---
description: Verify implementation against SPEC requirements
argument-hint: "feature name"
---

# /vibe.verify

Verify implementation based on Feature scenarios.

## Usage

```
/vibe.verify "feature-name"
```

## Rules Reference

**Must follow `.vibe/rules/`:**
- `quality/checklist.md` - Code quality checklist
- `standards/complexity-metrics.md` - Complexity standards

## Process

### 1. Load Feature File

Read `.vibe/features/{feature-name}.feature`

### 2. Verify by Scenario

For each Scenario:

1. **Given** (Precondition) - Check state
2. **When** (Action) - Execute feature
3. **Then** (Result) - Verify expected result

### 3. Verification Methods

**Code verification:**
- Check if feature is implemented
- Verify Given/When/Then steps work

**Test execution (if available):**
- Run `npm test`, `pytest`, `flutter test`, etc.
- Check BDD test framework results

**Manual verification:**
- If no test code, verify via code review
- Check if each scenario's logic is implemented

### 4. Result Report

```markdown
# Verification Report: {feature-name}

## Summary
- **Total Scenarios**: N
- **Passed**: N ✅
- **Failed**: N ❌
- **Quality Score**: XX/100

## Scenario Results

### ✅ Scenario 1: {title}
- Given: Verified
- When: Implemented
- Then: Works
- **Verification**: AC-1 satisfied

### ❌ Scenario 2: {title}
- Given: Verified
- When: Implemented
- Then: **Failed** - {reason}
- **Fix needed**: {specific details}

## Code Quality
- Complexity: ✅ Appropriate
- Test Coverage: XX%
- Error Handling: ✅

## Next Steps
- {How to fix failed scenarios}
```

## Input

- `.vibe/features/{feature-name}.feature` - BDD scenarios
- `.vibe/specs/{feature-name}.md` - SPEC document (reference)
- Implemented source code

## Output

- Verification result report (terminal output)
- Passed/failed scenario list
- Items needing fixes

## Example

```
User: /vibe.verify "login"

Claude:
# Verification Report: login

## Summary
- **Total Scenarios**: 4
- **Passed**: 3 ✅
- **Failed**: 1 ❌
- **Quality Score**: 85/100

## Scenario Results

### ✅ Scenario 1: Login with valid credentials
- Given: User is on login page → ✅ LoginPage component exists
- When: Enter valid email/password → ✅ handleSubmit implemented
- Then: Redirect to dashboard → ✅ router.push('/dashboard')

### ✅ Scenario 2: Login with wrong password
- Given: Login page → ✅
- When: Wrong password → ✅
- Then: Show error message → ✅ "Password does not match"

### ✅ Scenario 3: Email format validation
- Given: Login page → ✅
- When: Invalid email format → ✅
- Then: Validation error → ✅ zod validation

### ❌ Scenario 4: Forgot password link
- Given: Login page → ✅
- When: Click "Forgot password" → ❌ Link missing
- Then: Navigate to forgot password page → ❌

## Next Steps
Scenario 4 fix needed:
- Add "Forgot password" link to LoginPage
- Implement /forgot-password route
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

ARGUMENTS: $ARGUMENTS
