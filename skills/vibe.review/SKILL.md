---
name: vibe.review
description: Multi-agent parallel code review with priority-based findings
argument-hint: "PR number, branch name, or file path"
user-invocable: true
---

# /vibe.review

**Parallel Agent Code Review** - 13+ specialists review simultaneously

## Usage

```
/vibe.review                         # Review current branch
/vibe.review PR#123                  # Review specific PR
/vibe.review feature/login           # Review specific branch
/vibe.review src/api/                # Review specific path
/vibe.review --race                  # Multi-LLM race mode (GPT + Antigravity)
/vibe.review --race security         # Race mode for specific review type
```

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## Codex Plugin Integration

> **Codex 플러그인 감지**: 워크플로우 시작 시 아래 명령으로 자동 감지.
>
> ```bash
> CODEX_AVAILABLE=$(node "{{VIBE_PATH}}/hooks/scripts/codex-detect.js" 2>/dev/null || echo "unavailable")
> ```
>
> `available`이면 `/codex:review`, `/codex:rescue` 자동 호출. `unavailable`이면 기존 GPT+Antigravity Race 모드로 동작.

## Race Mode (v2.6.9)

**Multi-LLM competitive review** - Same review task runs on GPT + Antigravity in parallel, results are cross-validated.

> Read `references/race-mode.md` for the full workflow diagram, confidence-based priority table, race mode options/output templates, Codex 3-way cross-validation, and tool invocation details.

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

Detect project tech stack FIRST before launching reviewers.

> Read `references/worked-examples.md` for the full file-to-stack detection list (package.json, pyproject.toml, Gemfile, pubspec.yaml, go.mod, CLAUDE.md).

### Phase 1.5: SPEC ↔ Code Alignment Check

> When SPEC files exist, verify that code changes align with the SPEC

```
1. Search .vibe/specs/ for related SPEC files (based on git diff filenames)
2. Compare SPEC REQ-* list against functionality in changed code
3. If functionality added that's not in SPEC → P2 finding: "Feature added without SPEC"
4. If implementation differs from SPEC → P1 finding: "SPEC ↔ code mismatch"
5. If no SPEC files exist → Skip (reviews work without SPEC too)
```

### Phase 2: Parallel Agent Review (STACK-AWARE)

**리뷰어 스케일링 (stakes × 변경 파일 수)** — stakes 정의 SSOT: `vibe/rules/loop-contract.md` Stakes 표. 위임(서브에이전트)마다 컨텍스트 재주입 비용이 발생하므로, 리뷰어 수는 태스크 무게에 비례시킨다:

| stakes | 변경 파일 | 리뷰어 셋 |
|---|---|---|
| demo | ≤5 | correctness + security **2종만** |
| demo / prototype | >5 또는 prototype | correctness + security + data-integrity **3종** |
| production | 무관 | 아래 Core Reviewers 전체 (기존 기본 동작 — 불변) |

**Spawn the reviewers as concurrent native subagents in ONE message** — one `code-reviewer` instance per focus plus `security-reviewer`, each scoped to the changed files:

```
Task (code-reviewer): "Review [FILES] — focus: correctness"      (concurrent)
Task (code-reviewer): "Review [FILES] — focus: data-integrity"   (concurrent)
Task (code-reviewer): "Review [FILES] — focus: performance"      (concurrent)
Task (code-reviewer): "Review [FILES] — focus: architecture"     (concurrent)
Task (security-reviewer): "Review [FILES] for vulnerabilities"   (concurrent)
```

Stack-specific focus (`idioms`) is added when the diff touches that stack's files. Collect all results, then dedupe/merge findings before Phase 3.

**Core Reviewers (Always Run — parallel `code-reviewer` instances, one per focus, plus `security-reviewer`):**
| Agent (focus) | Focus |
|-------|-------|
| security-reviewer | OWASP Top 10, vulnerabilities |
| code-reviewer (focus: correctness) | Logic errors, edge cases |
| code-reviewer (focus: data-integrity) | Data validation, constraints |
| code-reviewer (focus: performance) | N+1 queries, memory leaks |
| code-reviewer (focus: architecture) | Layer violations, cycles |
| code-reviewer (focus: complexity) | Cyclomatic complexity, length, over-abstraction, dead code |
| code-reviewer (focus: git-history) | Churn files, risk patterns |
| code-reviewer (focus: test-coverage) | Missing tests, edge cases |

**Stack-Specific Review (Conditional — one extra `code-reviewer` instance):**
| Agent (focus) | Condition |
|-------|-----------|
| code-reviewer (focus: idioms) | Language/framework files in diff (.py / .ts / .tsx / Gemfile rails / package.json react) — prompt states the detected stack |

### Phase 2.5: UI/UX Review Agents (Auto-triggered)

