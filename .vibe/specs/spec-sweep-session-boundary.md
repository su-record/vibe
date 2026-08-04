# SPEC: Coverage Sweep + Session Boundary

- **Created**: 2026-08-04
- **Status**: APPROVED (2026-08-04) · Implemented · D1~D7 gates passed
- **Stakes**: production — 배포되는 npm 패키지(`@su-record/vibe`)의 스킬 본문 소스, demo 신호 없음 (SSOT: vibe/rules/loop-contract.md)
- **Tech Stack**: Markdown (skill bodies), TypeScript (static contract tests), Vitest

---

## 1. Overview / Goal

`vibe.spec` 의 명확화 단계가 제한하는 축을 **질문 수 → 필수 답변 수** 로 바꾸고, SPEC 승인 직후 새 세션에서 구현을 시작할 수 있는 선택지를 승인 게이트에 편승시킨다. 전자는 지금 "물어볼 생각조차 하지 않은" 결정 지점이 SPEC 에 아예 남지 않는 누수를 막고, 후자는 명확화 왕복·기각안 논의 텍스트가 구현 컨텍스트에 잔류하는 것을 막는다.

### Context Sources

- 유튜브 영상 분석 (2026-08-04, `https://youtu.be/J3BbFNYHvZM`, Gemini 멀티모달) — 메타프롬프팅 5단계: 덤핑 → AI 역질문 → 핵심 2~3개만 답하고 위임 → 압축 → 새 창 실행
- `skills/vibe.spec/SKILL.md` — Step 3 "Clarify — 진짜 모호할 때만" (최대 5개 상한), Step 5 셀프 리뷰 체크리스트, Step 6 승인 게이트
- `skills/vibe/SKILL.md` — Phase 4 체인 실행 (spec → run 연속 호출), Phase 1-b Stakes 분류
- `skills/vibe.run/SKILL.md:191` — Step 1-0 execution packet 컴파일 (MANDATORY, blocking)
- `skills/vibe.run/references/exec-plan.md` — "If the agent can't see it, it doesn't exist" 원칙 + "Plan survives `/new` session handoff" 설계 목표
- `src/__tests__/stakes-contract.test.ts` — 스킬 본문 규칙을 정적 계약 테스트로 고정하는 선례 (D3 절: vibe.spec 승인 섹션·셀프리뷰 체크리스트 검증)
- `src/__tests__/instruction-drift.test.ts` — CLAUDE.md ↔ 생성기 ↔ Codex 변환 드리프트 가드
- `CLAUDE.md:138` · `AGENTS.md:134` — Context Management 의 85% 용량 기준 리셋 규칙 (병행 대상)
- 사용자 결정 3건 (2026-08-04): 관측 가능한 프록시 트리거 / 승인 메시지 편승 / ExecPlan 시점 불변

### Assumptions

> Step 3-a 커버리지 스윕에서 도출한 결정 지점 15건 중, 3-b 로 사용자에게 물은 3건을 제외한 12건.

- 3-a 스윕 산출물은 별도 파일로 저장하지 않는다 — 전량 SPEC 의 Assumptions 로 흡수된다 (`.vibe/` 에 새 아티팩트 종류를 만들지 않음)
- 3-a 는 사용자에게 노출하지 않는 내부 단계다 (노출 대상은 3-b 질문과 최종 Assumptions 뿐)
- 기존 "최대 5개" 상한 문구는 제거하고 3-b 의 "최대 3개" 로 교체한다 (두 상한이 공존하면 어느 쪽이 유효한지 모호)
- Step 번호 체계는 "3. Clarify" 를 유지하고 3-a / 3-b 를 하위 소제목으로 둔다 (기존 문서·테스트의 Step 참조 안전)
- 승인 메시지의 선택지 **개수는 항상 4개로 고정**하고, 트리거 충족 시에만 `[2]` 에 `(권장)` 표시를 붙인다 — 메시지 모양이 조건부로 변하면 직역 하네스가 분기 해석에 실패한다
- 명확화 왕복 카운트: 3-b 질문 배치 1회 = 1왕복, SPEC 수정 요청 1회 = 1왕복
- Assumptions 접기 임계는 3개 — 3개 이하면 전부 표시, 초과하면 핵심 3개 + "그 외 N건은 SPEC 참조"
- 신규 정적 계약 테스트는 `src/__tests__/spec-clarify-contract.test.ts` 한 파일에 둔다 (기존 stakes-contract.test.ts 를 오염시키지 않음)
- CLAUDE.md 반영 범위는 Context Management 절 1줄 추가 + Workflow 절 `/vibe.spec` 설명 갱신 (구조 개편 없음)
- 스킬 본문 언어는 기존과 동일한 한국어
- 스킬 frontmatter(name/description)는 변경하지 않는다 — SKILL-CATALOG 재생성 불필요
- 설치본(`~/.claude/`, `~/.codex/`, `~/.vibe/`)은 수정하지 않는다 — repo 소스만

