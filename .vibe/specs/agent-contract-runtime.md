# SPEC: 에이전트 계약 — 런타임 축을 빌드타임에 잡는다

- **Created**: 2026-09-02
- **Status**: VERIFIED (2026-09-02 — 게이트 전량 exit 0)
- **Class**: feature
- **Stakes**: production — 배포되는 템플릿·스킬 본문과 공개 tools export 를 바꾼다. 잘못 잡으면 없는 위반을 차단한다
- **Tech Stack**: TypeScript (ESM), Vitest, Markdown 템플릿·스킬 본문

---

## 1. Overview / Goal

vibe 는 **빌드타임만** 다룬다. 그런데 사용자가 만드는 것이 에이전트 제품일 때, 그 에이전트가
사용자 앞에서 내리는 런타임 판단은 vibe 의 어떤 게이트도 보지 않는다. 논문이 연구 대상으로
삼는 바로 그 객체가 통째로 사각지대다.

이 SPEC 은 vibe 를 런타임에 넣지 않는다 — `loop-contract` 의 push·release·배포 금지는 그대로다.
대신 **런타임 게이트를 빌드타임에 생성**한다: SPEC 에 에이전트 계약을 적으면, 그 계약을 코드가
추출하고, 에이전트 실행이 남긴 **도구 호출 로그**에 대해 결정론적으로 단언한다.

**판정 대상이 로그인 것이 핵심이다.** LLM 이 에이전트의 출력을 채점하는 형태였다면 그것은
Model Judge 이고 완료 권한이 없다 (loop-contract Judge 권한 경계). "금지된 도구를 불렀는가" 는
관측된 사실이라 차단할 수 있다.

### Context Sources

| 등급 | 뜻 |
|---|---|
| `[확인]` | 코드·문서에서 직접 읽었다 |
| `[해석]` | 읽은 것에서 추론했다 |
| `[모름]` | 확인하지 못했다 |

- [확인] `vibe/rules/loop-contract.md` "금지 (루프 권한 경계)" — 루프는 push·release·배포·버전 범프를 수행하지 않는다. 이 SPEC 은 그 경계를 넓히지 않는다
- [확인] `vibe/rules/loop-contract.md` "Judge 권한 경계" — 종료 권한은 결정론적 Judge 에만 있다. Model Judge 는 발견을 제안하되 차단하지 못한다
- [확인] `vibe/templates/spec-template.md:138` — `## 6. API Contract (only if the feature exposes an API)` 와 "Presence of this section enables `/vibe.contract` drift detection". **섹션 존재가 곧 스위치**인 관례가 이미 있다
- [확인] `skills/vibe.spec/SKILL.md:137` — "trace·contract 는 사용자가 요청하거나 SPEC 에 API Contract 섹션이 있을 때만 체인한다"
- [확인] `skills/vibe.contract/SKILL.md` "What counts as an API contract" — 계약 = 외부 소비자가 의존하는 **인터페이스 모양**. 에이전트의 도구 표면도 같은 정의에 든다
- [확인] `hooks/scripts/step-counter.js:appendJsonl` — vibe 자신의 도구 호출 로그 형식이 `{ts, tool, ok, target_file, error_category}` 다. 에이전트 제품의 로그도 같은 모양으로 받으면 새 형식을 발명하지 않는다
- [확인] `src/tools/contract/reverseDrift.ts` — 역방향 드리프트는 `blocking: false` 를 **리터럴 타입**으로 박아 차단을 불가능하게 했다. 이 SPEC 은 반대로 차단이 정당한 경우이므로 그 대칭을 문서로 남긴다
- [해석] 에스컬레이션 조건("결제가 임계를 넘으면 사람에게 묻는다")은 도구 호출 로그만으로 판정할 수 없다 — 조건 충족 여부가 로그에 없다. 선언은 받되 게이트로 만들지 않는다
- [모름] 실제 에이전트 제품이 어떤 로그 형식을 쓰는지 — 표준이 없다. vibe 자신의 형식을 기준으로 받고, 맞추는 책임은 호출자에게 둔다

### Assumptions

훑었으나 묻지 않고 기본값을 채택한 항목 전부:

