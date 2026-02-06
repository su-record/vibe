---
description: Multi-agent parallel code review with priority-based findings
argument-hint: "PR number, branch name, or file path"
---

# /vibe.review

**Parallel Agent Code Review** - 13+ specialists review simultaneously

## Usage

```
/vibe.review                         # Review current branch
/vibe.review PR#123                  # Review specific PR
/vibe.review feature/login           # Review specific branch
/vibe.review src/api/                # Review specific path
/vibe.review --race                  # Multi-LLM race mode (GPT + Gemini)
/vibe.review --race security         # Race mode for specific review type
```

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## Race Mode (v2.6.9)

**Multi-LLM competitive review** - Same review task runs on GPT + Gemini in parallel, results are cross-validated.

### How It Works

```
/vibe.review --race

security-review:
├─ GPT-5.2-Codex  → [SQL injection, XSS]
└─ Gemini-3-Flash → [SQL injection, CSRF]
         ↓
   Cross-validation:
   - SQL injection (2/2) → 🔴 P1 (100% confidence)
   - XSS (1/2) → 🟡 P2 (50% confidence)
   - CSRF (1/2) → 🟡 P2 (50% confidence)
```

### Confidence-Based Priority

| Confidence | Priority | Meaning |
|------------|----------|---------|
| 100% (2/2) | P1 | Both models agree - high confidence |
| 50% (1/2) | P2 | One model found - needs verification |

### Race Mode Options

```
/vibe.review --race                  # All review types
/vibe.review --race security         # Security only
/vibe.review --race performance      # Performance only
/vibe.review --race architecture     # Architecture only
```

### Race Mode Output

```
## SECURITY Review (Race Mode)

**Duration**: 3420ms
**Models**: GPT-5.2-Codex, Gemini-3-Flash, NVIDIA Kimi K2

### Model Results

| Model | Issues Found | Duration | Status |
|-------|--------------|----------|--------|
| gpt | 3 | 1823ms | OK |
| gemini | 2 | 2156ms | OK |
| nvidia | 3 | 1950ms | OK |

### Cross-Validated Issues

**Summary**: 4 issues (P1: 2, P2: 1, P3: 1)
**Consensus Rate**: 83%

#### 🔴 P1 - SQL Injection in user query

- **Confidence**: 100% (gpt, gemini, nvidia)
- **Severity**: critical
- **Location**: `src/api/users.ts:42`
- **Suggestion**: Use parameterized queries

#### 🔴 P1 - XSS vulnerability in render

- **Confidence**: 67% (gpt, nvidia)
- **Severity**: high
- **Location**: `src/components/Comment.tsx:15`
```

### When to Use Race Mode

| Scenario | Recommended |
|----------|-------------|
| Critical security review | ✅ `--race security` |
| Pre-production audit | ✅ `--race` |
| Quick iteration | ❌ Standard review |
| API cost concerns | ❌ Standard review |

### Tool Invocation (Race Mode - GPT + Gemini + NVIDIA in parallel via Bash)

**🚨 Use stdin pipe to avoid CLI argument length limits on Windows.**

1. Save code to review into `[SCRATCHPAD]/review-code.txt` (using Write tool)
2. Run GPT + Gemini + NVIDIA in PARALLEL (three Bash tool calls at once):

```bash
# GPT review (Bash tool call 1)
node -e "const fs=require('fs');const p=JSON.stringify({prompt:'Review this code for [REVIEW_TYPE]. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. Code: '+fs.readFileSync('[SCRATCHPAD]/review-code.txt','utf8')});process.stdout.write(p)" | node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/vibe/hooks/scripts/llm-orchestrate.js" gpt orchestrate-json
```

```bash
# Gemini review (Bash tool call 2 - run in parallel)
node -e "const fs=require('fs');const p=JSON.stringify({prompt:'Review this code for [REVIEW_TYPE]. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. Code: '+fs.readFileSync('[SCRATCHPAD]/review-code.txt','utf8')});process.stdout.write(p)" | node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/vibe/hooks/scripts/llm-orchestrate.js" gemini orchestrate-json
```

```bash
# NVIDIA (Kimi) review (Bash tool call 3 - run in parallel)
node -e "const fs=require('fs');const p=JSON.stringify({prompt:'Review this code for [REVIEW_TYPE]. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. Code: '+fs.readFileSync('[SCRATCHPAD]/review-code.txt','utf8')});process.stdout.write(p)" | node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/vibe/hooks/scripts/llm-orchestrate.js" nvidia orchestrate-json
```

