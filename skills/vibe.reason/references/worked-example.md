# vibe.reason — Worked Example

> Loaded by vibe.reason SKILL.md Example — full worked example applying the 9-step reasoning framework to a debugging scenario.

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
