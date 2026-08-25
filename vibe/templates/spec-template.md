# SPEC: {Feature Name}

- **Created**: {YYYY-MM-DD}
- **Status**: DRAFT | APPROVED
- **Stakes**: demo | prototype | production — {판정 근거 1구} (SSOT: vibe/rules/loop-contract.md)
- **Tech Stack**: {Project tech stack summary}

---

## 1. Overview / Goal

{What and why — 1-3 sentences.}

### Context Sources

각 항목에 **근거 등급**을 붙인다. 셋이 같은 글머리표로 섞이면 리뷰어가 해석을
확인으로 읽고, 틀린 전제 위에 구현이 쌓인다.

| 등급 | 뜻 | 함께 적을 것 |
|---|---|---|
| `[확인]` | 코드·문서에서 직접 읽었다 | 파일 경로 + 함수/섹션 이름 |
| `[해석]` | 읽은 것에서 추론했다 | 무엇에서 왜 그렇게 읽었는지 한 줄 |
| `[모름]` | 확인하지 못했다 | 왜 못 했는지, 무엇이 있어야 알 수 있는지 |

- [확인] {`src/auth/session.ts:createSession` — 만료 24h 상수}
- [해석] {세션 갱신 경로가 없다 — 갱신 함수도 호출부도 찾지 못했다}
- [모름] {동시 로그인 정책 — 코드에 흔적 없음, 제품 결정이 필요하다}

> `[모름]` 이 있는 것 자체는 결함이 아니다 — 모른다고 적는 편이 모르는 채로
> 확언하는 것보다 낫다. 다만 그 항목이 요구사항의 전제라면 Assumptions 로
> 내리거나 인라인 질문으로 올린다.

### Assumptions

- {Default adopted without asking — e.g., session expiry 24h}

### Constraints

- {Invariant or implementation boundary that every execution packet must preserve}

### Structure (경계가 바뀔 때만)

> 아래 셋 중 **하나라도** 해당하면 채운다. 아니면 이 절을 통째로 지운다 —
> 해당 없는데 그려두면 통과 의식이 되고, 시각적 완성도가 정확성을 착각하게 만든다.
>
> 1. 새 모듈·서비스 **경계**를 만든다
> 2. **데이터 흐름**이 바뀐다 (읽고 쓰는 주체나 순서)
> 3. **3개 이상 모듈**을 횡단한다
>
> 규범은 `vibe.docs` 의 `references/diagram-spec.md` 를 따른다 — 코드에서 확인한
> 것만 그리고, 확인 못 한 요소는 뺀다. 여기에 다시 적지 않는다(SSOT).
>
> 목적은 설명이 아니라 **리뷰 표면**이다. 산문으로는 "박스가 빠졌다 / 화살표가
> 거꾸로다" 가 안 보이지만 그림에서는 승인 전에 보인다.

```mermaid
graph TB
  {노드와 간선 — 각 노드 옆에 근거 파일 경로를 주석으로}
```

### Rejected Alternatives (Traps)

> Approaches considered and rejected, each with a mechanistic reason — so the loop never revisits a dead end. Omit only when no real design choice existed (or on demo/prototype stakes).

- {Rejected approach} — {mechanistic reason it fails, e.g., "shelve is not thread-safe under multi-writer load", not a vague label like "doesn't scale"}

---

## 2. Requirements

| ID | Requirement | Done Criteria |
|----|-------------|---------------|
| REQ-{feature}-001 | {Observable functional requirement} | D1, D2 |

---

## 3. Done Criteria (deterministic gates)

> Each criterion must be judgeable by a command or observable behavior — never by self-report.
> These are the JUDGE inputs of the loop (`vibe/rules/loop-contract.md`); `/vibe.verify` records the result in `.vibe/metrics/run-ledger.json`.

| # | Criterion | Verified by |
|---|-----------|-------------|
| D1 | {e.g., all scenarios in the feature file pass} | {e.g., `npx vitest run` exit 0} |
| D2 | {e.g., build succeeds with no type errors} | {e.g., `npm run build` exit 0} |

### Evidence Required

- D1 → {Command result, test report, log, screenshot, or verified code location}
- D2 → {Evidence required for this specific criterion}

### Human Taste (Non-Blocking)

- {UX, brand, or product-quality review reserved for the release decision; never a loop completion gate}

---

## 4. Scenarios

> Mirrored to `.vibe/features/{feature}.feature` (gherkin). Every scenario maps to a Done criterion.

```gherkin
Scenario: {Happy path title}          # → D1
  Given {precondition}
  When {action}
  Then {expected result}

Scenario: {Edge case title}           # → D1
  Given {precondition}
  When {action}
  Then {expected result}
```

---

## 5. Out of Scope

- {Explicitly not doing this time — must not be empty}

---

## 6. API Contract (only if the feature exposes an API)

> Presence of this section enables `/vibe.contract` drift detection.

```text
POST /api/v1/{resource}
Request: {...}
Response: 201 {...}
```

---

## 7. Verification

- `/vibe.run "{feature}"` implements scenario-by-scenario, verifying each immediately.
- `/vibe.verify "{feature}"` judges the Done Criteria and sets `verifyPassed` in the run-ledger.
- Verification writes `.vibe/runs/{run-id}/evidence.json`; only deterministic Judge results can complete the loop.
- Model Judge findings are advisory-only. Human Taste is release-only.
- Gate = all Done Criteria pass (exit codes / observed behavior) — loop continues until gates pass, stuck, or max iterations.
