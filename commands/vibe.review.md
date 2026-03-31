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
├─ GPT Codex  → [SQL injection, XSS]
└─ Gemini     → [SQL injection, CSRF]
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
**Models**: GPT Codex, Gemini

### Model Results

| Model | Issues Found | Duration | Status |
|-------|--------------|----------|--------|
| gpt | 3 | 1823ms | OK |
| gemini | 2 | 2156ms | OK |

### Cross-Validated Issues

**Summary**: 3 issues (P1: 1, P2: 2)
**Consensus Rate**: 67%

#### 🔴 P1 - SQL Injection in user query

- **Confidence**: 100% (gpt, gemini)
- **Severity**: critical
- **Location**: `src/api/users.ts:42`
- **Suggestion**: Use parameterized queries

#### 🟡 P2 - XSS vulnerability in render

- **Confidence**: 50% (gpt)
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

### Tool Invocation (Race Mode - GPT + Gemini in parallel via Bash)

**🚨 Use --input file to avoid CLI argument length limits and Windows pipe issues.**

1. Save code to review into `[SCRATCHPAD]/review-code.txt` (using Write tool)
2. Write JSON input file `[SCRATCHPAD]/review-input.json` (using Write tool):
   - `{"prompt": "Review this code for [REVIEW_TYPE]. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. Code: [CODE_CONTENT]"}`
   - Where `[CODE_CONTENT]` is the code text (properly JSON-escaped inside the prompt string)
3. Script path: `[LLM_SCRIPT]` = `{{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js`
4. Run GPT + Gemini in PARALLEL (two Bash tool calls at once):

```bash
# GPT review (Bash tool call 1)
node "[LLM_SCRIPT]" gpt orchestrate-json --input "[SCRATCHPAD]/review-input.json"
```

```bash
# Gemini review (Bash tool call 2 - run in parallel)
node "[LLM_SCRIPT]" gemini orchestrate-json --input "[SCRATCHPAD]/review-input.json"
```

## File Reading Policy (Mandatory)

- **소스코드 파일**: 리뷰 대상 파일은 반드시 `Read` 도구로 전체 파일을 읽은 후 리뷰할 것 (Grep으로 훑어보기 금지)
- **Grep 사용 제한**: 파일 위치 탐색(어떤 파일에 있는지 찾기)에만 사용. 파일 내용 파악 및 리뷰에는 반드시 Read 사용
- **에이전트 spawn 시**: 프롬프트에 "대상 파일을 Read 도구로 전체 읽은 후 분석하라"를 반드시 포함할 것
- **부분 읽기 금지**: Grep 결과의 주변 몇 줄만 보고 판단하지 말 것. 전체 맥락을 파악해야 정확한 리뷰 가능

## Priority System

| Priority | Criteria | Action |
|----------|----------|--------|
| P1 | Security vulnerabilities, data loss, crashes | Block merge, fix immediately |
| P2 | Performance issues, architecture violations, missing tests | Fix before merge |
| P3 | Style, refactoring suggestions, documentation | Add to backlog |

## Convergence Rules (Over-Diagnosis Prevention)

> **Principle**: Reviews must converge. A review that always finds more issues is broken, not thorough.

### Scope Limiting

- **Review ONLY changed files** — based on `git diff --name-only`. Never scan the entire project
- **If no git diff** (first review) — review only files in the target path

### Severity Filtering by Round

| Round | What to Report |
|-------|---------------|
| 1st review | P1 + P2 + P3 (all) |
| 2nd review (same code) | P1 + P2 only (skip P3) |
| 3rd+ review | P1 only (report only new P1s) |

### Stop Conditions

- **P1 = 0 means MERGE READY** — mergeable even with remaining P2/P3
- **P1 = 0 after auto-fix means DONE** — record P2 auto-fix failures as TODO and stop
- **Final P1 list unchanged after Review Debate → DONE** — no new findings = converged

### Anti-Patterns (FORBIDDEN)

- "All items must be verified" → Only P1 is mandatory, P2/P3 are best-effort
- "Found one more issue" (repeated) → Only report P1s not mentioned in previous review
- Forcing code changes for P3 issues → P3 goes to TODO files only, never force code changes
- Infinite retries on auto-fix failure → max 1 retry then move to TODO

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

### Phase 1.5: SPEC ↔ Code Alignment Check

> When SPEC files exist, verify that code changes align with the SPEC

```
1. Search .claude/vibe/specs/ for related SPEC files (based on git diff filenames)
2. Compare SPEC REQ-* list against functionality in changed code
3. If functionality added that's not in SPEC → P2 finding: "Feature added without SPEC"
4. If implementation differs from SPEC → P1 finding: "SPEC ↔ code mismatch"
5. If no SPEC files exist → Skip (reviews work without SPEC too)
```

### Phase 2: Parallel Agent Review (STACK-AWARE) via Orchestrator

