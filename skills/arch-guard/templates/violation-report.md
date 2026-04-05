# Architecture Violation Report

**Project**: {{PROJECT_NAME}}
**Date**: {{DATE}}
**Rules File**: {{RULES_FILE}}
**Total Violations**: {{VIOLATION_COUNT}}

---

## Summary

| Rule | Violations |
|------|-----------|
{{RULE_SUMMARY_TABLE}}

---

## Violations by Rule

{{VIOLATIONS_BY_RULE}}

<!-- Example entry:
### services-no-ui (3 violations)

**Rule**: Services must be UI-agnostic for testability and reuse

| File | Forbidden Import |
|------|-----------------|
| src/services/auth.ts | src/components/Button.tsx |
| src/services/user.ts | src/pages/dashboard/index.ts |
-->

---

## How to Fix

For each violation, choose one:

1. **Move the dependency** — relocate shared logic to a layer both sides can import
2. **Invert the dependency** — use an interface/callback instead of a direct import
3. **Promote the import** — move the imported file to a shared/common layer
4. **Update the rule** — if the violation is intentional, document why and update arch-rules.json

> Do NOT suppress violations without documenting the reason in arch-rules.json.

---

## Next Steps

1. Fix all violations in the table above
2. Re-run: `node skills/arch-guard/scripts/check-boundaries.js {{RULES_FILE}} {{SRC_DIR}}`
3. Commit clean state: `git commit -m "fix: resolve arch-guard boundary violations"`
4. Add to CI: run check-boundaries.js in pre-commit or CI pipeline
