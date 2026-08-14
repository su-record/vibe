# Research Synthesis: {{RESEARCH_TOPIC}}

**Date**: {{DATE}}
**Technology**: {{TECHNOLOGY_STACK}}
**Question**: {{RESEARCH_QUESTION}}

---

## Executive Summary

{{ONE_PARAGRAPH_SUMMARY}}

**Recommended approach**: {{RECOMMENDATION}}

---

## Findings by Agent

### 1. Best Practices

{{BEST_PRACTICES_SUMMARY}}

Key insight: {{BEST_PRACTICES_KEY_INSIGHT}}

### 2. Framework Documentation

{{FRAMEWORK_DOCS_SUMMARY}}

Key constraint: {{FRAMEWORK_CONSTRAINT}}
Relevant API: `{{RELEVANT_API}}`

### 3. Codebase Patterns

{{CODEBASE_PATTERNS_SUMMARY}}

Follow this existing pattern: `{{PATTERN_FILE}}:{{PATTERN_LINE}}`

### 4. Security Advisory

Risk level: **{{RISK_LEVEL}}**

{{SECURITY_SUMMARY}}

Required mitigations: {{REQUIRED_MITIGATIONS_COUNT}}

---

## Conflicts and Resolutions

| Conflict | Agent A says | Agent B says | Resolution |
|----------|-------------|-------------|------------|
| {{CONFLICT_1}} | {{A_POSITION}} | {{B_POSITION}} | {{RESOLUTION}} |

---

## Actionable Recommendations

### Must Do (before implementation)
1. {{MUST_DO_1}}
2. {{MUST_DO_2}}

### Should Do (best practice)
1. {{SHOULD_DO_1}}
2. {{SHOULD_DO_2}}

### Avoid
1. {{AVOID_1}} — reason: {{AVOID_REASON_1}}
2. {{AVOID_2}} — reason: {{AVOID_REASON_2}}

---

## Impact on SPEC / Implementation Plan

Add to SPEC Context section:

```markdown
## Context (from parallel research)

- Best practice: {{SPEC_BEST_PRACTICE_NOTE}}
- Framework constraint: {{SPEC_CONSTRAINT_NOTE}}
- Security requirement: {{SPEC_SECURITY_NOTE}}
- Existing pattern to follow: {{SPEC_PATTERN_NOTE}}
```

---

## Unanswered Questions

- [ ] {{OPEN_QUESTION_1}} — investigate before Phase {{PHASE}}
- [ ] {{OPEN_QUESTION_2}} — can proceed without answer

---

## Sources

| Agent | Source | Confidence |
|-------|--------|-----------|
| Best Practices | {{SOURCE_1}} | {{CONFIDENCE_1}} |
| Framework Docs | {{SOURCE_2}} | {{CONFIDENCE_2}} |
| Codebase | `{{SOURCE_3}}` | High |
| Security | {{SOURCE_4}} | {{CONFIDENCE_4}} |
