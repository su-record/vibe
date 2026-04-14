---
topic: {{RESEARCH_TOPIC}}
slug: {{SLUG}}
date: {{DATE}}
stack: [{{TECHNOLOGY_STACK_CSV}}]
question: {{RESEARCH_QUESTION}}
---

# {{RESEARCH_TOPIC}}: A Structured Survey for Implementation

**Date**: {{DATE}}
**Stack**: {{TECHNOLOGY_STACK}}
**Research question**: {{RESEARCH_QUESTION}}

---

## Abstract

{{ONE_PARAGRAPH_ABSTRACT}}

**TL;DR recommendation**: {{RECOMMENDATION}}

## 1. Background

{{PROBLEM_CONTEXT — why this matters now, what forced the investigation}}

### 1.1 Prior art in this codebase

{{EXISTING_PATTERNS — what's already here, at what file paths}}

### 1.2 Scope

- In scope: {{IN_SCOPE}}
- Out of scope: {{OUT_OF_SCOPE}}

## 2. Method

Parallel research across four specialized agents (best-practices, framework-docs, codebase-patterns, security-advisory). Findings weighted by source priority: **security > official docs > codebase consistency > community consensus > blog posts**.

## 3. Findings

### 3.1 Approach A — {{APPROACH_A}}
- Pro: {{A_PRO}}
- Con: {{A_CON}}
- Evidence: {{A_EVIDENCE}}

### 3.2 Approach B — {{APPROACH_B}}
- Pro: {{B_PRO}}
- Con: {{B_CON}}
- Evidence: {{B_EVIDENCE}}

### 3.3 Conflicts and resolutions

| Conflict | Position A | Position B | Resolution | Rationale |
|----------|-----------|-----------|------------|-----------|
| {{C_1}} | {{A_1}} | {{B_1}} | {{R_1}} | {{WHY_1}} |

## 4. Security considerations

| Risk | Severity | Mitigation | Blocker? |
|------|----------|------------|----------|
| {{RISK_1}} | {{SEV_1}} | {{MIT_1}} | {{YN}} |

## 5. Recommendation

**Primary**: {{PRIMARY_APPROACH}}
**Acceptable fallback**: {{FALLBACK}}
**Reject**: {{REJECTED}} — reason: {{REJECT_REASON}}

### 5.1 Implementation starting point

{{CONCRETE_FIRST_STEP — file to touch, function to add, snippet}}

## 6. Open questions

- [ ] {{OPEN_Q_1}} — resolve before {{PHASE}}
- [ ] {{OPEN_Q_2}} — can proceed without

## 7. References

| # | Source | Agent | Confidence |
|---|--------|-------|------------|
| 1 | {{SRC_1}} | {{AGENT_1}} | {{CONF_1}} |
| 2 | {{SRC_2}} | {{AGENT_2}} | {{CONF_2}} |

---

**Reuse**: cite this file by path (`.claude/vibe/research/{{SLUG}}/paper.md`) when writing a SPEC — paste the Findings and Recommendation sections into the SPEC's Context block.
