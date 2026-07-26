---
name: vibe.run
description: 승인된 SPEC이 있고 구현을 시작할 때 — `.vibe/specs/<feature>.md`를 읽어 코드와 검증 산출물로 전개한다.
argument-hint: '"feature name" or --phase N'
user-invocable: true
---

# /vibe.run

## 완료 기준

- [ ] 구현 요구사항이 승인된 SPEC의 REQ ID로 추적된다.
- [ ] 변경 범위에 존재하는 build, lint, typecheck, test gate가 통과한다.
- [ ] run ledger에 검증 결과와 exit code가 기록되어 있다.
- [ ] 미완료 요구사항이 있으면 TODO와 사유가 기록되어 있다.

Execute **Scenario-Driven Implementation** with automatic quality verification.

> **Core Principle**: Scenarios are both the implementation unit and verification criteria. All scenarios passing = Quality guaranteed.

## Usage

```
/vibe.run "feature-name"              # Full implementation (loops to convergence)
/vibe.run "feature-name" --phase 1    # Specific Phase only
/vibe.run "feature-name" --interactive  # Step-by-step confirmation per iteration
/vibe.run "feature-name" --max-iter 1   # Single-pass (no loop)
/vibe.run "feature-name" ultrawork    # deprecated alias: automationLevel autonomous + parallel
/vibe.run "feature-name" ulw          # deprecated alias: same as ultrawork
```

---

> **Timer**: Query the system clock at START and record the result as `{start_time}`.

> **Step Counter Reset (MANDATORY at START)**: Run this Bash command once at the very start:
>
> ```bash
> mkdir -p .vibe/metrics && printf '{"feature":"%s","startedAt":"%s","steps":0}\n' "{feature-name}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .vibe/metrics/current-run.json
> ```

## File Reading Policy (Mandatory)

> 규칙은 **전체 읽기**이지 특정 도구 이름이 아니다. 하네스가 제공하는 파일 읽기 수단을 쓴다 — Claude Code 는 `Read` 도구, Codex 는 셸(`cat`/`sed -n`) 등. 도구 이름이 없다고 규칙을 건너뛰지 않는다.

- **SPEC/Feature 파일**: 전체를 읽는다 (검색 결과 일부만 보고 판단 금지)
- **소스코드 파일**: 구현/수정 대상 파일은 전체를 읽은 후 작업한다
- **검색 도구 사용 제한**: grep/ripgrep 류는 **파일 위치 탐색**(어떤 파일에 있는지)에만 쓴다. 내용 파악은 전체 읽기로 한다
- **에이전트 실행 시**: 프롬프트에 "대상 파일을 전체 읽은 후 구현하라"를 포함한다

## **Scenario-Driven Development (SDD)**

> Automate **Scenario = Implementation = Verification** so even non-developers can trust quality

### Pre-Run Regression Check (MANDATORY, before implementation starts)

```
Load skill `vibe.regress` with: list --feature "{feature-name}"
```

- Open regressions exist → automationLevel confirm: ask user; autonomous: auto-invoke `/vibe.regress generate <slug>`
- No open regressions → silently continue

Also load `.vibe/contracts/{feature-name}.md` if present — use it as the contract reference during implementation.

### DESIGN.md Gate (UI stack only, before Phase 1)

```bash
test -f DESIGN.md
```

- **DESIGN.md present OR no UI stack** → silently continue
- **DESIGN.md absent AND UI stack present**:
  - automationLevel confirm: 한 줄 안내 — "UI 작업에 `DESIGN.md` 시각 SSOT 가 없습니다. `/vibe.design init` 으로 생성하면 시각 드리프트가 자동 검출됩니다. (생략 가능 — 1 회만 안내)"
  - automationLevel autonomous: 무음 스킵

> **권유 > 강제**. DESIGN.md 부재는 절대 vibe.run 을 블록하지 않는다.

