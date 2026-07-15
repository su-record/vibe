---
name: vibe.reason
description: Apply systematic reasoning framework to complex problems
argument-hint: "problem description"
user-invocable: true
---

# /vibe.reason

Apply 9-step reasoning framework to complex problems.

## Usage

```
/vibe.reason "problem description"
```

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

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

> Read `references/output-format-template.md` for the full markdown report template.

> Read `references/worked-example.md` for a full worked example applying the 9-step framework to a debugging scenario.

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

## Core Tools (Reasoning Support)

### Tool Invocation

All tools are called via:

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Recommended Tools for Reasoning

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `analyzeComplexity` | Complexity analysis | Identify high-risk complex code |
| `saveMemory` | Save reasoning progress | Store hypothesis verification results |
| `recallMemory` | Recall saved memory | Retrieve previous reasoning context |

### Example Tool Usage in Reasoning

**1. Find potential problem source:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.findSymbol({symbolName: 'getProfile', searchPath: 'src/'}).then(r => console.log(r.content[0].text)))"
```

**2. Trace references to understand flow:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.findReferences({symbolName: 'sessionData', searchPath: 'src/'}).then(r => console.log(r.content[0].text)))"
```

**3. Save hypothesis verification result:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.saveMemory({key: 'hypothesis-1-result', value: 'Session save timing issue confirmed - race condition in auth middleware', category: 'reasoning', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

---

## Quality Gate (Mandatory)

> Read `references/quality-rubrics.md` for the full reasoning quality checklist, hypothesis quality standards, minimum hypothesis count, evidence standards, risk assessment matrix, forbidden reasoning patterns, and reasoning output requirements.

### Reasoning Score Calculation

```
Score = (completed_steps / 9) × 100

Grades:
- 9/9 (100%): ✅ THOROUGH - Ready to act
- 7-8/9 (78-89%): ⚠️ ADEQUATE - Minor gaps
- 5-6/9 (56-67%): ❌ INCOMPLETE - More analysis needed
- <5/9 (<56%): ❌ INSUFFICIENT - Start over
```

---

ARGUMENTS: $ARGUMENTS
