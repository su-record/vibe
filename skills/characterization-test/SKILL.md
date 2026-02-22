---
name: characterization-test
description: "Lock existing behavior with characterization tests before modifying code."
triggers: [legacy, characterization test, lock behavior, regression prevention, before refactor, large file]
priority: 65
---

# Characterization Test Skill

> **Philosophy: "Never change what you cannot verify"**

Lock existing behavior with snapshot/characterization tests before modifying code. This prevents regressions in legacy, complex, or unfamiliar codebases.

## When to Use

| Scenario | Signal |
|----------|--------|
| Legacy file (>500 lines) | Large files with accumulated behavior |
| Complex branching | Multiple if/else, switch, ternary chains |
| API endpoint modification | Request/response contract must be preserved |
| Database schema change | Migration must preserve existing data semantics |
| Refactoring request | "refactor", "clean up", "simplify" keywords |
| Unfamiliar code | No prior context about the module |

## Core Workflow

```
ANALYZE → GENERATE → VERIFY → CHANGE → REGRESS → RECONCILE
```

### Step 1: ANALYZE

Explore the target code to understand its current behavior.

**Parallel exploration** (use sub-agents when available):
- Read the target file(s)
- Identify all public exports / API surface
- Map branching paths (if/else, switch, try/catch)
- List external dependencies and side effects
- Check for existing tests

**Analysis checklist:**
- [ ] All public functions identified
- [ ] Input parameter ranges documented
- [ ] Edge cases listed (null, empty, boundary values)
- [ ] Side effects cataloged (DB writes, file I/O, network calls)
- [ ] Error paths mapped

### Step 2: GENERATE

Create characterization tests that capture current behavior as-is.

**TypeScript template:**
```typescript
import { describe, it, expect } from 'vitest';

describe('[ModuleName] characterization tests', () => {
  // Happy path - capture normal behavior
  it('should [describe current behavior]', () => {
    const result = targetFunction(normalInput);
    // Snapshot the ACTUAL output, not what you THINK it should be
    expect(result).toMatchSnapshot();
  });

  // Edge cases - capture boundary behavior
  it('should handle empty input', () => {
    const result = targetFunction('');
    expect(result).toMatchSnapshot();
  });

  // Error paths - capture failure modes
  it('should handle invalid input', () => {
    expect(() => targetFunction(null)).toThrowErrorMatchingSnapshot();
  });
});
```

**Python template:**
```python
import pytest

class TestModuleNameCharacterization:
    """Lock existing behavior before modification."""

    def test_normal_behavior(self, snapshot):
        result = target_function(normal_input)
        assert result == snapshot

    def test_empty_input(self, snapshot):
        result = target_function("")
        assert result == snapshot

    def test_invalid_input(self):
        with pytest.raises(Exception) as exc_info:
            target_function(None)
        assert str(exc_info.value)  # Capture error message
```

**Key principles:**
- Test ACTUAL behavior, not expected behavior
- Use `toMatchSnapshot()` / snapshot assertions
- Cover every public function
- Include edge cases and error paths
- Do NOT fix bugs in characterization tests

### Step 3: VERIFY

Run the characterization tests to confirm they pass with current code.

```bash
# TypeScript
npx vitest run --reporter=verbose [test-file]

# Python
pytest -v [test-file]
```

- All tests MUST pass before proceeding
- If any test fails, the characterization is wrong — fix the test, not the code
- Update snapshots if needed: `npx vitest run -u [test-file]`

### Step 4: CHANGE

Now implement the requested modification.

- Make changes incrementally
- Run characterization tests after each change
- Any unexpected test failure = potential regression

### Step 5: REGRESS

Run full characterization test suite after all changes.

```bash
npx vitest run [characterization-test-file]
```

- **All passing**: Changes preserve existing behavior
- **Expected failures**: Tests for intentionally changed behavior
- **Unexpected failures**: STOP — investigate regression

### Step 6: RECONCILE

Update characterization tests to match new intended behavior.

- Review each failing test individually
- Confirm the failure is due to intentional change
- Update snapshot: `npx vitest run -u`
- Add NEW tests for new behavior
- Document why each test changed

## Scenario-Specific Workflows

### Legacy File (>500 lines)

1. Generate function-level characterization tests
2. Focus on public API surface first
3. Add integration tests for cross-function flows
4. Refactor in small increments

### Complex Branching

1. Map all branches with a decision tree
2. Write one test per branch path
3. Include boundary values for each condition
4. Test combinations of related conditions

### API Endpoint

1. Capture request/response pairs for all routes
2. Test all HTTP methods, status codes, headers
3. Include authentication/authorization paths
4. Test error responses and validation messages

### Database Schema

1. Create fixtures with representative data
2. Test queries before and after migration
3. Verify data integrity post-migration
4. Test rollback scenarios

## Integration with VIBE Workflow

### With `/vibe.spec`
Add characterization test phase to SPEC before implementation:
```
## Pre-Implementation
- [ ] Characterization tests written for affected modules
- [ ] All characterization tests passing
```

### With `/vibe.run`
The implementation agent should:
1. Check for characterization tests before modifying files
2. Run them before and after changes
3. Flag any unexpected failures

### With `/vibe.review`
Review agents verify:
- Characterization tests exist for modified legacy code
- No regressions in existing behavior
- New behavior has corresponding new tests