**Execution via Orchestrator (12+ agents in parallel):**
```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/infra/orchestrator/index.js').then(o => o.review(['FILE_PATHS'], ['DETECTED_STACKS']).then(r => console.log(r.content[0].text)))"
```

**Example:**
```bash
# Review changed files with TypeScript + React stack
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/infra/orchestrator/index.js').then(o => o.review(['src/api/users.ts', 'src/components/Login.tsx'], ['TypeScript', 'React']).then(r => console.log(r.content[0].text)))"
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

### Phase 2.5: UI/UX Review Agents (Auto-triggered)

> **활성화 조건**: 변경된 파일 중 UI 파일 존재 (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`, `.scss`)
> **비활성화**: `.claude/vibe/config.json`에 `"uiUxAnalysis": false` 설정

**기존 12+ 리뷰 에이전트와 병렬 실행:**

| Agent | Role | Output |
|-------|------|--------|
| ⑥ ux-compliance-reviewer | UX 가이드라인 준수 검증 | P1/P2/P3 findings |
| ⑦ ui-a11y-auditor | WCAG 2.1 AA 접근성 감사 | P1/P2/P3 findings |
| ⑧ ui-antipattern-detector | UI 안티패턴 + 디자인 시스템 일관성 | P1/P2/P3 findings |

**실행 방법 — 기존 Phase 2 에이전트와 병렬 실행:**

```text
# ⑥ UX 준수 검증 (Haiku)
Task(subagent_type="ux-compliance-reviewer",
  prompt="Review UI files for UX guideline compliance: {changed_ui_files}. Use core_ui_search against ux-guidelines and web-interface domains.")

# ⑦ 접근성 감사 (Haiku)
Task(subagent_type="ui-a11y-auditor",
  prompt="Audit UI files for WCAG 2.1 AA compliance: {changed_ui_files}.")

# ⑧ 안티패턴 검출 (Haiku)
Task(subagent_type="ui-antipattern-detector",
  prompt="Detect UI anti-patterns in: {changed_ui_files}. Check against MASTER.md if exists at .claude/vibe/design-system/{project}/MASTER.md.")
```

**findings 통합**: ⑥⑦⑧ findings를 기존 findings[]와 병합 → P1/P2/P3 통합 정렬

**⑦ Critical finding 에스컬레이션**: ui-a11y-auditor의 P1 finding은 Review Debate Team(Phase 4.5)에 자동 포함

### Phase 2.7: Boundary Mismatch Detection (Integration Coherence)

> **활성화 조건**: 변경된 파일 중 API route + 프론트엔드 훅/컴포넌트가 함께 존재
> 경계면 불일치는 개별 파일 리뷰로는 발견 불가 — **양쪽을 동시에 읽어야** 잡힘

**검증 방법: "양쪽 동시 읽기"**

반드시 **생산자와 소비자 코드를 동시에** Read하여 교차 비교한다.

| 검증 영역 | 생산자 (왼쪽) | 소비자 (오른쪽) | 검증 내용 |
|----------|-------------|---------------|----------|
| API ↔ 훅 타입 | route의 Response.json() shape | hooks의 fetch\<T\> 타입 | shape 일치, 래핑 unwrap, case 변환 |
| 라우팅 정합성 | src/app/ page 파일 경로 | href, router.push 값 | 경로 매칭, route group 처리, 동적 세그먼트 |
| 상태 전이 | STATE_TRANSITIONS 맵 | .update({ status }) 코드 | 죽은 전이, 무단 전이, 중간→최종 누락 |
| 데이터 흐름 | DB 스키마 필드명 | API 응답 → 프론트 타입 | 필드명 일치, optional 처리 일관성 |

**실행 방식 — 변경 파일 기반 자동 판별:**

```text
1. git diff에서 API route 파일과 대응 프론트 파일을 짝으로 매칭
2. 짝이 있는 경우 → 아래 4개 검증 실행
3. 짝이 없는 경우 (API만 또는 프론트만 변경) → "대응 파일 미변경" 경고 후 스킵
```

**검증 체크리스트:**

- [ ] API 응답 shape과 대응 훅의 제네릭 타입이 일치
- [ ] 래핑된 응답(`{ items: [...] }`)은 훅에서 unwrap하는지 확인
- [ ] snake_case ↔ camelCase 변환이 일관되게 적용
- [ ] 모든 API 엔드포인트에 대응하는 프론트 훅이 존재하고 실제 호출됨
- [ ] 코드 내 모든 href/router.push 값이 실제 page 파일 경로와 매칭
- [ ] 정의된 모든 상태 전이가 코드에서 실행됨 (죽은 전이 없음)
- [ ] 프론트에서 상태 기반 분기의 값이 실제 도달 가능한 상태
- [ ] DB 필드명 → API 응답 필드명 → 프론트 타입 정의 간 매핑 일관

**Findings 분류:**
- 경계면 불일치 → **P1** (런타임 에러의 주요 원인)
- 대응 파일 미존재 (API 있으나 훅 없음) → **P2**
- case 변환 비일관성 → **P2**

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

