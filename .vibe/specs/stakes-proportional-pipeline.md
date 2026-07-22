# SPEC: Stakes-Proportional Pipeline

- **Created**: 2026-07-22
- **Status**: APPROVED (2026-07-22) · Implemented · D1~D6 gates passed
- **Tech Stack**: Markdown (skill bodies), TypeScript (static contract tests), Vitest

---

## 1. Overview / Goal

vibe 파이프라인이 태스크의 무게(stakes)를 판정해 실행 깊이를 비례시킨다. 데모·프로토타입·일회성 태스크에 production급 파이프라인(다단계 Phase + 리뷰어 8종 + 수렴 루프 + 검증 스크립트 생성)을 쓰지 않게 하여, 경량 태스크의 소요 시간을 구조적으로 줄인다. production 기본 동작은 변경하지 않는다.

### Context Sources

- 헤드투헤드 실측 (2026-07-22, `~/repos/test/`): 동일 과제에서 codex exec 9분 vs vibe 파이프라인 129분. 시간 배분 — SPEC 11분 / Phase 1~3 구현 68분 / Phase 4 검증 루프 50분. 일회성 데모 정적 사이트에 검증 스크립트 55KB(`verify_site.py` 25KB + `verify_data.py` 16KB + `generate_demo_data.py` 13KB) 신규 생성, 리뷰어 8종 병렬 가동 관측
- `skills/vibe/SKILL.md` — Phase 1 Intent 분류 (stakes 축 부재)
- `skills/vibe.review/SKILL.md` — Core Reviewers "Always Run" 목록 (스케일링 규칙 부재)
- `vibe/rules/loop-contract.md` — ANCHOR→ACT→JUDGE→RECORD 계약 (JUDGE에 산출물 절제 기준 부재)
- `skills/vibe.run/SKILL.md` — ACT 실행 규칙
- `skills/vibe.spec/SKILL.md` — SPEC 승인 게이트 (stakes 불확실 시 질문 삽입 지점)
- `src/__tests__/wiring-integrity.test.ts` — 스킬 본문 정적 계약 테스트 선례

### Assumptions

- stakes 는 3단계: `demo`(일회성·실험·데모·학습), `prototype`(검증용 초기 버전, 유지보수 가능성 있음), `production`(기본값 — 불확실하면 상향)
- demo 판정 신호: 요구사항의 명시 키워드(데모/일회성/실험/테스트용/throwaway/토이), 산출물이 기존 프로젝트 코드와 무관한 신규 폴더, `.vibe/config.json` 없는 임시 디렉토리
- 검증/구현 코드 비교는 **이번 feature 에서 신규 생성된 파일의 바이트 합** 기준 (기존 파일 수정분 제외 — git diff --numstat 로 판정 가능해야 함)
- 스킬 본문 규칙의 준수 자체는 모델 재량이므로, 결정론 게이트는 "규칙이 본문에 존재·유지된다"를 검증하는 정적 계약 테스트로 정의한다 (기존 wiring-integrity 선례)
- 설치본(`~/.claude`, `~/.codex`)은 수정하지 않는다 — repo 소스만

### Constraints

- production stakes 의 기존 파이프라인 동작·문서 서술은 변경하지 않는다 (deprecated 별칭 표, loop 파라미터 의미 불변)
- `vibe/rules/loop-contract.md` 는 SSOT — stakes 매핑·JUDGE 절제 기준은 여기에 정의하고 스킬 본문은 참조만 한다
- 스킬 frontmatter(name/description)는 변경하지 않는다 (SKILL-CATALOG 재생성 불필요 범위 유지)
- dual-harness doctrine: 규칙은 전부 명시적 서술 — 추론 의존 문구 금지

---

## 2. Requirements

| ID | Requirement | Done Criteria |
|----|-------------|---------------|
| REQ-stakes-001 | `/vibe` 디스패처 Phase 1 이 stakes(demo/prototype/production)를 분류하고, demo/prototype 판정 시 경량 프로파일(--max-iter 1, 리뷰 1패스, 검증 스크립트 신규 생성 금지)을 적용한다 | D1, D2 |
| REQ-stakes-002 | stakes 판정이 불확실하면 SPEC 승인 메시지에 stakes 질문 1개를 포함한다 (추가 왕복 없이 기존 승인 게이트에 편승) | D1, D3 |
| REQ-stakes-003 | JUDGE 단계에서 신규 검증 코드 총량이 신규 구현 코드 총량을 초과하면 P2 경고를 기록한다 | D4 |
| REQ-stakes-004 | vibe.review 가 stakes 와 변경 파일 수 기준으로 리뷰어 수를 스케일한다 (경량 2~3종, production 기본 셋 유지) | D5 |
| REQ-stakes-005 | production stakes 기본 동작은 문서·계약 모두 불변이다 | D6 |