### Core Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCENARIO-DRIVEN IMPLEMENTATION                │
│                                                                  │
│   Load Feature file                                              │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario 1: Happy Path                                    │  │
│   │   Given → When → Then                                     │  │
│   │        ↓                                                  │  │
│   │   [Implement] → [Verify immediately] → Pass               │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario 2: Edge Case                                     │  │
│   │   [Implement] → [Verify] → Fail → [Fix] → Pass            │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   [Quality Report: Scenarios N/N passed]                        │
└─────────────────────────────────────────────────────────────────┘
```

> **하네스-안전 증분 (Dual-Harness Doctrine)**: 시나리오는 **가장 작은 검증 단위**다. 한 시나리오 구현 → 즉시 검증 → 다음. `automationLevel: autonomous`이라도 이 단위는 무너뜨리지 않는다 (병렬은 시나리오 간, 검증은 시나리오별). 전문: `vibe/rules/principles/dual-harness-doctrine.md`.

### Automated Verification (Closed Loop)

After implementing each scenario, **automatic verification**:

| Verification Item | Auto Check | Method |
|-------------------|------------|--------|
| Given (precondition) | State/data preparation confirmed | Code analysis |
| When (action) | Feature execution possible | Code analysis + Build |
| Then (result) | Expected result matches | Code analysis + Test |
| Code quality | Complexity, style, security | Static analysis |
| **UI behavior** | **실제 브라우저에서 동작 확인** | **E2E Closed Loop** |

> **E2E Closed Loop (UI 시나리오) 와 실패 시 Auto-Fix 절차**: `references/e2e-and-autofix.md`

## **ULTRAWORK Mode** (ulw) — deprecated alias

> 루프 시맨틱은 `vibe/rules/loop-contract.md`를 따른다. `ultrawork`/`ulw`는 `automationLevel: autonomous` + 병렬 ACT의 deprecated 별칭이다.
> 전체 Boulder Loop 다이어그램, automation level 정의, confirmation matrix: `references/ultrawork-mode.md`

`ultrawork` 또는 `ulw` 포함 시 vibe.run-specific 동작:
- 병렬 탐색 (3+ Task agents 동시)
- 비대화형 (중단점 없음)
- Race Review (GPT+Antigravity) 기본 활성화
- stuck 시 TODO 기록 후 다음 시나리오로 (사용자 질문 없음)

---

## Stakes 프로파일 (실행 강도 조절)

**Stakes 프로파일 (SSOT: `vibe/rules/loop-contract.md` Stakes 표):**
- `demo`/`prototype` → max_iterations 1, 리뷰 1패스, **검증 스크립트 신규 생성 금지** — 검증은 기존 테스트 러너·브라우저 게이트만 사용한다. 새 verify_*.py / 검증 전용 스크립트 파일을 만들지 않는다.
- JUDGE 검증 산출물 절제 (모든 stakes): 이번 feature 신규 검증 코드 바이트 합이 신규 구현 코드 바이트 합을 초과하면 (`git diff --numstat` 기준) P2 경고를 run-ledger 에 기록한다. advisory — 게이트 통과 여부는 불변.
---

## Scope & Ledger Rules

### Run Ledger Tracking

Every `/vibe.run` invocation must explicitly initialize `.vibe/metrics/run-ledger.json` (fields: `runStarted`, `runFeature`, `verifyPassed`, `verifyAt`) and reset `verifyPassed` to `false`. Before completion, invoke `/vibe.verify`; its `verify-ledger.js` step must record `verifyPassed`, `verifyAt`, and command evidence, then read the ledger back and enforce `verifyPassed === true && verifyAt > runStarted`. Stop/auto-commit hooks may warn or short-circuit this sequence when available, but they are acceleration only and never the correctness basis.

### Interactive Checkpoints

Checkpoints are decision gates inserted at critical points. At L3/L4, most are **auto-resolved** using the default option.

| Type | When It Fires | Default Option |
|------|--------------|----------------|
| `requirements_confirm` | Before starting Phase 1 | Confirm (a) |
| `architecture_choice` | When architecture approach is ambiguous | Clean/balanced (b) |
| `implementation_scope` | Before any large scope change (6+ files) | Approve (a) |
| `fix_strategy` | When critical issues are found during quality gate | Fix all (a) |

Checkpoint format example:
```
──────────────────────────────────────────────────
CHECKPOINT: Requirements Confirmation
──────────────────────────────────────────────────
Options:
  a) Confirm — Proceed as stated.
  b) Revise — Modify before proceeding.
  c) Abort — Cancel.