### Constraints

- `vibe/rules/loop-contract.md` 의 불변식 **"의무적 사람 개입은 SPEC 승인 1회"** 를 깨지 않는다 — 세션 경계는 승인 메시지 안의 선택지여야 하며, 별도 blocking 프롬프트가 되어선 안 된다
- `automationLevel: autonomous` 의 기존 동작은 완전 보존 — 3-b 질문 없음, 세션 경계 권고 없음, 같은 세션 연속 실행
- ExecPlan / execution packet 의 컴파일 시점(`vibe.run` Step 1-0)과 blocking 판정(STALE_PACKET · preservation-audit · budget)은 변경하지 않는다
- `stakes-contract.test.ts` D3 절이 검증하는 두 항목을 보존한다: Step 6 승인 섹션의 stakes 편승 질문 규칙 + Step 5 셀프리뷰 체크리스트의 stakes 항목
- dual-harness doctrine — 3-a/3-b 와 트리거 조건은 전부 명시적 절차로 기술한다. 하네스가 추론으로 채워야 하는 문구 금지
- `CLAUDE.md` 가 content SSOT — 변경 시 `AGENTS.md` 를 번역 규칙(`/vibe.*` → `$vibe.*`)으로 동기화한다
- 스킬 본문 규칙의 준수 자체는 모델 재량이므로, 결정론 게이트는 "규칙이 본문에 존재·유지된다" 를 검증하는 정적 계약 테스트로 정의한다 (`stakes-contract.test.ts` 선례)

### Rejected Alternatives (Traps)

- **Carving(프롬프트 압축) 단계 도입** — ExecPlan 의 "If the agent can't see it, it doesn't exist" 와 정면 충돌한다. Codex 직역 하네스는 압축으로 생략된 부분을 추론으로 복원하지 못하므로 압축분이 그대로 결손이 된다. 영상의 4,000자 압축은 Goal Prompt 의 외부 글자 수 제약에서 나온 것이고 vibe 에는 그 제약이 없다. 압축 안전장치는 `vibe.run` Step 1-0 의 preservation-audit / budget blocking 게이트가 이미 담당한다
- **컨텍스트 사용률 % 기반 트리거** — 스킬 본문에서 호출할 수 있는 하네스 중립 수단이 없다. CC 는 시스템 리마인더로만 노출하고 Codex 는 노출 자체가 없어, 같은 SPEC 이 하네스별로 다른 시점에 권고를 띄운다 (dual-harness doctrine 위반)
- **별도 blocking 세션 경계 프롬프트** — loop-contract 의 "의무적 사람 개입 1회" 불변식을 깨고, stuck 해시 비교 대상이 아닌 사용자 대기 상태를 하나 더 만든다. 그 상태는 stuck 으로도 실행 실패로도 분류되지 않아 루프 종료 사유 3종(게이트 통과 │ stuck │ max_iterations) 밖으로 샌다
- **ExecPlan 컴파일을 spec 단계로 이동** — `writeExecutionPacket` 은 canonical SPEC 경로 해석 후 실행되고 `STALE_PACKET` 판정이 run 시점의 SPEC 상태에 의존한다. spec 단계로 옮기면 승인 이후의 모든 SPEC 수정이 stale 로 잡혀 재컴파일 blocking 이 상시 발동한다
- **질문 상한만 5 → 무제한으로 확대** — 답변 부담이 질문 수에 비례해 증가한다. 제한해야 할 축은 질문 수가 아니라 필수 답변 수이며, 상한 확대만으로는 사용자 부담이 곧바로 커진다

