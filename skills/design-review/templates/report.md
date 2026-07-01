# Design Audit Report: {{TARGET}}

**Date**: {{DATE}}
**Auditor**: {{AUDITOR}}
**Scope**: {{SCOPE_DESCRIPTION}}
**Design Context**: {{CONTEXT_SOURCE}} (design-context.json / defaults)

---

## Scores

| Dimension | Score | Grade | Key Issues |
|-----------|-------|-------|------------|
| Accessibility | {{A11Y_SCORE}}/4 | {{A11Y_GRADE}} | {{A11Y_SUMMARY}} |
| Performance | {{PERF_SCORE}}/4 | {{PERF_GRADE}} | {{PERF_SUMMARY}} |
| Responsive | {{RESP_SCORE}}/4 | {{RESP_GRADE}} | {{RESP_SUMMARY}} |
| Theming | {{THEME_SCORE}}/4 | {{THEME_GRADE}} | {{THEME_SUMMARY}} |
| AI Slop | {{SLOP_SCORE}}/4 | {{SLOP_GRADE}} | {{SLOP_SUMMARY}} |
| **Overall** | **{{TOTAL_SCORE}}/20** | **{{TOTAL_PCT}}%** | |

Grade scale: 4=Excellent, 3=Good, 2=Moderate, 1=Major Issues, 0=Critical

---

## Findings

### P0 — Blocker (breaks functionality)

{{#P0_FINDINGS}}
- [{{DIMENSION}}] {{DESCRIPTION}} — `{{FILE}}:{{LINE}}`
{{/P0_FINDINGS}}
{{#NO_P0}}
- None
{{/NO_P0}}

### P1 — Critical (significant UX impact)

{{#P1_FINDINGS}}
- [{{DIMENSION}}] {{DESCRIPTION}} — `{{FILE}}:{{LINE}}`
{{/P1_FINDINGS}}
{{#NO_P1}}
- None
{{/NO_P1}}

### P2 — Important (noticeable quality gap)

{{#P2_FINDINGS}}
- [{{DIMENSION}}] {{DESCRIPTION}} — `{{FILE}}:{{LINE}}`
{{/P2_FINDINGS}}
{{#NO_P2}}
- None
{{/NO_P2}}

### P3 — Minor (polish opportunity)

{{#P3_FINDINGS}}
- [{{DIMENSION}}] {{DESCRIPTION}} — `{{FILE}}:{{LINE}}`
{{/P3_FINDINGS}}
{{#NO_P3}}
- None
{{/NO_P3}}

---

## Recommendations

{{#RECOMMENDATIONS}}
{{INDEX}}. {{RECOMMENDATION}}
{{/RECOMMENDATIONS}}

---

## Next Steps

| Condition | Recommended Skill |
|-----------|-------------------|
| Design system inconsistencies found | `/design-normalize` |
| UX/usability concerns noted | `/design-critique` |
| Score ≥ 16/20, minor polish only | `/design-polish` |

---

## Audit Metadata

- Files scanned: {{FILE_COUNT}}
- Total findings: {{TOTAL_FINDINGS}} (P0: {{P0_COUNT}}, P1: {{P1_COUNT}}, P2: {{P2_COUNT}}, P3: {{P3_COUNT}})
- Platform: {{PLATFORM}}
- Stack: {{STACK}}
