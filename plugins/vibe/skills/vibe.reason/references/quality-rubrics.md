# vibe.reason — Quality Rubrics

> Loaded by vibe.reason SKILL.md Quality Gate (Mandatory) — full reasoning quality checklist, hypothesis quality standards, minimum hypothesis count, evidence standards, risk assessment matrix, forbidden reasoning patterns, and reasoning output requirements. Reasoning Score Calculation (the deterministic gate threshold) stays in SKILL.md.

### Reasoning Quality Checklist

Before completing reasoning analysis, ALL steps must be verified:

| Step | Check Item | Weight |
|------|------------|--------|
| **Step 1** | Logical dependencies and constraints identified | 10% |
| **Step 2** | Risk assessment completed with rollback plan | 10% |
| **Step 3** | At least 3 hypotheses generated with likelihood | 15% |
| **Step 4** | Verification method defined for each hypothesis | 10% |
| **Step 5** | All available tools and resources listed | 10% |
| **Step 6** | Evidence cited with exact sources | 15% |
| **Step 7** | All alternatives explored | 10% |
| **Step 8** | Error handling strategy defined | 10% |
| **Step 9** | Action plan documented before execution | 10% |


### Hypothesis Quality Standards

Each hypothesis MUST include:

| Component | Requirement | Example |
|-----------|-------------|---------|
| **Description** | Clear, testable statement | "Session data is incomplete due to race condition" |
| **Likelihood** | High/Medium/Low with justification | "High - intermittent = timing issue" |
| **Evidence** | Supporting observations | "Error only on concurrent logins" |
| **Verification** | Specific test method | "Add logging to session.save()" |
| **Disproof criteria** | What would rule it out | "Logs show complete data every time" |

### Minimum Hypothesis Count

| Problem Complexity | Minimum Hypotheses |
|--------------------|-------------------|
| Simple (single component) | 2 |
| Medium (cross-component) | 3 |
| Complex (system-wide) | 5 |

### Evidence Standards

All claims MUST include:

| Evidence Type | Required Format |
|---------------|-----------------|
| Code reference | `filename.ts:L42` |
| Log/metric | Exact value with timestamp |
| Documentation | Document name + section |
| Prior knowledge | Memory key or conversation reference |

### Risk Assessment Matrix

| Risk Level | Rollback Required | Approval Required |
|------------|-------------------|-------------------|
| **Low** | Optional | No |
| **Medium** | Yes, automated | No |
| **High** | Yes, tested | User confirmation |
| **Critical** | Yes, verified | User + backup plan |

### Forbidden Reasoning Patterns

| Pattern | Issue | Required Fix |
|---------|-------|--------------|
| "Probably X" without evidence | Unsubstantiated claim | Add supporting evidence |
| Single hypothesis | Tunnel vision | Generate alternatives |
| Skipping risk assessment | Dangerous changes | Always assess risk |
| "I think" without verification | Assumption | Verify before claiming |
| Acting before reasoning complete | Premature action | Complete all 9 steps |

### Reasoning Output Requirements

Every reasoning analysis MUST include:

1. **Problem Statement**
   - Clear description
   - Context and constraints
   - Steps applied count (X/9)

2. **Hypothesis Table**
   - Ranked by likelihood
   - All 5 components per hypothesis
   - Verification status

3. **Risk Assessment**
   - Risk level classification
   - Rollback possibility
   - Approval requirements

4. **Recommended Actions**
   - Immediate (low risk, high confidence)
   - Short-term (medium priority)
   - Long-term (systemic fix)