1. SPEC 섹션 이름은 `## Agent Contract`. 존재가 곧 스위치다 (API Contract 관례를 그대로 잇는다)
2. 계약 항목 4종: `Allowed tools` · `Forbidden tools` · `Irreversible` · `Escalate`
3. 이 중 **도구 로그로 판정 가능한 것은 앞의 3종뿐이다.** `Escalate` 는 선언만 받고 advisory 로 낸다 — 조건 충족 여부가 로그에 없다
4. 재지 못하는 것을 게이트로 만들지 않는다. 억지로 넣으면 통과 의식이 되고, 그건 없는 게이트보다 나쁘다
5. 위반 3종: `forbidden-tool` · `unlisted-tool` · `unapproved-irreversible`. 전부 **관측된 사실**이므로 차단한다 — 역방향 드리프트와 반대 방향의 결정이고, 그 대칭이 Judge 권한 경계의 예시다
6. `Allowed tools` 가 비어 있으면 allowlist 미선언으로 보고 `unlisted-tool` 을 검사하지 않는다. 빈 목록을 "아무것도 허용 안 함" 으로 읽으면 선언하지 않은 프로젝트가 전부 위반이 된다
7. 되돌릴 수 없는 작업은 로그 항목의 `approved: true` 로 승인을 표시한다. 없으면 `unapproved-irreversible`
8. 로그 항목 형식은 vibe 자신의 것을 쓴다: `{ tool, approved?, ts? }` — 새 형식을 발명하지 않는다
9. 로그가 없으면 `checked: false`. **위반 0건으로 적지 않는다** — 안 본 것과 봤는데 깨끗한 것은 다르다 (비용 계측 축과 같은 규약)
10. 도구 이름 비교는 정확히 일치. 글롭·정규식을 허용하면 "무엇이 금지인가" 가 표기마다 갈린다
11. 같은 도구가 Allowed 와 Forbidden 에 동시에 있으면 정의 오류(P1) — 어느 쪽이 이기는지 정하지 않는다. 정하면 그 규칙을 기억해야 하고, 기억이 필요한 규칙은 틀린다
12. 신규 스킬을 만들지 않는다. `vibe.contract` 에 `agent` 서브커맨드로 붙인다
13. 모듈은 `src/tools/contract/agentContract.ts` — 계약 관심사가 이미 거기 있다
14. Structure 다이어그램 절은 생략한다 — 새 경계 없음. 기존 모듈에 파일 1개 추가

### 되돌리기 어려운 결정

없음 — 신규 순수 함수와 문서다. 계약 섹션은 SPEC 안에 살고, 되돌리면 섹션이 없는 상태로 돌아간다.

### Constraints

- 이 저장소 파일만 수정한다
- **vibe 를 런타임에 넣지 않는다** — loop-contract 의 push·release·배포 금지를 넓히지 않는다
- **LLM 이 에이전트 출력을 채점하는 경로를 만들지 않는다** — 단언 대상은 도구 호출 로그다
- 판정할 수 없는 항목(`Escalate`)을 게이트로 만들지 않는다
- 로그가 없으면 위반 0건이 아니라 미검사다
- 신규 함수는 복잡도 상한 준수 (≤50줄 · 파라미터 ≤5 · Cyclomatic ≤10), `any` 금지, 명시적 반환 타입

### Rejected Alternatives (Traps)

- **LLM 이 에이전트 응답을 채점** — Model Judge 이고 완료 권한이 없다 (loop-contract). 차단하면 권한 경계를 깨고, 차단 안 하면 게이트가 아니다
- **vibe 를 에이전트 런타임에 삽입** — loop-contract 가 배포·릴리스를 금지하는 근거(사람 리뷰 큐로만 나간다)를 정면으로 깬다. 빌드타임에 게이트를 **생성**하는 것으로 같은 목적을 달성한다
- **`Escalate` 를 게이트로** — 조건 충족 여부가 도구 로그에 없다. 판정할 수 없는 것을 게이트로 만들면 통과 의식이 된다
- **도구 이름에 글롭 허용** — "무엇이 금지인가" 가 표기마다 갈리고, `send_*` 가 `send_log` 까지 잡는지 아무도 확신하지 못한다
- **Allowed 와 Forbidden 충돌 시 우선순위 규칙** — 규칙을 기억해야 판정을 예측할 수 있고, 기억이 필요한 규칙은 틀린다. 정의 오류로 막는다
- **로그 없음을 위반 0건으로** — 계측 축에서 이미 같은 실수를 막았다. 안 본 것과 깨끗한 것은 다르다

---

## 2. Requirements

