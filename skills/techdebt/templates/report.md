# Technical Debt Report

**Project**: {{PROJECT_NAME}}
**Date**: {{DATE}}
**Scanned Directory**: {{SCAN_DIR}}
**Files Scanned**: {{FILE_COUNT}}

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| P1 — Blocks Merge | {{P1_COUNT}} | {{P1_STATUS}} |
| P2 — Fix Before PR | {{P2_COUNT}} | {{P2_STATUS}} |
| P3 — Backlog | {{P3_COUNT}} | {{P3_STATUS}} |
| **Total** | **{{TOTAL_COUNT}}** | |

---

## P1 — Blocks Merge ({{P1_COUNT}} items)

{{P1_ITEMS}}

<!-- Example entry:
- `src/services/auth.ts:42` — `any` type usage: parameter `payload` typed as `any`
-->

---

## P2 — Fix Before PR ({{P2_COUNT}} items)

### Console Statements ({{CONSOLE_COUNT}})

{{CONSOLE_ITEMS}}

### Unused Imports ({{UNUSED_IMPORT_COUNT}})

{{UNUSED_IMPORT_ITEMS}}

### Long Functions ({{LONG_FUNCTION_COUNT}})

{{LONG_FUNCTION_ITEMS}}

### Deep Nesting ({{DEEP_NESTING_COUNT}})

{{DEEP_NESTING_ITEMS}}

---

## P3 — Backlog ({{P3_COUNT}} items)

### Magic Numbers ({{MAGIC_NUMBER_COUNT}})

{{MAGIC_NUMBER_ITEMS}}

### Commented-Out Code ({{COMMENTED_CODE_COUNT}})

{{COMMENTED_CODE_ITEMS}}

---

## Auto-fixable Items

The following can be removed safely without review:

{{AUTOFIXABLE_LIST}}

> Run with user confirmation before applying auto-fixes.

---

## Requires Manual Review

The following require human judgment:

{{MANUAL_REVIEW_LIST}}

---

## Next Steps

1. Fix all P1 items immediately
2. Address P2 items before opening PR
3. Create tracked tickets for P3 items
4. Re-run scan after fixes: `node skills/techdebt/scripts/scan.js {{SCAN_DIR}}`
