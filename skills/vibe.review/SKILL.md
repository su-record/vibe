---
name: vibe.review
description: Use when changed code or a SPEC needs a pre-merge review for defects, security risks, boundary mismatches, and zero remaining P1 findings.
argument-hint: "PR number, branch name, or file path"
user-invocable: true
---

# /vibe.review

**Parallel Agent Code Review** — focus 별 전문 리뷰어를 **가능한 범위에서 병렬로, 나머지는 순차로** 실행 (production 기본 셋 8종 + 조건부)

## Usage

```
/vibe.review                         # Review current branch
/vibe.review PR#123                  # Review specific PR
/vibe.review feature/login           # Review specific branch
/vibe.review src/api/                # Review specific path
/vibe.review --race                  # Multi-LLM race mode (GPT + Antigravity)
/vibe.review --race security         # Race mode for specific review type
/vibe.review priority-todos          # Organize findings/tasks as P1/P2/P3 TODOs
```

> **⏱️ Timer**: Query the system clock at START and record the result as `{start_time}`.

## Codex Plugin Integration

> **Codex 플러그인 감지**: 워크플로우 시작 시 아래 명령으로 자동 감지.
>
> ```bash
> CODEX_AVAILABLE=$(node "{{VIBE_PATH}}/hooks/scripts/codex-detect.js" 2>/dev/null || echo "unavailable")
> ```
>
> `available`이면 Codex 플러그인의 review/rescue 명령을 사용하고, `unavailable`이면 GPT+Antigravity Race 모드로 동작한다.
>
> ⚠️ **명령 이름을 가정하지 않는다.** 과거 본문은 `/codex:review`·`/codex:rescue` 를 고정 호출했으나, 이는 특정 플러그인 설치본에만 존재하는 표면이다. 실제 사용 가능한 명령을 확인한 뒤 쓰고, 없으면 Race 모드로 폴백한다 — 존재하지 않는 슬래시 명령을 실행하려 시도하지 않는다.

## Race Mode (v2.6.9)

**Multi-LLM competitive review** - Same review task runs on GPT + Antigravity in parallel, results are cross-validated.

> Read `references/race-mode.md` for the full workflow diagram, confidence-based priority table, race mode options/output templates, Codex 3-way cross-validation, and tool invocation details.

## File Reading Policy (Mandatory)

> 규칙은 **전체 읽기**이지 특정 도구 이름이 아니다. 하네스가 제공하는 파일 읽기 수단을 쓴다 — Claude Code 는 `Read` 도구, Codex 는 셸(`cat`/`sed -n`) 등. 도구 이름이 없다고 규칙을 건너뛰지 않는다.

- **소스코드 파일**: 리뷰 대상 파일은 전체를 읽은 후 리뷰한다 (검색 결과만 훑어보고 판단 금지)
- **검색 도구 사용 제한**: grep/ripgrep 류는 **파일 위치 탐색**에만 쓴다. 내용 파악과 리뷰는 전체 읽기로 한다
- **에이전트 실행 시**: 프롬프트에 "대상 파일을 전체 읽은 후 분석하라"를 포함한다
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
- Infinite retries on auto-fix failure → **escalation ladder**: 최초 시도 → 재시도 1회 → (Codex 플러그인 있으면) Codex Rescue 1회 → TODO. 같은 방식으로 계속 재시도하지 않는다

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

**Spawn one reviewer per focus, as concurrently as the harness allows** — a `code-reviewer` instance per focus plus `security-reviewer`, each scoped to the changed files.

호출 계약(하네스 무관): "에이전트 `{agent}` 를 인자 `Review {FILES} — focus: {focus}` 로 실행한다"

```
run agent code-reviewer      args: "Review {FILES} — focus: correctness"
run agent code-reviewer      args: "Review {FILES} — focus: data-integrity"
run agent code-reviewer      args: "Review {FILES} — focus: performance"
run agent code-reviewer      args: "Review {FILES} — focus: architecture"
run agent security-reviewer  args: "Review {FILES} for vulnerabilities"
```

| 하네스 | 실행 방식 |
|---|---|
| Claude Code | 네이티브 서브에이전트를 **한 메시지에 모두** 스폰 (동시 실행) |
| Codex | 동시 슬롯 한도 내에서 스폰하고, 남는 focus 는 **순차 실행**한다 |