### Phase 4.5: Agent Teams — Review Debate

> **Agent Teams**: 개별 리뷰어의 발견을 팀으로 토론하여 우선순위를 검증하고 오탐을 제거합니다.
> 설정: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `teammateMode: in-process` (`~/.claude/settings.json` 전역 — postinstall 자동 설정)

**팀 구성:**

| 팀원 | 역할 |
|------|------|
| security-reviewer (리더) | P1/P2 이슈 종합, 보안 이슈 최종 판정, 합의 주도 |
| architecture-reviewer | 구조적 영향 평가, 숨겨진 결합도 식별 |
| performance-reviewer | 성능 영향 평가, 부하 시나리오 검증 |
| simplicity-reviewer | 과잉 설계 지적, 더 단순한 대안 제시 |

**실행 순서:**

1. `TeamCreate(team_name="review-debate-{feature}")` — 팀 + 공유 태스크 리스트 생성
2. 4개 팀원 병렬 생성 — 각각 `Task(team_name=..., name=..., subagent_type=...)` 으로 spawn
3. 팀원들이 공유 TaskList에서 이슈를 claim하고, SendMessage로 교차 검증
4. 리더(security-reviewer)가 팀 합의 결과 종합 → 검증된 P1/P2 목록 출력
5. 모든 팀원 shutdown_request → TeamDelete로 정리

**팀원 spawn 패턴:**

```text
TeamCreate(team_name="review-debate-{feature}", description="Review debate for {feature}")

# 4개 병렬 spawn
Task(team_name="review-debate-{feature}", name="security-reviewer", subagent_type="security-reviewer",
  mode="bypassPermissions",
  prompt="리뷰 토론 팀 리더. Phase 2에서 발견된 P1/P2 이슈를 팀과 함께 검증하세요.
  Phase 2 결과: {phase2_findings}
  역할: 보안 이슈 최종 판정, 팀원 간 우선순위 충돌 해결, 최종 합의 요약 작성.
  TaskList를 확인하고 이슈를 claim하세요. 각 이슈에 대해 팀원에게 SendMessage로 검증을 요청하세요.
  모든 이슈 검증 완료 후 최종 합의 결과를 작성하세요.")

Task(team_name="review-debate-{feature}", name="architecture-reviewer", subagent_type="architecture-reviewer",
  mode="bypassPermissions",
  prompt="리뷰 토론 팀 아키텍처 담당. Phase 2 결과: {phase2_findings}
  역할: 각 이슈의 구조적 영향 평가, 숨겨진 결합도/의존성 식별.
  아키텍처 관점에서 우선순위 변경이 필요하면 security-reviewer에게 SendMessage로 알리세요.
  TaskList에서 아키텍처 관련 이슈를 claim하세요.")

Task(team_name="review-debate-{feature}", name="performance-reviewer", subagent_type="performance-reviewer",
  mode="bypassPermissions",
  prompt="리뷰 토론 팀 성능 담당. Phase 2 결과: {phase2_findings}
  역할: 성능 영향 평가, 부하 시 cascading failure 가능성 검증.
  성능 관점에서 P2→P1 승격이 필요하면 security-reviewer에게 SendMessage로 알리세요.
  TaskList에서 성능 관련 이슈를 claim하세요.")

Task(team_name="review-debate-{feature}", name="simplicity-reviewer", subagent_type="simplicity-reviewer",
  mode="bypassPermissions",
  prompt="리뷰 토론 팀 복잡도 담당. Phase 2 결과: {phase2_findings}
  역할: 과잉 진단(오탐) 식별, 더 단순한 수정 방안 제시.
  오탐이나 P1→P2 강등이 필요하면 security-reviewer에게 SendMessage로 알리세요.
  TaskList에서 복잡도/단순화 관련 이슈를 claim하세요.")
```

**팀원 간 통신 예시:**

```text
architecture-reviewer → security-reviewer: "Unbounded query는 부하 시 cascading failure 가능. P2→P1 승격 제안"
simplicity-reviewer → security-reviewer: "CSRF on read-only endpoint는 side effect 없음. P1→P2 강등 제안"
performance-reviewer → architecture-reviewer: "N+1 query가 현재 데이터 규모에서는 영향 없으나 확장 시 문제. 의견?"
security-reviewer → broadcast: "최종 합의: SQL Injection P1 유지, Unbounded query P1 승격, CSRF P2 강등, Circular dep 오탐 제거"
```

**토론 결과 예시:**

```
🤝 REVIEW DEBATE RESULTS

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
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
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
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.validateCodeQuality({targetPath: 'src/', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**2. Analyze complexity of changed files:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.analyzeComplexity({targetPath: 'src/api/users.ts', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**3. Save critical finding for reference:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.saveMemory({key: 'review-pr123-critical', value: 'SQL injection in users.py:42', category: 'review', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

---

## Quality Gate (Mandatory)

### Review Quality Checklist

Before completing review, check P1-critical items. P2/P3 items are best-effort:

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
