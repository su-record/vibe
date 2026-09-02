# SPEC: 루프 경제성 계측 축

- **Created**: 2026-09-02
- **Status**: DRAFT
- **Stakes**: production — 모든 루프 실행이 지나가는 원장 경로를 바꾼다. 잘못되면 예산·stuck 판정이 오염된다
- **Tech Stack**: Node.js (ESM, 훅 스크립트), Vitest

---

## 1. Overview / Goal

vibe 는 지금 효율을 **주장할 수 없다** — 금지되어서가 아니라 잴 것이 없어서다. 원장은
`iterations`(폭주 방어)와 `verified`(전진량) 두 축만 세고, "그 전진이 얼마짜리였나" 는 아무도 모른다.

이 SPEC 은 세 번째 축을 넣는다. **주장이 아니라 계측만** 넣는다 — 비교 데이터가 쌓이기 전에
효율 문구를 쓰는 것은 constitution §3.5 위반이고, 이 SPEC 이 하려는 일의 정확한 반대다.

핵심 제약 하나: **수치의 출처가 코드여야 한다.** 모델이 "도구를 12번 썼다" 고 보고하는 형태면
그건 vibe 가 처음부터 배제하는 자기보고다. 다행히 이미 코드가 세고 있다 —
`step-counter.js`(PostToolUse)가 액션 툴콜을 `.vibe/metrics/current-run.jsonl` 에 즉시 append 한다.

### Context Sources

| 등급 | 뜻 |
|---|---|
| `[확인]` | 코드·문서에서 직접 읽었다 |
| `[해석]` | 읽은 것에서 추론했다 |
| `[모름]` | 확인하지 못했다 |

- [확인] `hooks/scripts/lib/loop-ledger.js` — 회전 원장은 `.vibe/metrics/loop-history.jsonl`(JSON Lines). `recordIteration` 이 `{event:'iteration', verified}` 를 append 하고 `readBudget` 이 직전 `start` 이후만 집계한다
- [확인] `hooks/scripts/lib/loop-ledger.js:appendLoopEvent` — 기록 필드가 화이트리스트다(`result`·`summary`·`discoverHash`·`verified`). 새 필드는 여기에 추가하지 않으면 **조용히 버려진다**
- [확인] `hooks/scripts/step-counter.js:appendJsonl` — `{ts, tool, ok, target_file, error_category}` 를 **스로틀 없이 즉시** append. 서브에이전트 툴은 `Agent`(신) / `Task`(구) 둘 다 매칭한다
- [확인] `hooks/scripts/step-counter.js` 주석 — "과다 매칭은 안전하고 과소 매칭은 소리 없이 데이터를 잃는다". 툴 이름이 바뀐 실측 사례(`Task` → `Agent`)로 이미 한 번 데이터를 잃었다
- [확인] `hooks/scripts/step-counter.js:appendJsonl` — jsonl 은 2MB / 5000줄 초과 시 **뒤쪽 절반만 남기고 회전**한다. 오래된 창은 사라질 수 있고, 회전 사실을 남기는 기록은 없었다(이 SPEC 이 추가한다)
- [확인] `CLAUDE.md` Git 절 — `.vibe/metrics/` 는 커밋 제외. 계측치는 로컬에 남는다
- [확인] `vibe/rules/principles/dual-harness-doctrine.md` — "훅은 설치돼 있다고 가정하지 않는다". `vibe upgrade` 만으로는 프로젝트 로컬 훅이 설치되지 않는다
- [확인] `vibe/constitution.md` §3.5 — 측정하지 않은 배수·퍼센트 금지. 출처 없으면 숫자를 쓰지 않고 방향만 적는다
- [해석] 회전 창의 경계는 원장의 `ts` 로 잡을 수 있다 — 직전 `iteration`(없으면 `start`)의 `ts` 부터 이번 기록 시각까지. 별도 신호가 필요 없다
- [모름] 실제 프로젝트에서 회전당 도구 호출 수의 분포 — 이 저장소에 데이터가 없다. **그것을 만드는 것이 이 SPEC 의 목적이므로** 목표치를 정하지 않는다

### Assumptions

훑었으나 묻지 않고 기본값을 채택한 항목 전부:

1. 축은 3종: `elapsedMs`(경과 시간) · `toolCalls`(도구 호출 수) · `subagents`(서브에이전트 수)
2. **토큰은 넣지 않는다** — 하네스가 주지 않으면 셀 수 없고, 모델에게 물으면 자기보고가 된다
2-b. 회전 창은 `(직전 회전, 이번 회전]` **반열림**이다 — 경계에 정확히 걸친 툴콜을 앞 회전 몫으로 두어야 이중 계수가 없다
3. 비용은 **기록 시점에 계산해 원장에 박는다.** 나중에 파생하지 않는다 — `current-run.jsonl` 이 회전하면 과거 창을 다시 셀 수 없다
4. 서브에이전트 판정 툴 이름은 `Agent`·`Task` 둘 다. 옛 이름을 지우지 않는다 (과소 매칭이 조용히 데이터를 잃는다)
5. 툴 로그가 없으면(훅 미설치·첫 실행) `measured: false` 로 남긴다. **0 을 적지 않는다** — 재지 않은 것과 0인 것은 다르다
6. 회전 사실은 **추측하지 않고 기록한다** — `step-counter.js` 가 jsonl 을 자를 때 `.vibe/metrics/current-run-rotation.json` 에 `{rotatedAt, keptFrom}` 을 남기고, `keptFrom` 이 창 시작보다 뒤면 `truncated: true`. 그 회전의 수치는 **하한**이며 합계에서 제외한다
7. `elapsedMs` 는 툴 로그와 무관하게 항상 계산한다 (원장 `ts` 만으로 나온다)
8. `readBudget` 에 `cost` 합계와 `costMeasured`(집계에 든 회전 수)를 함께 낸다 — 분모를 모르면 합계가 거짓말이 된다
9. 기존 반환 필드(`iterations`·`verified`·`remaining`·`exhausted`)의 의미와 타입을 바꾸지 않는다
10. `appendLoopEvent` 의 화이트리스트에 `cost` 를 추가한다
11. 전부 fail-open — 계측 실패가 회전 기록 자체를 막지 않는다 (훅 규약)
12. `stuck` 판정·시운전 게이트에 비용을 반영하지 않는다. 계측 축이지 판정 축이 아니다
13. SSOT 문서는 `vibe/rules/loop-contract.md` 예산 절. `CLAUDE.md` 는 수정하지 않는다 — 루프 파라미터 표에 예산 축이 열거되어 있지 않다
14. Structure 다이어그램 절은 생략한다 — 새 경계 없음. 기존 `lib/` 에 잎 모듈 1개 추가이고 데이터 흐름은 이미 있는 두 파일을 읽는 것뿐이다

### 되돌리기 어려운 결정

- **원장 이벤트에 `cost` 필드를 박는다** → 되돌리면 이미 쌓인 회전의 비용 이력이 무의미해진다. 다만 `.vibe/metrics/` 는 커밋 대상이 아니고 로컬 재생성이 가능하므로 비용은 "지금까지의 로컬 계측치 손실" 에 그친다

### Constraints

- 이 저장소 파일만 수정한다
- **수치의 출처는 코드다** — 모델이 보고한 값을 받는 인자를 만들지 않는다
- 재지 못한 것을 0 으로 적지 않는다 (constitution §3.5)
- 전부 fail-open — 훅 규약. 계측 실패가 원장 기록을 막지 않는다
- 기존 `readBudget` 소비자를 깨지 않는다
- 신규 함수는 복잡도 상한 준수 (≤50줄 · 파라미터 ≤5 · Cyclomatic ≤10)

### Rejected Alternatives (Traps)

- **모델이 `--tools N --agents M` 로 넘긴다** — 자기보고다. vibe 가 완료 판정에서 배제하는 바로 그것을 계측에 들여오면 쌓인 데이터로 아무것도 주장할 수 없다
- **`budget` 호출 시점에 파생 계산** — `current-run.jsonl` 이 2MB/5000줄에서 회전한다. 과거 창은 이미 사라졌을 수 있고, 그러면 조용히 낮은 값이 나온다
- **미측정을 0 으로 채운다** — 훅 미설치 환경에서 "회전당 도구 0회" 라는 거짓 데이터가 쌓인다. 훅은 프로젝트 로컬이라 미설치가 흔하다
- **"로그의 첫 줄이 창 시작보다 뒤" 로 회전을 추정** — 회전이 없어도 항상 참이다(창 시작 직후에 툴콜이 없었을 뿐일 수 있다). 이 추정을 쓰면 멀쩡한 회전이 전부 `truncated` 로 찍혀 합계에서 빠진다 — 재지 못한 것을 0 으로 적지 않으려다 **잰 것까지 버린다**. 구현 중 이 형태로 만들었다가 테스트에서 잡혔다
- **`current-run.json` 의 `steps` 를 쓴다** — 2초/10이벤트 스로틀이 걸려 있어 회전 경계의 값이 최신이 아니다. `jsonl` 은 스로틀이 없다
- **비용을 stuck·시운전 판정에 반영** — 판정 축을 늘리면 게이트가 흔들린다. 이 SPEC 은 계측만 한다

---

## 2. Requirements