---

## 3. Done Criteria (deterministic gates)

| # | Criterion | Verified by |
|---|-----------|-------------|
| D1 | `skills/vibe/SKILL.md` Phase 1 에 stakes 3단계 분류 규칙과 경량 프로파일 매핑 표가 존재한다 | 정적 계약 테스트 (마커·표 파싱) |
| D2 | `vibe/rules/loop-contract.md` 에 stakes → 루프 파라미터 매핑(demo/prototype → max_iterations 1, 리뷰 1패스, 검증 스크립트 신규 생성 금지)이 정의되어 있다 | 정적 계약 테스트 |
| D3 | `skills/vibe.spec/SKILL.md` 승인 메시지 템플릿에 "stakes 불확실 시 질문 포함" 규칙이 존재한다 | 정적 계약 테스트 |
| D4 | `vibe/rules/loop-contract.md` JUDGE 정의에 검증/구현 신규 코드 비율 P2 경고 기준(git diff --numstat 기반)이 존재하고 `skills/vibe.run/SKILL.md` 가 이를 참조한다 | 정적 계약 테스트 |
| D5 | `skills/vibe.review/SKILL.md` 에 리뷰어 스케일링 표(stakes × 변경 파일 수 → 리뷰어 셋)가 존재하며 production 행은 기존 셋과 동일하다 | 정적 계약 테스트 |
| D6 | `pnpm build` + 전체 vitest + `gen:skill-docs:check` + `validate:skill-invocation` + `validate:counts` 모두 exit 0 | repository quality commands |

### Evidence Required

- D1~D5 → 신규 `src/__tests__/stakes-contract.test.ts` 통과 출력
- D6 → 각 명령 exit code 및 요약 출력

### Human Taste (Non-Blocking)

- stakes 분류 문구의 자연스러움, 경량 프로파일의 체감 속도 개선 폭 (실측은 후속 헤드투헤드에서)

---

## 4. Scenarios

### S1 — demo 태스크 경량 실행 (REQ-001)
- Given 요구사항에 "데모용 일회성 사이트" 가 포함되고 대상이 임시 폴더
- When /vibe 가 intent 를 분류
- Then stakes=demo 로 판정하고 실행 계획에 max_iterations=1·리뷰 1패스·검증 스크립트 생성 금지를 명시한다

### S2 — 불확실 시 승인 게이트 편승 질문 (REQ-002)
- Given stakes 판정 신호가 상충 (기존 프로젝트 내부 + "실험" 키워드)
- When SPEC 승인 메시지를 제시
- Then 승인 선택지에 stakes 확인 질문 1개가 포함되고 별도 추가 왕복은 없다

### S3 — 검증 산출물 절제 경고 (REQ-003)
- Given 이번 feature 신규 검증 코드 바이트 합이 신규 구현 코드 바이트 합을 초과
- When JUDGE 가 게이트를 판정
- Then P2 경고를 기록하되 게이트 통과 여부는 바꾸지 않는다

### S4 — 리뷰어 스케일링 (REQ-004)
- Given stakes=demo 이고 변경 파일 5개 이하
- When vibe.review 가 리뷰어를 기동
- Then correctness + security 2종만 기동한다

### S5 — production 불변 (REQ-005)
- Given stakes=production (또는 판정 신호 없음)
- When 파이프라인 실행
- Then 기존 기본 동작(전체 리뷰어 셋, 수렴 루프)과 동일하다

---

## 5. Out of Scope

- CLI/TypeScript 런타임 로직 변경 (stakes 는 스킬 본문 규칙 + 정적 계약 테스트로만 도입)
- hooks 변경, installer/constants 변경
- AGENTS.md 재생성 (`/vibe.docs agent` 로 별도 수행)
- SPEC 작성 단계 자체의 시간 단축 (이번엔 실행 깊이만)
- 소요 시간 자동 계측/리포팅

---

## 6. Constraints (요약 재기재)

- loop-contract.md 가 stakes 매핑의 SSOT — 스킬 본문 중복 정의 금지
- production 기본 불변 · frontmatter 불변 · 설치본 불변
