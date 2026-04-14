---
slug: {{SLUG}}
symptom: "{{SYMPTOM}}"
root-cause-tag: {{ROOT_CAUSE_TAG}}
fix-commit: {{FIX_COMMIT}}
test-path: {{TEST_PATH}}
status: {{STATUS}}
registered: {{DATE}}
feature: {{FEATURE}}
---

# {{SLUG}}

## Symptom

{{SYMPTOM_DETAIL}}

## Reproduction

**Given**: {{GIVEN}}

**When**: {{WHEN}}

**Then** (broken behavior): {{THEN_BROKEN}}

**Expected**: {{THEN_EXPECTED}}

## Root cause

{{ROOT_CAUSE_EXPLANATION}}

## Fix

{{FIX_EXPLANATION}}

## Related

- Feature: [.claude/vibe/features/{{FEATURE}}.feature](../../features/{{FEATURE}}.feature)
- Fix commit: `{{FIX_COMMIT}}`
- Regression test: `{{TEST_PATH}}`

## Notes

{{NOTES}}
