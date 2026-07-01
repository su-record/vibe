---
name: spec
description: 단일 패스 SPEC 작성 본체 — 자연어 요구사항(+첨부) → 필요할 때만 인라인 명확화 질문 → .vibe/specs/{feature}.md + .vibe/features/{feature}.feature 를 한 번에 생성 → 1회 셀프 리뷰 → SPEC 승인(유일한 의무 게이트).
when_to_use: /vibe.spec 진입점 또는 /vibe 파이프라인의 spec 단계에서 호출. 직접 호출 금지 — /vibe.spec 사용.
user-invocable: false
tier: core
---

# spec — Single-Pass SPEC

자연어 요구사항 하나를 받아 **한 번의 패스로** 실행 가능한 SPEC을 만든다. 별도의 interview → plan → review 단계는 없다 — 질문이 필요하면 이 패스 안에서 인라인으로 묻고, 리뷰는 셀프 리뷰 1회로 끝낸다. 완성된 SPEC의 승인이 loop-contract 가 정의하는 **유일한 의무적 사람 개입 지점**이다.

> 루프 시맨틱 SSOT: `vibe/rules/loop-contract.md`. SPEC = ANCHOR 아티팩트, Done Criteria = JUDGE 게이트.

## Input

| 입력 | 처리 |
|---|---|
| 자연어 요구사항 | 그대로 SPEC 패스의 주 입력 |
| 📎 첨부 (md/txt/pdf/이미지 등) | Read 도구로 분석 후 요구사항에 병합 |
| 파일 경로 인자 (PRD 등) | 존재 확인 후 Read — 첨부와 동일 취급 |
| **레거시 아티팩트** `.vibe/interviews/{feature}.md`, `.vibe/plans/{feature}.md` | 존재하면 **입력 컨텍스트로만** 읽는다. 절대 요구하거나 재생성하지 않는다 — 없어도 정상 경로 |

## Process

### 1. Git branch + pointer

- `git branch --show-current` — `main`/`master` 이면 `git checkout -b feature/{feature-name}` (소문자·하이픈). feature 브랜치면 그대로 진행.
- feature 이름 확정 즉시 `.vibe/.last-feature` 에 이름 한 줄 기록 (값이 같으면 no-op).

### 2. Project context

- `.vibe/config.json` 읽기 — `references.languages[]` 의 스택 가이드, `stacks` 확인.
- 기존 코드 파악이 필요하면 explorer agent 에 위임 (main session 에서 프로젝트 파일을 훑지 않는다):

```text
Task(subagent_type="explorer-low",
  prompt="Find existing implementations related to [FEATURE]. Return: tech stack, relevant files, patterns. Under 200 tokens.")
```

### 3. Clarify — 진짜 모호할 때만

별도 인터뷰 단계가 아니다. 요구사항·첨부·레거시 아티팩트·코드베이스 컨텍스트로 답을 합리적으로 정할 수 있으면 **묻지 않는다**. 다음 조건을 모두 만족할 때만 질문한다:

- 답에 따라 Done Criteria 나 구현 방향이 실제로 갈라진다 (인증 방식, 데이터 모델의 필수 필드, 외부 연동 여부 등)
- 합리적 기본값을 SPEC 의 Assumptions 로 명시하는 것으로 대체할 수 없다

질문할 때는 **한 번에 묶어서** (번호 목록, 최대 5개), 각 질문에 제안 기본값을 붙인다. `automationLevel: autonomous` 면 질문 없이 기본값을 채택하고 전부 SPEC 의 Assumptions 섹션에 기록한다.

사소한 값(타임아웃, 페이지 크기, 재시도 횟수 등)은 묻지 말고 상식적 기본값을 채택 + Assumptions 에 기록.

### 4. Write SPEC — one pass

`vibe/templates/spec-template.md` 구조로 `.vibe/specs/{feature-name}.md` 를 작성한다. 핵심 요건:

- **Overview / Goal** — 무엇을, 왜. 1-3 문장.
- **Done Criteria** — 결정론적 게이트만. 각 항목은 "명령/관찰로 pass·fail 판정 가능"해야 한다 (테스트 exit code, 빌드 성공, 특정 동작 관찰). "잘 동작한다" 류 서술 금지 — 이것이 루프의 JUDGE 입력이 된다.
- **Scenarios** — Given-When-Then. Happy path + 주요 edge case. 각 시나리오는 Done Criteria 중 하나에 매핑.
- **Out of Scope** — 이번에 하지 않는 것을 명시 (비어 있으면 스코프 팽창 신호).
- **Assumptions** — 3단계에서 채택한 기본값 전부.
- **API Contract** (해당 시에만) — 엔드포인트/요청/응답 형태. 이 섹션이 있으면 이후 `/vibe.contract` 가 drift 를 검사한다.

이어서 `.vibe/features/{feature-name}.feature` 를 생성한다: 시나리오 섹션을 gherkin 으로 변환 (Done Criteria ↔ Scenario 매핑 유지). `/vibe.run` 이 이 파일을 구현·검증 단위로 사용한다.

**Large scope** (5+ phases 또는 15+ 신규 파일 또는 4+ 독립 기능): 폴더 분할 — `.vibe/specs/{feature}/_index.md` + `phase-N-{name}.md`, feature 파일도 동일 구조로 매칭. 조용히 분할하고 결과만 보고한다.

**파일 규칙**: `.vibe/` 밖에 파일을 만들지 않는다. SPEC 파일마다 매칭되는 Feature 파일이 있어야 한다.

### 5. Self-review — once

작성 직후, 아래 체크리스트로 자기 SPEC 을 **1회** 점검하고 걸리는 항목을 즉시 고친다. 외부 LLM 리뷰 없음, 수렴 루프 없음 — 한 번 고치면 끝.

- [ ] 모든 Done Criteria 가 명령/관찰로 판정 가능한가 (모델 자기 보고가 아닌)
- [ ] 모든 시나리오가 Done Criteria 에 매핑되는가 (고아 시나리오 없음)
- [ ] 수치가 필요한 곳에 수치가 있는가 (제한·타임아웃·크기 — 없으면 기본값 + Assumptions)
- [ ] Out of Scope 가 비어 있지 않은가
- [ ] 요구사항에 있던 것 중 SPEC 에서 빠진 것이 없는가

### 6. Approval — the single gate

SPEC 요약(Goal, Done Criteria, 시나리오 수, Out of Scope, 열린 Assumptions)을 제시하고 승인을 받는다:

```
📋 SPEC 준비 완료: {feature-name}
   .vibe/specs/{feature-name}.md · .vibe/features/{feature-name}.feature

   Goal: {1줄}
   Done Criteria: {N}개 (전부 결정론 게이트)
   Scenarios: {M}개 · Out of Scope: {K}항목
   Assumptions: {요약 또는 "없음"}

승인하면 이 SPEC 이 루프의 Done 정의가 됩니다.
[1] 승인 → 구현 진행   [2] 수정 요청   [3] 중단
```

- 수정 요청 → 반영 후 재제시 (사용자 주도 반복 — 자동 루프 아님).
- `automationLevel: autonomous` → 승인 생략, 요약만 출력하고 진행.
- 승인 후 SPEC 변경은 코드 변경과 같은 커밋으로 (SPEC-First — `vibe.run` 참조).

## Output

| 파일 | 경로 |
|---|---|
| SPEC | `.vibe/specs/{feature-name}.md` (또는 분할 폴더) |
| Feature (BDD) | `.vibe/features/{feature-name}.feature` (또는 분할 폴더) |
| Pointer | `.vibe/.last-feature` |

승인된 SPEC 은 루프의 ANCHOR 로 쓰인다: `/vibe.run` 이 시나리오 단위로 구현·검증하고, `/vibe.verify` 가 Done Criteria 를 판정해 `.vibe/metrics/run-ledger.json` 의 `verifyPassed` 를 기록한다. 게이트 통과 여부는 항상 run-ledger·테스트 exit code 가 판정한다.

## Next Step

```
/vibe.run "{feature-name}"
```

---

ARGUMENTS: $ARGUMENTS