## Priority System

| Priority | Criteria | Action |
|----------|----------|--------|
| P1 | Security vulnerabilities, data loss, crashes | Block merge, fix immediately |
| P2 | Performance issues, architecture violations, missing tests | Fix before merge |
| P3 | Style, refactoring suggestions, documentation | Add to backlog |

## Process

### Phase 1: Tech Stack Detection

Detect project tech stack FIRST before launching reviewers:

```
Read package.json      -> TypeScript, React, Node.js
Read pyproject.toml    -> Python, FastAPI, Django
Read Gemfile           -> Ruby, Rails
Read pubspec.yaml      -> Flutter, Dart
Read go.mod            -> Go
Read CLAUDE.md         -> Explicit tech stack declaration
```

### Phase 2: Parallel Agent Review (STACK-AWARE) via Orchestrator

**Execution via Orchestrator (12+ agents in parallel):**
```bash
node -e "import('@su-record/core/orchestrator').then(o => o.review(['FILE_PATHS'], ['DETECTED_STACKS']).then(r => console.log(r.content[0].text)))"
```

**Example:**
```bash
# Review changed files with TypeScript + React stack
node -e "import('@su-record/core/orchestrator').then(o => o.review(['src/api/users.ts', 'src/components/Login.tsx'], ['TypeScript', 'React']).then(r => console.log(r.content[0].text)))"
```

**Core Reviewers (Always Run):**
| Agent | Focus |
|-------|-------|
| security-reviewer | OWASP Top 10, vulnerabilities |
| data-integrity-reviewer | Data validation, constraints |
| performance-reviewer | N+1 queries, memory leaks |
| architecture-reviewer | Layer violations, cycles |
| complexity-reviewer | Cyclomatic complexity, length |
| simplicity-reviewer | Over-abstraction, dead code |
| git-history-reviewer | Churn files, risk patterns |
| test-coverage-reviewer | Missing tests, edge cases |

**Stack-Specific Reviewers (Conditional):**
| Agent | Condition |
|-------|-----------|
| python-reviewer | .py files in diff |
| typescript-reviewer | .ts/.tsx files OR tsconfig |
| rails-reviewer | Gemfile has rails |
| react-reviewer | package.json has react |

### Phase 3: Deep Analysis

After agent results:

1. **System Context**: Component interactions, data flow, external dependencies
2. **Stakeholder Perspectives**: Developers, Ops, Security, Business
3. **Edge Cases**: Race conditions, resource exhaustion, network failures
4. **Multiple Angles**: Technical excellence, business value, risk management

### Phase 4: Findings Synthesis

```
REVIEW FINDINGS

P1 CRITICAL (Blocks Merge) - N issues
1. [SECURITY] SQL Injection in user query
   Location: src/api/users.py:42
   Fix: Use parameterized queries

P2 IMPORTANT (Should Fix) - N issues
2. [PERF] N+1 query in user list
3. [ARCH] Circular dependency detected

P3 NICE-TO-HAVE (Enhancement) - N issues
4. [STYLE] Consider extracting helper function
```

### Phase 4.5: Agent Teams — Review Debate (Experimental)

> **Agent Teams**: 개별 리뷰어의 발견을 팀으로 토론하여 우선순위를 검증하고 오탐을 제거합니다.
> 요구사항: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `teammateMode: in-process` (`~/.claude/settings.json` 전역 — postinstall 자동 설정)

**개별 리뷰 완료 후, 핵심 리뷰어들이 팀을 형성하여 교차 검증:**

```
Phase 2 결과 (13+ 개별 리뷰)
        ↓
┌─────────────────────────────────────────────────────────┐
│  🤝 REVIEW DEBATE TEAM                                   │
│                                                          │
│  Team Members:                                           │
│  ├─ security-reviewer (보안 전문)                         │
│  ├─ architecture-reviewer (아키텍처 전문)                  │
│  ├─ performance-reviewer (성능 전문)                      │
│  └─ simplicity-reviewer (복잡도 전문)                     │
│                                                          │
│  공유 Task List:                                          │
│  □ Phase 2에서 발견된 모든 P1/P2 이슈 검증                │
│  □ 각 이슈에 대해 다른 리뷰어의 관점으로 반론 시도         │
│  □ 합의된 우선순위 결정 (P1 → P2 강등 또는 P2 → P1 승격)  │
│  □ 오탐 제거 (false positive 식별)                       │
│  □ 놓친 이슈 상호 보완                                   │
│                                                          │
│  결과:                                                    │
│  - 검증된 P1/P2 목록 (팀 합의)                            │
│  - 오탐 제거 리포트                                      │
│  - 추가 발견 이슈                                        │
└─────────────────────────────────────────────────────────┘
```