| REQ ID | 요구사항 | Done Criteria |
|---|---|---|
| REQ-loop-cost-axis-001 | 회전 창을 원장 `ts` 로 결정론적으로 잡는다 | DC-1 |
| REQ-loop-cost-axis-002 | 도구 호출 수·서브에이전트 수를 툴 로그에서 집계한다 | DC-2 |
| REQ-loop-cost-axis-003 | 재지 못한 회전을 0 이 아니라 미측정으로 남긴다 | DC-3 |
| REQ-loop-cost-axis-004 | 로그 회전 사실을 기록하고, 잘린 회전을 하한으로 표시해 합계에서 뺀다 | DC-4 |
| REQ-loop-cost-axis-005 | 비용을 기록 시점에 원장 이벤트에 박는다 | DC-5 |
| REQ-loop-cost-axis-006 | `readBudget` 이 합계와 집계 분모를 함께 낸다 | DC-6 |
| REQ-loop-cost-axis-007 | 기존 예산 반환 계약이 회귀하지 않는다 | DC-7 |
| REQ-loop-cost-axis-008 | `loop-contract.md` 예산 절이 3축과 수치 규율을 명시한다 | DC-8 |
| REQ-loop-cost-axis-009 | 창 경계가 반열림이라 이중 계수가 없다 | DC-9 |

### Done Criteria

| ID | 판정 | Evidence Required |
|---|---|---|
| DC-1 | 직전 `iteration` 이 있으면 그 `ts`, 없으면 직전 `start` 의 `ts` 가 창 시작이 된다 | `npx vitest run hooks/scripts/__tests__/loop-cost.test.js` exit 0 |
| DC-2 | 창 안의 툴 로그 줄 수가 `toolCalls`, 그중 `Agent`·`Task` 가 `subagents` 로 집계된다 | 동일 테스트 exit 0 |
| DC-3 | 툴 로그 파일이 없으면 `measured:false`, `toolCalls:null`, `subagents:null` 이고 `elapsedMs` 는 계산된다 | 동일 테스트 exit 0 |
| DC-4 | 회전 마커의 `keptFrom` 이 창 시작보다 뒤면 `truncated:true` 이고 `readBudget` 합계에서 제외된다. 마커가 없으면 `false` | 동일 테스트 exit 0 |
| DC-5 | `recordIteration` 후 원장 줄에 `cost` 객체가 존재한다 | 동일 테스트 exit 0 |
| DC-6 | `readBudget` 이 `cost.{elapsedMs,toolCalls,subagents}` 합계와 `costMeasured` 를 낸다 | 동일 테스트 exit 0 |
| DC-7 | 기존 `iterations`·`verified`·`remaining`·`exhausted` 계약이 그대로다 | `npx vitest run hooks/scripts/__tests__/loop-budget.test.js` exit 0 |
| DC-8 | `vibe/rules/loop-contract.md` 예산 절에 3축 표와 "N% 절감을 쓰지 않는다" 규율이 존재한다 | 동일 테스트(정적 계약 검사) exit 0 |
| DC-9 | 창 시작과 같은 시각의 툴콜은 세지 않고, 창 끝과 같은 시각의 툴콜은 센다 | 동일 테스트 exit 0 |

---

## 3. Scenarios

| # | Given | When | Then | REQ |
|---|---|---|---|---|
| S1 | `start` 후 툴 로그에 5줄(그중 `Agent` 1줄)이 쌓였다 | `recordIteration` | `cost.toolCalls=5`·`subagents=1`·`measured=true` 가 원장에 박힌다 | 002·005 |
| S2 | 직전 회전이 이미 있고 그 뒤로 3줄이 더 쌓였다 | `recordIteration` | 창이 직전 회전 이후로 잡혀 `toolCalls=3` — 앞 회전 몫을 다시 세지 않는다 | 001 |
| S3 | 훅이 설치되지 않아 툴 로그 파일이 없다 | `recordIteration` | `measured:false`·`toolCalls:null`, `elapsedMs` 는 정상 계산 | 003 |
| S4 | 툴 로그가 회전하며 마커를 남겼고 `keptFrom` 이 창 시작보다 뒤다 | `recordIteration` | `truncated:true` 로 남고 `readBudget` 합계에서 빠진다 | 004 |
| S4b | 창 시작 직후에 툴콜이 없어 로그 첫 줄이 창 시작보다 뒤지만 회전은 없었다 | `recordIteration` | `truncated:false` — 정상 회전이 합계에 든다 | 004 |
| S5 | 측정된 회전 2건과 미측정 1건이 섞여 있다 | `readBudget` | `costMeasured=2` — 합계의 분모가 3이 아님을 소비자가 알 수 있다 | 006 |
| S6 | 계측 중 예외가 난다 | `recordIteration` | 회전 기록 자체는 성공한다 (fail-open) | 003 |

---

## 4. Out of Scope

- 토큰·요금 계측 (하네스가 주지 않으면 셀 수 없다)
- 계측치를 근거로 한 효율 주장 — 데이터가 쌓이기 전에는 쓰지 않는다
- `vibe.test bench` (로드맵 3번, 이 SPEC 의 산출물을 입력으로 쓴다)
- 비용을 stuck·시운전·게이트 판정에 반영하는 것
