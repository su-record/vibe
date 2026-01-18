---
description: Apply systematic reasoning framework to complex problems
argument-hint: "problem description"
---

# /vibe.reason

Apply 9-step reasoning framework to complex problems.

## Usage

```
/vibe.reason "problem description"
```

## When to Use

1. **Complex bug debugging** - Root cause unclear, need systematic hypothesis verification
2. **Architecture design decisions** - Choose optimal option among several
3. **Performance optimization** - Bottleneck may be in multiple places
4. **Refactoring planning** - Systematically analyze legacy code complexity
5. **Requirements analysis** - Reconcile conflicting requirements

## 9-Step Reasoning Framework

### 1. Logical Dependencies and Constraints
- Check policies, rules, prerequisites
- Optimize task order (identify dependencies)
- Apply user constraints first

### 2. Risk Assessment
- Analyze action consequences
- Check rollback possibility
- Review compatibility, security, performance risks

### 3. Inductive Reasoning and Hypothesis Exploration
- Generate hypotheses about root cause
- Prioritize by likelihood
- Present verification method for each hypothesis

### 4. Result Evaluation and Adaptability
- Modify plan based on observations
- Generate new hypothesis when disproved
- Determine backtracking need

### 5. Information Availability
- Identify all available tools
- Reference relevant policy/rule documents
- Restore previous context
- Distinguish items needing user confirmation

### 6. Precision and Evidence
- Cite exact source when referencing policies
- Include filename:line when referencing code
- Provide exact metric numbers

### 7. Completeness
- Integrate all requirements, options, preferences
- Avoid premature conclusions
- Explore multiple alternatives

### 8. Persistence and Patience
- Intelligently retry temporary errors
- Solve problems through strategy changes
- Continue until all reasoning steps complete

### 9. Response Suppression
- Act only after reasoning complete
- Document reasoning process for complex decisions
- Ensure safety through step-by-step execution

## Output Format

```markdown
# Reasoning Framework Analysis

**Problem**: [problem description]
**Context**: [relevant information]
**Steps Applied**: 9/9

---

## 1. Logical Dependencies and Constraints

**Constraint Analysis**:
[analysis content]

---

## 2. Risk Assessment

**Risk Assessment**:
- Task type: [risk level]
- Rollback possibility: [assessment]
- Compatibility/Security/Performance risks

---

## 3. Inductive Reasoning and Hypothesis Exploration

**Hypothesis Generation**:
1. **Hypothesis 1**: [description] (Likelihood: High/Medium/Low)
   - Evidence: [supporting evidence]
   - Verification: [how to verify]

2. **Hypothesis 2**: ...

---

[Steps 4-9...]

---

## Summary

[Overall reasoning results summary and recommendations]

**Recommended Actions**:
1. Immediate: [low risk action]
2. Short-term: [medium priority]
3. Medium-term: [long-term fix]
```

## Example

```
User: /vibe.reason "After user login, profile page intermittently returns 500 error"

AI: Analyzing with 9-step reasoning framework...

# Reasoning Framework Analysis

**Problem**: Intermittent 500 error on profile page after login
**Context**: Intermittent occurrence, happens after successful login

## 1. Logical Dependencies and Constraints

**Constraint Analysis**:
- Policy/Rules: Need to check auth/authz system policies
- Task Order: Verify login -> session creation -> profile fetch order
- Prerequisites: Need to identify error reproduction conditions

## 3. Inductive Reasoning and Hypothesis Exploration

**Hypothesis Generation**:
1. **Hypothesis 1: Incomplete session data** (Likelihood: High)
   - Evidence: Intermittent = timing issue or data consistency problem
   - Verification: Add logging to session save logic

2. **Hypothesis 2: Async processing order issue** (Likelihood: Medium)
   - Evidence: undefined = accessing data before load
   - Verification: Check Promise chain, missing await

## Summary

**Key Findings**:
- Most likely cause: Incomplete session data
- Verification priority: 1) Session logging -> 2) Async review -> 3) DB check

**Recommended Actions**:
1. Immediate: Add detailed logging to session save/fetch
2. Short-term: Code review async processing
3. Medium-term: Strengthen session store monitoring
```

## Best Practices

1. **Describe problem specifically**
   - Bad: "There's a bug"
   - Good: "After login, profile page intermittently returns 500 error"

2. **Include context**
   - Occurrence conditions (always? intermittent?)
   - Relevant tech stack
   - Solutions already tried

3. **Verify step by step**
   - Verify hypotheses in order of likelihood
   - Feedback each verification result

## Vibe Tools (Reasoning Support)

### Tool Invocation

All tools are called via:

```bash
node -e "import('@su-record/vibe/tools').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Recommended Tools for Reasoning

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `findSymbol` | Find symbol definitions | Locate potential problem areas |
| `findReferences` | Find all references | Trace data/control flow |
| `analyzeComplexity` | Complexity analysis | Identify high-risk complex code |
| `saveMemory` | Save reasoning progress | Store hypothesis verification results |
| `recallMemory` | Recall saved memory | Retrieve previous reasoning context |

### Example Tool Usage in Reasoning

**1. Find potential problem source:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.findSymbol({symbolName: 'getProfile', searchPath: 'src/'}).then(r => console.log(r.content[0].text)))"
```

**2. Trace references to understand flow:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.findReferences({symbolName: 'sessionData', searchPath: 'src/'}).then(r => console.log(r.content[0].text)))"
```

**3. Save hypothesis verification result:**

```bash
node -e "import('@su-record/vibe/tools').then(t => t.saveMemory({key: 'hypothesis-1-result', value: 'Session save timing issue confirmed - race condition in auth middleware', category: 'reasoning', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

---

## Quality Gate (Mandatory)

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

### Reasoning Score Calculation

```
Score = (completed_steps / 9) × 100

Grades:
- 9/9 (100%): ✅ THOROUGH - Ready to act
- 7-8/9 (78-89%): ⚠️ ADEQUATE - Minor gaps
- 5-6/9 (56-67%): ❌ INCOMPLETE - More analysis needed
- <5/9 (<56%): ❌ INSUFFICIENT - Start over
```

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

---

ARGUMENTS: $ARGUMENTS