**Task 호출 패턴:**

```
Task(subagent_type="general-purpose", prompt="""
[AGENT TEAM: Review Debate]

You are leading a review debate team. The following P1/P2 issues were found by individual reviewers:

{phase2_findings}

Team members and their roles:
- security-reviewer: Challenge non-security issues, validate security findings
- architecture-reviewer: Evaluate structural impact, identify hidden coupling
- performance-reviewer: Assess performance implications
- simplicity-reviewer: Question over-engineered fixes, suggest simpler alternatives

For each finding:
1. Is this a true positive? (cross-validate with other perspectives)
2. Is the priority correct? (P1 vs P2)
3. Is there a simpler fix than suggested?
4. Are there related issues the individual reviewers missed?

Output: Validated findings with team consensus priority.
""")
```

**토론 결과 예시:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤝 REVIEW DEBATE RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Team Consensus (4 reviewers):

✅ Validated P1 (unanimous):
  1. [SECURITY] SQL Injection — 4/4 agree critical

⬆️ Upgraded P2→P1 (debate result):
  2. [PERF] Unbounded query — architecture-reviewer pointed out
     cascading failure risk under load → team agreed P1

⬇️ Downgraded P1→P2 (debate result):
  3. [SECURITY] CSRF on read-only endpoint — simplicity-reviewer
     noted endpoint has no side effects → team agreed P2

❌ Removed (false positive):
  4. [ARCH] "Circular dependency" — architecture-reviewer confirmed
     this is intentional bi-directional reference, not a cycle

🆕 New findings (team discussion):
  5. [DATA] Race condition in concurrent updates — emerged from
     security + performance discussion

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Phase 5: Auto-Fix (P1/P2)

**Auto-fixable issues are resolved immediately:**

```
🔧 AUTO-FIX Starting...

P1 Critical:
  1. [SECURITY] SQL Injection → Fixed with parameterized query ✅
  2. [DATA] Missing transaction rollback → Added try-finally ✅

P2 Important:
  3. [PERF] N+1 query → Added select_related ✅
  4. [ARCH] Circular dependency → Separated dependencies ✅
  5. [TEST] Missing edge case → Added test ✅

🔍 Re-validating...
  ✅ Build successful
  ✅ Tests passed

✅ 5 issues auto-fixed!
```

**Cases that cannot be auto-fixed:**
- Requires large-scale architecture changes
- Requires business logic decisions
- Requires user confirmation

→ Manual handling instructions in Phase 6

### Phase 6: Todo File Creation (Items Requiring Manual Handling)

Save **remaining** findings to `.claude/vibe/todos/`:

```
{priority}-{category}-{short-desc}.md

Examples:
- P2-arch-large-refactor.md  (Cannot be auto-fixed)
- P3-style-extract-helper.md (Backlog)
```

## Output

```
CODE REVIEW SUMMARY
PR #123: Add user authentication

Reviewers: 13 agents
⏱️ Started: {start_time}
⏱️ Completed: {getCurrentTime 결과}

Score: 92/100 (Good) ← Score after auto-fix

Issues Found:
- P1 Critical: 2 → 0 (✅ Auto-fixed)
- P2 Important: 5 → 1 (✅ 4 auto-fixed)
- P3 Nice-to-have: 3 (Backlog)

Auto-Fixed: 6 issues
- [SECURITY] SQL Injection ✅
- [DATA] Transaction rollback ✅
- [PERF] N+1 query ✅
- [ARCH] Circular dependency ✅
- [PERF] Unnecessary loop ✅
- [TEST] Missing edge case ✅

Remaining (Manual handling required):
- P2-arch-large-refactor.md (Architecture decision required)
- P3-style-extract-helper.md (Backlog)
- P3-docs-add-readme.md (Backlog)

✅ MERGE READY (P1/P2 resolved)
```

### Phase 7: Guide to Fix Workflow (Manual Handling Items)

**Choose workflow when handling remaining issues:**

```
## Fix Workflow

Choose a workflow to fix the discovered issues:

| Task Scale | Recommended Approach |
|------------|---------------------|
| Simple fix (1-2 files) | Plan Mode |
| Complex fix (3+ files, validation needed) | /vibe.spec |

1. `/vibe.spec "fix: issue-name"` - VIBE workflow (SPEC validation + re-review)
2. Plan Mode - Quick fix (for simple tasks)

Which approach would you like to proceed with?
```