| REQ ID | 요구사항 | Done Criteria |
|---|---|---|
| REQ-agent-contract-runtime-001 | SPEC 에서 Agent Contract 섹션을 추출한다 | DC-1 |
| REQ-agent-contract-runtime-002 | 섹션이 없으면 계약 없음으로 조용히 종료한다 | DC-2 |
| REQ-agent-contract-runtime-003 | 계약 정의 오류를 노드 가드로 잡는다 | DC-3 |
| REQ-agent-contract-runtime-004 | 도구 호출 로그에서 위반 3종을 결정론적으로 찾는다 | DC-4 |
| REQ-agent-contract-runtime-005 | allowlist 미선언이면 unlisted 를 검사하지 않는다 | DC-5 |
| REQ-agent-contract-runtime-006 | 로그가 없으면 미검사로 남긴다 | DC-6 |
| REQ-agent-contract-runtime-007 | Escalate 는 advisory 로만 낸다 | DC-7 |
| REQ-agent-contract-runtime-008 | SPEC 템플릿과 vibe.spec·vibe.contract 에 배선한다 | DC-8 |

### Done Criteria

| ID | 판정 | Evidence Required |
|---|---|---|
| DC-1 | 4종 항목이 각각 목록으로 파싱되고, 백틱·쉼표 표기를 견딘다 | `npx vitest run src/tools/contract` exit 0 |
| DC-2 | 섹션 없는 SPEC 에서 `null` 을 내고 예외를 던지지 않는다 | 동일 테스트 exit 0 |
| DC-3 | Allowed∩Forbidden 충돌·빈 계약이 P1 findings 로 잡힌다 | 동일 테스트 exit 0 |
| DC-4 | 금지 도구 호출·미등재 도구 호출·승인 없는 되돌릴 수 없는 호출이 위반으로 잡히고 `blocking: true` | 동일 테스트 exit 0 |
| DC-5 | `allowedTools` 가 비면 `unlisted-tool` 위반이 나오지 않는다 | 동일 테스트 exit 0 |
| DC-6 | 로그가 `undefined` 면 `checked:false` 이고 `violations` 가 빈 배열이며 `blocking:false` | 동일 테스트 exit 0 |
| DC-7 | `escalations` 는 `advisory` 로만 나오고 위반을 만들지 않는다 | 동일 테스트 exit 0 |
| DC-8 | 템플릿에 `## Agent Contract` 절이, `vibe.contract` 에 `agent` 서브커맨드가, `vibe.spec` 에 작성 지시가 있다 | 동일 테스트(정적 계약 검사) exit 0 |

---

## 3. Scenarios

| # | Given | When | Then | REQ |
|---|---|---|---|---|
| S1 | SPEC 에 Agent Contract 4종이 적혀 있다 | `parseAgentContract` | 4개 목록이 정확히 파싱된다 | 001 |
| S2 | 섹션이 없는 SPEC | `parseAgentContract` | `null` — 모든 기능에 에이전트가 있는 것은 아니다 | 002 |
| S3 | 같은 도구가 Allowed 와 Forbidden 에 동시에 | `validateAgentContract` | P1 `tool-in-both-lists` | 003 |
| S4 | 로그에 금지 도구 호출이 있다 | `checkAgentToolLog` | `forbidden-tool` 위반 + `blocking:true` | 004 |
| S5 | allowlist 가 선언됐는데 목록 밖 도구를 불렀다 | `checkAgentToolLog` | `unlisted-tool` 위반 | 004 |
| S6 | 되돌릴 수 없는 도구를 `approved` 없이 불렀다 | `checkAgentToolLog` | `unapproved-irreversible` 위반 | 004 |
| S7 | allowlist 미선언 + 아무 도구나 호출 | `checkAgentToolLog` | `unlisted-tool` 없음 — 선언하지 않은 프로젝트를 전부 위반으로 만들지 않는다 | 005 |
| S8 | 로그를 넘기지 않았다 | `checkAgentToolLog` | `checked:false` · `blocking:false` — 위반 0건이 아니다 | 006 |
| S9 | Escalate 조건이 선언돼 있다 | `checkAgentToolLog` | `advisory` 에 실리고 위반은 만들지 않는다 | 007 |

---

## 4. Out of Scope

- 에이전트 런타임에 vibe 를 삽입하는 것 — 게이트는 빌드타임에 생성한다
- LLM 이 에이전트 응답을 채점하는 경로
- 에스컬레이션 조건의 자동 판정 (도구 로그에 조건이 없다)
- 도구 이름 글롭·정규식 매칭
- 에이전트 제품의 로그 수집기 — 로그는 호출자가 준다

---

## Anchors

이 SPEC 이 안착한 경로 — 사라지면 `npm run validate:spec-lifecycle` 이 빨간불을 켠다.

- `src/tools/contract/agentContract.ts`
- `src/tools/contract/agentContract.test.ts`
- `src/tools/contract/index.ts`
- `vibe/templates/spec-template.md`
- `skills/vibe.contract/SKILL.md`
- `skills/vibe.spec/SKILL.md`