---

## 2. Requirements

| ID | Requirement | Done Criteria |
|----|-------------|---------------|
| REQ-sweep-001 | `vibe.spec` Step 3 이 3-a(커버리지 스윕) / 3-b(답변 요청) 2단 구조로 기술된다. 3-a 는 개수 제한 없이 결정 지점을 열거하고 각 항목에 기본값 추정을 붙이는 내부 단계이며, 3-b 는 Done Criteria 가 실제로 갈라지는 항목만 **최대 3개** 사용자에게 묻는다 | D1, D3 |
| REQ-sweep-002 | 3-a 에서 도출된 결정 지점 중 3-b 로 묻지 않은 것은 **전부** SPEC 의 Assumptions 로 편입된다 (누락 0건). 승인 메시지의 Assumptions 는 3개 초과 시 핵심 3개 + "그 외 N건은 SPEC 참조" 로 접어 제시한다 | D1, D3 |
| REQ-sweep-003 | Step 5 셀프 리뷰 체크리스트에 "3-a 결정 지점이 질문 또는 Assumptions 중 하나로 귀결됐는가" 항목이 추가되고, 기존 stakes 항목은 보존된다 | D1, D4 |
| REQ-sweep-004 | `automationLevel: autonomous` 에서는 3-b 질문 없이 전 항목이 Assumptions 로 편입되고, 세션 경계 권고도 제시되지 않는다 | D1, D3, D5 |
| REQ-sweep-005 | Step 6 승인 메시지의 선택지가 항상 4개로 고정된다: `[1] 승인 → 이 세션에서 계속` · `[2] 승인 → 새 세션에서 run` · `[3] 수정 요청` · `[4] 중단`. 추가 확인 왕복은 만들지 않는다 | D1, D5 |
| REQ-sweep-006 | 세션 경계 권고 트리거가 관측 가능한 프록시 3종으로 정의된다: 명확화 왕복 ≥2회 **OR** SPEC 수정 요청 ≥1회 **OR** 분할 SPEC(5+ phase). 충족 시에만 `[2]` 에 `(권장)` 표시를 붙이며, 선택지 개수는 변하지 않는다 | D1, D5 |
| REQ-sweep-007 | `/vibe` 디스패처 Phase 4 가 `[2]` 선택 시 run 을 자동 체인하지 않고 새 세션 재개 안내(`/vibe.run "{feature}"`)를 출력하며 종료한다. ExecPlan 컴파일 시점은 변경하지 않는다 | D1, D6 |
| REQ-sweep-008 | `CLAUDE.md` Context Management 절에 단계 경계 트리거가 85% 용량 규칙과 **병행**으로 명시되고, `AGENTS.md` 가 번역 규칙에 따라 동기화된다 | D1, D7 |
| REQ-sweep-009 | 위 규칙들이 스킬 본문에 존재함을 검증하는 정적 계약 테스트가 추가되고, 기존 테스트 스위트에 회귀가 없다 | D1, D2 |

---

## 3. Done Criteria (deterministic gates)

| # | Criterion | Verified by |
|---|-----------|-------------|
| D1 | 신규 정적 계약 테스트가 전부 통과한다 | `npx vitest run src/__tests__/spec-clarify-contract.test.ts` exit 0 |
| D2 | 빌드와 전체 테스트 스위트가 통과한다 (기존 계약 테스트 회귀 0) | `npm run build && npx vitest run` exit 0 |
| D3 | `skills/vibe.spec/SKILL.md` Step 3 에 `3-a`·`3-b` 소제목과 "최대 3" 상한이 존재하고, 옛 "최대 5개" 문구가 남아있지 않다 | `grep -c "3-a\|3-b\|최대 3" skills/vibe.spec/SKILL.md` ≥3 AND `grep -c "최대 5개" skills/vibe.spec/SKILL.md` = 0 |
| D4 | Step 5 체크리스트에 커버리지 스윕 귀결 항목과 기존 stakes 항목이 **둘 다** 존재한다 | 신규 테스트의 체크리스트 검증 케이스 통과 (`stakes-contract.test.ts` D3 절도 동시 통과) |
| D5 | Step 6 승인 메시지에 4개 선택지 + 트리거 프록시 3종 + autonomous 예외가 명시된다 | 신규 테스트의 승인 섹션 검증 케이스 통과 |
| D6 | `skills/vibe/SKILL.md` Phase 4 에 `[2]` 선택 시 체인 중단 + 재개 안내 규칙이 명시된다 | 신규 테스트의 디스패처 검증 케이스 통과 |
| D7 | `CLAUDE.md` 와 `AGENTS.md` 양쪽에 단계 경계 트리거 서술이 존재하고, `AGENTS.md` 에 변환되지 않은 `/vibe.` 슬래시 표기가 0건이다 | 신규 테스트의 문서 동기화 케이스 통과 + `instruction-drift.test.ts` 통과 |