> **동시 슬롯이 focus 수보다 적으면 focus 를 버리지 말고 순차로 돌린다.** 커버리지가 동시성보다 우선이다 — 리뷰 축을 조용히 빠뜨리면 P1 을 놓친다. 스킵한 focus 가 있으면 최종 보고에 명시한다.

Stack-specific focus (`idioms`) is added when the diff touches that stack's files. Collect all results, then dedupe/merge findings before Phase 3.

**Core Reviewers (production stakes 의 기본 셋 — `code-reviewer` 를 focus 별로 하나씩 + `security-reviewer`):**

> demo/prototype 에서는 위 리뷰어 스케일링 표의 축소 셋만 실행한다. 이 표는 **production 의 전체 셋**이며 "무조건 8개 전부"라는 뜻이 아니다 — stakes 판정이 셋 크기를 결정한다 (SSOT: `vibe/rules/loop-contract.md` Stakes 표).
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

### Phase 2.5: UI/UX Review Agents (조건부)

> **활성화 조건**: 변경된 파일 중 UI 파일 존재 (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`, `.scss`)
> **비활성화**: `.vibe/config.json` 에 `"uiUxAnalysis": false`

조건에 걸리면 `references/ui-ux-review.md` 를 읽어 `design-reviewer` 3개 관점을 Phase 2 와 병렬 실행한다.
UI 파일이 없으면 이 Phase 전체를 건너뛴다 — reference 도 읽지 않는다.

### Phase 2.7: Boundary Mismatch Detection (Integration Coherence)

> **활성화 조건**: 변경된 파일 중 API route + 프론트엔드 훅/컴포넌트가 함께 존재
> 경계면 불일치는 개별 파일 리뷰로는 발견 불가 — **양쪽을 동시에 읽어야** 잡힘

**검증 방법: "양쪽 동시 읽기"**

생산자와 소비자 코드를 **같은 판단 안에서 함께** 읽어 교차 비교한다 (한쪽만 읽고 판단 금지). 두 파일을 동시에 열 도구가 없어도 규칙은 유효하다 — 순서대로 전체를 읽은 뒤 비교하면 된다.

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

P1/P2 auto-fix 가 **재시도 1회까지 실패**하면(= 시도 2회), TODO 로 내리기 전에 Codex 에 **1회** 위임한다 — escalation ladder SSOT: 위 Anti-Patterns.

위임 요청 내용(호출 표면 무관):

```
Fix {priority} issue: {issue-description}. File: {file-path}
```

이 요청을 Codex 플러그인이 **실제로 제공하는** rescue/review 명령으로 전달한다. 제공 명령을 확인할 수 없으면 위임을 건너뛰고 바로 TODO 로 내린다 — 존재하지 않는 슬래시 명령을 실행하려 시도하지 않는다 (위 "명령 이름을 가정하지 않는다").

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
- If user chooses VIBE → wait for the user to invoke the `vibe.spec` skill
- If user chooses Plan Mode → enter the harness's plan/read-only mode if it has one (Claude Code: plan mode). **하네스에 등가 모드가 없으면**(Codex 등) 모드 전환 대신 "계획만 제시하고 사용자 승인 전까지 파일을 수정하지 않는다"를 그대로 지킨다 — 없는 모드를 호출하려 시도하지 않는다.

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

## Priority TODO Mode

For `priority-todos` mode, or when review findings must be persisted as a
P1/P2/P3 board, read `references/priority-todos.md`. Preserve its priority
definitions, index/update behavior, output paths, and completion criteria.

---

ARGUMENTS: $ARGUMENTS

## 리뷰어 스케일링

Stakes SSOT는 `vibe/rules/loop-contract.md` Stakes 표다.

| stakes | 변경 파일 | reviewer set |
|---|---|---|
| demo | ≤5 | correctness + security 2종 |
| demo / prototype | >5 또는 prototype | correctness + security + data-integrity 3종 |
| production | any | Core Reviewers 전체 |

Production Core Reviewers는 `security-reviewer`와 `code-reviewer`의 다음 focus를 모두 유지한다: `focus: correctness`, `focus: data-integrity`, `focus: performance`, `focus: architecture`, `focus: complexity`, `focus: git-history`, `focus: test-coverage`.

## Done Criteria

- [ ] Every finding has P1/P2/P3 severity and `file:line` evidence.
- [ ] Duplicate findings are merged into one canonical item.
- [ ] Relevant tests and static checks pass for modified files.
- [ ] A MERGE READY result has zero P1 findings.
- [ ] Manual items are persisted in the specified TODO artifact.

ARGUMENTS: $ARGUMENTS
