---
# prettier-ignore
description: BDD-based verification against SPEC requirements. Use when testing implementation, validating features, or checking acceptance criteria.
---

# VIBE VERIFY Skill

Activate this skill when the user wants to:
- Verify implementation against SPEC
- Run BDD scenario tests
- Check acceptance criteria
- Validate feature completion

## Verification Process

1. Load SPEC document for the feature
2. Extract acceptance criteria
3. Run BDD scenarios
4. Report pass/fail status

## BDD Format

```gherkin
Scenario: [Feature behavior]
  Given [precondition]
  When [action]
  Then [expected result]
```

## Trigger Keywords

- verify, verification
- test, validate
- check spec, acceptance
- BDD, scenario test
