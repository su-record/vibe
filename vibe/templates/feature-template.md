# Feature: {Feature Name}

> This file is **the core of quality assurance**. All scenarios passing = feature complete.

**SPEC**: `.claude/vibe/specs/{feature-name}.md`
**Last verified**: -
**Quality score**: -

---

## User Story

**As a** {User role}
**I want** {Desired functionality}
**So that** {Reason/Value}

---

## Scenarios

> Each scenario is both an implementation unit and a verification unit.

### Scenario 1: {Happy Path - Normal Case}

```gherkin
Scenario: {Scenario title}
  Given {Precondition}
    # Verification: {What to check}
  When {User action}
    # Verification: {What functionality is executed}
  Then {Expected result}
    # Verification: {What is visible or returned}
```

**SPEC AC**: #1
**Status**: ⬜

---

### Scenario 2: {Edge Case - Error Case}

```gherkin
Scenario: {Error scenario title}
  Given {Precondition}
  When {Invalid input or exception}
  Then {Error message or appropriate handling}
```

**SPEC AC**: #2
**Status**: ⬜

---

### Scenario 3: {Boundary Case}

```gherkin
Scenario: {Boundary value test}
  Given {Precondition}
  When {Boundary value input}
  Then {Appropriate handling}
```

**SPEC AC**: #3
**Status**: ⬜

---

## Coverage Summary

| # | Scenario | SPEC AC | Status | Retries |
|---|----------|---------|--------|---------|
| 1 | {Happy Path} | AC-1 | ⬜ | - |
| 2 | {Edge Case} | AC-2 | ⬜ | - |
| 3 | {Boundary Case} | AC-3 | ⬜ | - |

**Total**: 0/3 passed (0%)

---

## Verification Commands

```bash
# Full verification
/vibe.verify "{feature name}"

# Auto-fix on failure
/vibe.run "{feature name}" --fix
```

---

## Notes

- Update Coverage Summary when adding/modifying scenarios
- Specify verification points for each Given/When/Then
- Quality is assured when all scenarios pass
