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

---

ARGUMENTS: $ARGUMENTS
