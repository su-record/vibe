# Design Polish Report: {{TARGET}}

**Date**: {{DATE}}
**Scope**: {{SCOPE_DESCRIPTION}}
**Design Context**: {{CONTEXT_SOURCE}} (design-context.json / defaults)

---

## Summary

| Category | Checked | Auto-Fixed | Manual Review |
|----------|---------|------------|---------------|
| Micro-interactions | {{MI_CHECKED}} | {{MI_FIXED}} | {{MI_MANUAL}} |
| Spacing & Alignment | {{SP_CHECKED}} | {{SP_FIXED}} | {{SP_MANUAL}} |
| Typography | {{TY_CHECKED}} | {{TY_FIXED}} | {{TY_MANUAL}} |
| Visual Consistency | {{VC_CHECKED}} | {{VC_FIXED}} | {{VC_MANUAL}} |
| Code Cleanliness | {{CC_CHECKED}} | {{CC_FIXED}} | {{CC_MANUAL}} |
| **Total** | **{{TOTAL_CHECKED}}** | **{{TOTAL_FIXED}}** | **{{TOTAL_MANUAL}}** |

**Ship-ready**: {{SHIP_READY}}

---

## Auto-Fixed

{{#AUTO_FIXED}}
- `{{FILE}}:{{LINE}}` — {{DESCRIPTION}}
{{/AUTO_FIXED}}
{{#NO_AUTO_FIXED}}
- None
{{/NO_AUTO_FIXED}}

---

## Manual Review Required

{{#MANUAL_REVIEW}}
- `{{FILE}}:{{LINE}}` — {{DESCRIPTION}}
  - Reason: {{REASON}}
  - Suggested fix: {{SUGGESTION}}
{{/MANUAL_REVIEW}}
{{#NO_MANUAL_REVIEW}}
- None
{{/NO_MANUAL_REVIEW}}

---

## Skipped Items

{{#SKIPPED}}
- {{ITEM}} — {{REASON}}
{{/SKIPPED}}
{{#NO_SKIPPED}}
- None
{{/NO_SKIPPED}}

---

## Next Steps

| Condition | Recommended Skill |
|-----------|-------------------|
| Design system gaps found | `/design-normalize` then re-run `/design-polish` |
| All items pass | Ship ready |