Default: a
──────────────────────────────────────────────────
```

---

## Process

### Process 단계 (전체 절차: `references/process-steps.md`)

| # | 단계 | 핵심 게이트 |
|---|---|---|
| 1 | Load SPEC + Feature | SPEC 부재 시 진행 금지 |
| 1-0 | Compile + validate execution packet | **MANDATORY** — 컴파일 실패 시 중단 (`references/exec-plan.md`) |
| 1-1 | Phase Isolation Protocol | 3+ phase SPEC 은 phase 단위 격리 + 체크포인트 필수 |
| 1-2 | SPEC-First Gate | SPEC 에 없는 것을 구현하지 않는다 |
| 2 | Extract Scenario List | Feature 파일의 시나리오가 작업 단위 |
| 3 | Scenario-by-Scenario Implementation | 기본 순차. **구현→검증 쌍은 시나리오 단위로 쪼개지 않는다**. `autonomous` 에서 서로 의존하지 않는 시나리오는 병렬 가능하되 검증은 시나리오별로 각각 (SSOT: 위 "하네스-안전 증분") |
| 4 | Brand Assets | 신규 프로젝트만 (`references/brand-assets.md`) |
| 5 | Race Code Review | `references/race-review.md` |
| 6 | Quality Report | 자동 생성 |
| 7 | Update Feature File | 시나리오 상태 반영 |
| 8 | Coverage Verification Loop (RTM) | 커버리지 미달 시 루프 |

> 도구·코딩 가이드라인·TRUST 5·자동 회고: `references/guidelines-and-tools.md`

### 1-0. Execution packet (MANDATORY — 본문 유지)

단일 SPEC 은 canonical path 해석 후 컴파일한다. 분할 SPEC 은 `_index.md` 를 컴파일하지 않고, Phase Isolation Step B 에서 각 활성 phase 파일이 로드될 때까지 미룬다.
`writeExecutionPacket` 으로 컴파일한 뒤 **즉시** `validateExecutionPacket` 으로 저장 산출물을 검증한다.
`STALE_PACKET`·invalid packet·preservation-audit 실패·budget 실패는 **blocking** 이다 — canonical SPEC 에서 재컴파일하며, 검증되지 않은 패킷으로 조용히 폴백하지 않는다.

> 전체 절차와 코드: `references/exec-plan.md` · `references/process-steps.md`

## Input / Output

**Input:** `.vibe/specs/{feature-name}.md`, `.vibe/features/{feature-name}.feature`, `CLAUDE.md`

**Output:** Implemented code files, test files, updated SPEC (checkmarks)

---

## Next Step

```
/vibe.verify "feature-name"
```

---

ARGUMENTS: $ARGUMENTS

## Bundled internals (조건부 로드)

이 세 구현은 `vibe.run` 의 일부지만 **매 실행에 전부 필요하지는 않다.** 해당 조건에 걸릴 때만 읽는다 —
세 개를 항상 로드하면 호출당 컨텍스트의 약 45%가 쓰이지 않을 자료로 채워진다.

| 내부 구현 | 로드 조건 | 본문 |
|---|---|---|
## Bundled internal: arch-guard

번들 유지 — 별도 discovery 항목으로 노출하지 않는다. 본문: `references/arch-guard.md`
## Bundled internal: exec-plan

번들 유지 — 별도 discovery 항목으로 노출하지 않는다. 본문: `references/exec-plan.md`
## Bundled internal: restraint

번들 유지 — 별도 discovery 항목으로 노출하지 않는다. 본문: `references/restraint.md`

| **arch-guard** | 아키텍처 경계 테스트를 생성·검증할 때 (레이어 위반 감지가 필요한 SPEC) | `references/arch-guard.md` |
| **exec-plan** | Step 1-0 — execution packet 을 컴파일할 때 | `references/exec-plan.md` |
| **restraint** | 아래 요약으로 판단이 서지 않을 때 (전문: 사다리 단계별 근거·차단 충동 목록) | `references/restraint.md` |

**restraint 요약 (항상 적용 — 상세는 위 reference):**

```
YAGNI 사다리: 지금 필요한가? → 아니면 쓰지 않는다.
  추상화는 3번째 중복에서. 설정 항목은 2번째 요구에서. 플러그인 구조는 외부 사용자가 생겼을 때.

Pike 규칙: 측정 없이 최적화하지 않는다. 한 부분이 나머지를 압도하지 않으면 튜닝하지 않는다.
  n 은 대체로 작다. 단순한 코드가 영리한 코드를 이긴다. 데이터가 지배한다.

Restraint 가 무효화하지 못하는 것: 정확성 · 보안 · 데이터 무결성 · 사용자가 명시적으로 요청한 것
```
