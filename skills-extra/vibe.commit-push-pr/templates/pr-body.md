# PR Body Template

Use this template with `gh pr create --body "$(cat <<'EOF' ... EOF)"`.

---

## Summary

- {{CHANGE_1}}
- {{CHANGE_2}}
- {{CHANGE_3}}

## Motivation

{{WHY_THIS_CHANGE — business reason or problem being solved}}

## Related Issues

- Closes #{{ISSUE_NUMBER}}

## Test Plan

- [ ] {{TEST_STEP_1}}
- [ ] {{TEST_STEP_2}}
- [ ] {{TEST_STEP_3}}

## Screenshots / Demo

{{ATTACH_SCREENSHOT_OR_REMOVE_SECTION}}

---

{{SESSION_URL}}

---

## Usage Notes

**Minimal PR (bug fix, chore):**

```
## Summary
- {{CHANGE}}

## Related Issues
- Fixes #{{ISSUE_NUMBER}}

{{SESSION_URL}}
```

**Feature PR:**

Use the full template above. Screenshots required for UI changes.

**Breaking Change:**

Add this section at the top:

```
## BREAKING CHANGE

{{WHAT_BREAKS}} — {{MIGRATION_STEPS}}
```
