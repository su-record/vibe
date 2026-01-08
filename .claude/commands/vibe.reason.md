---
description: Apply systematic reasoning framework to complex problems
argument-hint: "problem description"
---

# /vibe.reason

Apply 9-step reasoning framework to complex problems (Reasoning Agent).

## Usage

```
/vibe.reason "problem description"
```

## Description

Use systematic 9-step reasoning framework to logically analyze complex problems and derive optimal solutions.

## When to Use

Use in situations like:

1. **Complex bug debugging**
   - Root cause unclear
   - Need to systematically verify multiple hypotheses

2. **Architecture design decisions**
   - Need to choose optimal option among several
   - Need to comprehensively evaluate constraints and risks

3. **Performance optimization**
   - Bottleneck may be in multiple places
   - Need step-by-step optimization strategy

4. **Refactoring planning**
   - Need to systematically analyze legacy code complexity
   - Need gradual refactoring strategy

5. **Requirements analysis**
   - Need to reconcile conflicting requirements
   - Need to discover missing requirements

## Process

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

## MCP Tools Integration

This command automatically uses these MCP tools:

- **apply_reasoning_framework**: Apply 9-step reasoning framework
- **create_thinking_chain**: Create sequential thinking chain
- **analyze_problem**: Analyze problem root cause
- **step_by_step_analysis**: Detailed step-by-step analysis
- **recall_memory**: Restore previous context
- **find_symbol / find_references**: Identify code dependencies

## Output Format

```markdown
# Reasoning Framework Analysis

**Problem**: [problem description]
**Context**: [relevant information]
**Steps Applied**: 9/9

---

## 1. Logical Dependencies and Constraints

**Key Questions**:
- What policies or required rules apply?
- Should task order be rearranged?
- Required prerequisites or information?
- Explicit user constraints?

**Constraint Analysis**:
[analysis content]

---

## 2. Risk Assessment

...

---

## Summary

[Overall reasoning results summary and recommendations]
```

## Examples

### Example 1: Complex Bug Debugging

```
User: /vibe.reason "After user login, profile page intermittently returns 500 error. Log shows 'TypeError: Cannot read property id of undefined'"

AI: Analyzing this problem with 9-step reasoning framework.

# Reasoning Framework Analysis

**Problem**: Intermittent 500 error on profile page after login (TypeError: Cannot read property 'id' of undefined)
**Context**: Intermittent occurrence, happens after successful login
**Steps Applied**: 9/9

---

## 1. Logical Dependencies and Constraints

**Constraint Analysis**:
- Policy/Rules: Need to check auth/authz system policies
- Task Order: Verify login → session creation → profile fetch order
- Prerequisites: Need to identify error reproduction conditions
- User Constraints: Production environment limits debugging tools

---

## 2. Risk Assessment

**Risk Assessment**:
- Task type: Debugging (medium risk - logging low risk, DB changes high risk)
- Rollback possibility: Adding logs easy to rollback
- Compatibility risk: Session structure changes affect existing users
- Security risk: Excessive logging may expose sensitive info
- Performance risk: Additional logging minimal impact

---

## 3. Inductive Reasoning and Hypothesis Exploration

**Hypothesis Generation**:
1. **Hypothesis 1: Incomplete session data** (Likelihood: High)
   - Evidence: Intermittent = timing issue or data consistency problem
   - Verification: Add logging to session save logic, check Redis connection

2. **Hypothesis 2: Async processing order issue** (Likelihood: Medium)
   - Evidence: undefined = accessing data before load
   - Verification: Check Promise chain in profile API, check for missing await

3. **Hypothesis 3: DB query returns null** (Likelihood: Low)
   - Evidence: User info fetch fails only under certain conditions
   - Verification: Check profile query logs, review foreign key constraints

**Priority**: Verify in order of likelihood, don't completely rule out low probability

---

[Additional steps 4-9 analysis...]

---

## Summary

Analyzed profile page 500 error after login through 9-step reasoning framework.

**Key Findings**:
- Most likely cause: Incomplete session data (Redis connection issue or session save timing)
- Verification priority: 1) Add session save logic logging → 2) Review async processing → 3) Check DB queries

**Recommended Actions**:
1. Immediate: Add detailed logging to session save/fetch (low risk)
2. Short-term: Code review async processing (Promise, await check)
3. Medium-term: Strengthen session store monitoring (Redis connection, memory)

**Next Steps**:
Check `profile_controller.ts` → Add try-catch and logging to session processing logic → Identify reproduction conditions
```

### Example 2: Architecture Design Decision

```
User: /vibe.reason "Want to add real-time notification feature. Should I use WebSocket, SSE, or Long Polling?"

AI: [Systematically analyze constraints, risks, pros/cons of each option through 9-step framework, recommend optimal choice for project situation]
```

## Integration with Other Commands

### With /vibe.spec

```
# 1. Collect requirements
/vibe.spec "real-time notifications"

# 2. When technical decision needed
/vibe.reason "Choosing WebSocket vs SSE vs Long Polling for real-time notifications"

# 3. Update SPEC document and create plan
/vibe.plan "real-time notifications"
```

### With /vibe.analyze

```
# 1. Discover issue through code analysis
/vibe.analyze --code

# 2. Analyze discovered issue with reasoning framework
/vibe.reason "Refactoring strategy to reduce users_service.py Cyclomatic Complexity from 15 to under 10"

# 3. Execute refactoring
/vibe.run "Task: Refactor users_service.py"
```

## Agent Configuration

This command uses `~/.claude/agents/reasoning-agent.md`.

**Agent Role**:
- Systematic reasoning and problem-solving expert
- Logically analyze complex problems
- Derive optimal solutions considering all relevant factors

**Agent Features**:
- Apply 9-step reasoning framework
- Hypothesis-based approach
- Risk assessment and mitigation strategies
- Precise evidence and source citation

## Best Practices

1. **Describe problem specifically**
   - ❌ "There's a bug"
   - ✅ "After login, profile page intermittently returns 500 error. Error log: TypeError: Cannot read property 'id' of undefined"

2. **Include context**
   - Occurrence conditions (always? intermittent? specific conditions only?)
   - Relevant tech stack
   - Solutions already tried

3. **Save reasoning results to memory**
   - For complex problems, save reasoning results with `save_memory`
   - Reference later with `recall_memory`

4. **Verify step by step**
   - Verify hypotheses suggested by reasoning framework in order
   - Feedback each verification result to agent

5. **Combine with other commands**
   - `/vibe.analyze` to understand situation → `/vibe.reason` to analyze solution → `/vibe.run` to execute

## Notes

- This command is specialized for complex problems. For simple tasks, direct requests are more efficient.
- Reasoning process may take time; allow sufficient time.
- Reasoning results are recommendations; final decision is user's.
- Automatically uses MCP tools, so hi-ai server must be connected.

## Related

- [Reasoning Agent Guide](~/.claude/agents/reasoning-agent.md)
- [MCP hi-ai Guide](~/.claude/skills/tools/mcp-hi-ai-guide.md)
- [/vibe.analyze](vibe.analyze.md)
- [/vibe.spec](vibe.spec.md)
- [/vibe.plan](vibe.plan.md)

---

ARGUMENTS: $ARGUMENTS
