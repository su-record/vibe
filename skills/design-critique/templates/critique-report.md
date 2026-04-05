# Design Critique: {{TARGET}}

**Date**: {{DATE}}
**Scope**: {{SCOPE_DESCRIPTION}}
**Design Context**: {{CONTEXT_SOURCE}} (design-context.json / defaults)
**Audience**: {{AUDIENCE_PRIMARY}} — {{AUDIENCE_EXPERTISE}}

---

## Heuristic Scores

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| H1 | Visibility of system status | {{H1_SCORE}}/4 | {{H1_ISSUE}} |
| H2 | Match between system and real world | {{H2_SCORE}}/4 | {{H2_ISSUE}} |
| H3 | User control and freedom | {{H3_SCORE}}/4 | {{H3_ISSUE}} |
| H4 | Consistency and standards | {{H4_SCORE}}/4 | {{H4_ISSUE}} |
| H5 | Error prevention | {{H5_SCORE}}/4 | {{H5_ISSUE}} |
| H6 | Recognition rather than recall | {{H6_SCORE}}/4 | {{H6_ISSUE}} |
| H7 | Flexibility and efficiency | {{H7_SCORE}}/4 | {{H7_ISSUE}} |
| H8 | Aesthetic and minimalist design | {{H8_SCORE}}/4 | {{H8_ISSUE}} |
| H9 | Help recognize and recover from errors | {{H9_SCORE}}/4 | {{H9_ISSUE}} |
| H10 | Help and documentation | {{H10_SCORE}}/4 | {{H10_ISSUE}} |
| **Total** | | **{{TOTAL_SCORE}}/40** | **{{TOTAL_PCT}}%** |

---

## Persona Red Flags

### Power User — {{POWER_STATUS}}
{{#POWER_ISSUES}}
- {{ISSUE}}
{{/POWER_ISSUES}}
{{#POWER_CLEAR}}
- No red flags
{{/POWER_CLEAR}}

### First-Time User — {{FIRST_TIME_STATUS}}
{{#FIRST_TIME_ISSUES}}
- {{ISSUE}}
{{/FIRST_TIME_ISSUES}}
{{#FIRST_TIME_CLEAR}}
- No red flags
{{/FIRST_TIME_CLEAR}}

### Accessibility-Dependent User — {{A11Y_STATUS}}
{{#A11Y_ISSUES}}
- {{ISSUE}}
{{/A11Y_ISSUES}}
{{#A11Y_CLEAR}}
- No red flags
{{/A11Y_CLEAR}}

### Stressed / Distracted User — {{STRESSED_STATUS}}
{{#STRESSED_ISSUES}}
- {{ISSUE}}
{{/STRESSED_ISSUES}}
{{#STRESSED_CLEAR}}
- No red flags
{{/STRESSED_CLEAR}}

### Mobile-Only User — {{MOBILE_STATUS}}
{{#MOBILE_ISSUES}}
- {{ISSUE}}
{{/MOBILE_ISSUES}}
{{#MOBILE_CLEAR}}
- No red flags
{{/MOBILE_CLEAR}}

---

## Top Recommendations

{{#RECOMMENDATIONS}}
{{INDEX}}. **[{{HEURISTIC}}]** {{RECOMMENDATION}}
{{/RECOMMENDATIONS}}

---

## Next Steps

| Condition | Recommended Skill |
|-----------|-------------------|
| Visual complexity / clutter noted | `/design-distill` |
| Token inconsistencies noted | `/design-normalize` |
| Good overall, minor polish needed | `/design-polish` |