### Evidence Required

- D1 → `npx vitest run src/__tests__/spec-clarify-contract.test.ts` 출력 (통과 케이스 수 포함)
- D2 → `npm run build` 및 `npx vitest run` 종료 코드와 요약 라인 (변경 전후 테스트 수 비교)
- D3 → 위 grep 명령 2건의 출력
- D4 → 신규 테스트 + `npx vitest run src/__tests__/stakes-contract.test.ts` 출력
- D5 → 신규 테스트 출력 + `skills/vibe.spec/SKILL.md` Step 6 해당 코드블록
- D6 → 신규 테스트 출력 + `skills/vibe/SKILL.md` Phase 4 해당 절
- D7 → 신규 테스트 출력 + `npx vitest run src/__tests__/instruction-drift.test.ts` 출력 + `CLAUDE.md`/`AGENTS.md` diff

### Human Taste (Non-Blocking)

- 3-b 질문 3개가 "정말 갈라지는 것" 인지에 대한 감각 — 게이트로 쓰지 않는다
- 접힌 Assumptions 요약의 가독성 — 게이트로 쓰지 않는다

---

## 4. Scenarios

각 시나리오는 `.vibe/features/spec-sweep-session-boundary.feature` 에 gherkin 으로 매핑된다.

| # | Scenario | Done Criteria |
|---|----------|---------------|
| S1 | 스윕에서 다수 결정 지점이 나와도 사용자에게는 최대 3개만 묻는다 | D3 |
| S2 | 묻지 않은 결정 지점이 전부 Assumptions 로 편입된다 | D3, D4 |
| S3 | Assumptions 가 3개를 넘으면 접힌 형태로 제시된다 | D3 |
| S4 | autonomous 에서는 질문도 세션 경계 권고도 없다 | D3, D5 |
| S5 | 트리거 미충족 시 선택지 4개는 그대로, `(권장)` 표시만 없다 | D5 |
| S6 | 트리거 충족 시 `[2]` 에 `(권장)` 이 붙는다 | D5 |
| S7 | `[2]` 선택 시 디스패처가 run 체인 없이 재개 안내로 종료한다 | D6 |
| S8 | ExecPlan 컴파일은 여전히 `vibe.run` Step 1-0 에서만 일어난다 | D2, D6 |
| S9 | 기존 stakes 계약(편승 질문·셀프리뷰 항목)이 보존된다 | D2, D4 |
| S10 | CLAUDE.md ↔ AGENTS.md 가 동기화되고 슬래시 잔존이 없다 | D7 |

---

## 5. Out of Scope

- Carving / 프롬프트 압축 단계 도입 (Rejected Alternatives 참조)
- ExecPlan · execution packet 컴파일 시점 이동 또는 중복 컴파일
- 컨텍스트 사용률 % 기반 트리거
- `CLAUDE.md` 의 85% 용량 기준 리셋 규칙 변경 (병행이지 대체가 아님)
- `vibe.continue` / HANDOFF.md 등 핸드오프 아티팩트 신규 생성
- 설치본(`~/.claude/`, `~/.codex/`, `~/.vibe/`) 수정
- 스킬 frontmatter 변경 및 SKILL-CATALOG 재생성
- `vibe.run` / `vibe.verify` / `vibe.review` 본문 변경