- Wait for user's choice before proceeding
- If user chooses VIBE → wait for `/vibe.spec` command
- If user chooses Plan Mode → proceed with EnterPlanMode

## Core Tools (Code Analysis)

### Tool Invocation

All tools are called via:

```bash
node -e "import('@su-record/core/tools').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Recommended Tools for Review

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `validateCodeQuality` | Code quality check | Overall code quality scan |
| `analyzeComplexity` | Complexity metrics | Check function complexity |
| `findSymbol` | Find definitions | Locate implementations |
| `findReferences` | Find all usages | Track symbol usage |
| `saveMemory` | Save findings | Store important review findings |

### Example Tool Usage in Review

**1. Validate code quality before review:**

```bash
node -e "import('@su-record/core/tools').then(t => t.validateCodeQuality({targetPath: 'src/', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**2. Analyze complexity of changed files:**

```bash
node -e "import('@su-record/core/tools').then(t => t.analyzeComplexity({targetPath: 'src/api/users.ts', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**3. Save critical finding for reference:**

```bash
node -e "import('@su-record/core/tools').then(t => t.saveMemory({key: 'review-pr123-critical', value: 'SQL injection in users.py:42', category: 'review', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

---

## Quality Gate (Mandatory)

### Review Quality Checklist

Before completing review, ALL items must be verified:

| Category | Check Item | Weight |
|----------|------------|--------|
| **Security** | OWASP Top 10 vulnerabilities scanned | 20% |
| **Security** | Authentication/authorization verified | 10% |
| **Security** | Sensitive data exposure checked | 10% |
| **Performance** | N+1 queries detected and flagged | 10% |
| **Performance** | Memory leaks checked | 5% |
| **Architecture** | Layer violations detected | 10% |
| **Architecture** | Circular dependencies checked | 5% |
| **Code Quality** | Complexity limits enforced | 10% |
| **Code Quality** | Forbidden patterns detected | 10% |
| **Testing** | Test coverage gaps identified | 5% |
| **Documentation** | Public API documentation checked | 5% |

### Review Score Calculation

```
Score = 100 - (P1 × 20) - (P2 × 5) - (P3 × 1)

Grades:
- 95-100: ✅ EXCELLENT - Merge ready
- 90-94:  ⚠️ GOOD - Minor fixes required before merge
- 80-89:  ⚠️ FAIR - Must fix P2 issues
- 0-79:   ❌ POOR - Block merge, fix P1/P2
```

### Merge Decision Matrix

| P1 Count | P2 Count | Decision |
|----------|----------|----------|
| 0 | 0-2 | ✅ MERGE READY |
| 0 | 3+ | ⚠️ FIX P2 FIRST |
| 1+ | Any | ❌ BLOCKED |

### Auto-Fix Capability Matrix

| Issue Type | Auto-Fixable | Method |
|------------|--------------|--------|
| SQL Injection | ✅ Yes | Parameterized query |
| Missing transaction | ✅ Yes | Add try-finally |
| N+1 query | ✅ Yes | Add eager loading |
| Circular dependency | ⚠️ Partial | Suggest restructure |
| Missing tests | ✅ Yes | Generate test skeleton |
| Hardcoded secrets | ❌ No | Flag for manual review |
| Architecture violation | ❌ No | Suggest refactoring plan |

### Forbidden Patterns (P1 Critical)

| Pattern | Risk Level | Detection Method |
|---------|------------|------------------|
| Hardcoded credentials | Critical | Regex + entropy scan |
| SQL string concatenation | Critical | AST analysis |
| `eval()` or `exec()` | Critical | AST analysis |
| Disabled CSRF protection | Critical | Config scan |
| Debug mode in production | Critical | Config scan |
| Unvalidated redirects | High | URL pattern scan |

### Review Output Requirements

Every review MUST produce:

1. **Summary Statistics**
   - Total issues by priority (P1/P2/P3)
   - Auto-fixed count
   - Remaining manual fixes

2. **Detailed Findings**
   - File path and line number
   - Issue description
   - Recommended fix
   - Auto-fix status (applied/pending/manual)

3. **Quality Score**
   - Numerical score (0-100)
   - Grade (EXCELLENT/GOOD/FAIR/POOR)
   - Merge recommendation

---

ARGUMENTS: $ARGUMENTS