> **활성화 조건**: 변경된 파일 중 UI 파일 존재 (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`, `.scss`)
> **비활성화**: `.vibe/config.json`에 `"uiUxAnalysis": false` 설정

**기존 Phase 2 리뷰 에이전트와 병렬 실행 — `design-reviewer` 인스턴스 3개 (관점별):**

| Agent (관점) | Role | Output |
|-------|------|--------|
| ⑥ design-reviewer (UX 준수) | UX 가이드라인 준수 검증 | P1/P2/P3 findings |
| ⑦ design-reviewer (접근성) | WCAG 2.1 AA 접근성 감사 | P1/P2/P3 findings |
| ⑧ design-reviewer (안티패턴) | UI 안티패턴 + 디자인 시스템 일관성 | P1/P2/P3 findings |

**실행 방법 — 기존 Phase 2 에이전트와 병렬 실행:**

```text
# ⑥ UX 준수 검증 (Haiku)
Task(subagent_type="design-reviewer",
  prompt="Review UI files for UX guideline compliance: {changed_ui_files}. Use core_ui_search against ux-guidelines and web-interface domains.")

# ⑦ 접근성 감사 (Haiku)
Task(subagent_type="design-reviewer",
  prompt="Audit UI files for WCAG 2.1 AA compliance: {changed_ui_files}.")

# ⑧ 안티패턴 검출 (Haiku)
Task(subagent_type="design-reviewer",
  prompt="Detect UI anti-patterns in: {changed_ui_files}. Check against MASTER.md if exists at .vibe/design-system/{project}/MASTER.md.")
```

#### Visual P1 Baseline

- 프로젝트 루트에 `DESIGN.md` 가 존재하면 **시각 P1 의 1 차 baseline** 으로 사용한다 (§2 Color Palette / §7 Do's & Don'ts).
- `DESIGN.md` 부재 시 기존 폴백을 사용 (WCAG 2.1 AA + `MASTER.md` + design-review(audit 모드) 기본 5 차원).
- v1 범위: hex 컬러 드리프트만 P1 후보. spacing / font 드리프트는 Phase 2+ 에서 추가.
- 안티패턴 검출(⑧) 은 `DESIGN.md §7` 의 "DON'T" 항목을 우선 규칙으로 사용한다.

**findings 통합**: ⑥⑦⑧ findings를 기존 findings[]와 병합 → P1/P2/P3 통합 정렬

**⑦ Critical finding 에스컬레이션**: design-reviewer(접근성)의 P1 finding은 Review Debate(Phase 4.5)에 자동 포함

### Phase 2.7: Boundary Mismatch Detection (Integration Coherence)

> **활성화 조건**: 변경된 파일 중 API route + 프론트엔드 훅/컴포넌트가 함께 존재
> 경계면 불일치는 개별 파일 리뷰로는 발견 불가 — **양쪽을 동시에 읽어야** 잡힘

**검증 방법: "양쪽 동시 읽기"**

반드시 **생산자와 소비자 코드를 동시에** Read하여 교차 비교한다.

> Read `references/boundary-check.md` for the full verification-area table and checklist.

**실행 방식 — 변경 파일 기반 자동 판별:**

```text
1. git diff에서 API route 파일과 대응 프론트 파일을 짝으로 매칭
2. 짝이 있는 경우 → 아래 4개 검증 실행
3. 짝이 없는 경우 (API만 또는 프론트만 변경) → "대응 파일 미변경" 경고 후 스킵
```

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

> Read `references/output-template.md` for the full findings synthesis format.

### Phase 4.5: Review Debate (parallel native subagents)

> P1/P2 findings 를 검증하기 위해 네이티브 서브에이전트를 병렬로 스폰한다 —
> `security-reviewer` + `code-reviewer` 인스턴스(서로 다른 focus)가 각 finding 을 교차 검증(validate / upgrade / downgrade / remove)한다.

> Read `references/worked-examples.md` for the full Review Debate example output.

### Phase 5: Auto-Fix (P1/P2)

**Auto-fixable issues are resolved immediately:**

> Read `references/worked-examples.md` for the full Auto-Fix example output.

**Cases that cannot be auto-fixed:**
- Requires large-scale architecture changes
- Requires business logic decisions
- Requires user confirmation

→ Manual handling instructions in Phase 6

### Auto-Fix 실패 시 Codex Rescue (Codex 플러그인 활성화 시)

P1/P2 auto-fix **3회 실패** 시, Codex에 위임:

```
/codex:rescue "Fix {priority} issue: {issue-description}. File: {file-path}"
```

Codex 수정 완료 후 해당 리뷰 에이전트가 재검증.

### Phase 6: Todo File Creation (Items Requiring Manual Handling)

Save **remaining** findings to `.vibe/todos/`:

> Read `references/worked-examples.md` for the Todo file naming example.

## Output

> Read `references/output-template.md` for the full review summary output format.

### Phase 7: Guide to Fix Workflow (Manual Handling Items)

**Choose workflow when handling remaining issues:**

> Read `references/output-template.md` for the full Fix Workflow prompt template.

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
| `saveMemory` | Save findings | Store important review findings |

> Read `references/worked-examples.md` for example tool usage in review (validateCodeQuality, analyzeComplexity, saveMemory).

---

## Quality Gate (Mandatory)

Before completing review, check P1-critical items (P2/P3 are best-effort). Score = 100 - (P1 × 20) - (P2 × 5) - (P3 × 1). **P1 = 0 required for MERGE READY.**

> Read `references/quality-gate.md` for the full weighted checklist, score grades, merge decision matrix, auto-fix capability matrix, forbidden-patterns table, and output requirements.

---

ARGUMENTS: $ARGUMENTS
