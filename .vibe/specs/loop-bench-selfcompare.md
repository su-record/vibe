# SPEC: 루프 자기 대조 벤치마크

- **Created**: 2026-09-02
- **Status**: VERIFIED (2026-09-02 — 게이트 전량 exit 0)
- **Class**: feature
- **Stakes**: production — 배포되는 스킬 본문과 공개 tools export 를 바꾼다. 잘못되면 근거 없는 비교 수치가 문서로 흘러간다
- **Tech Stack**: TypeScript (ESM), Vitest, Markdown 스킬 본문

---

## 1. Overview / Goal

`loop-contract.md` 는 `per-iteration` vs `continuous` 를 두고 **"어느 쪽이 결과가 나은지는 vibe 가
측정한 바 없다"** 고 적어두었다. 축만 열어두고 기본값을 바꾸지 않은 이유가 그것이다. 이 SPEC 은
그 문장을 지울 수 있게 하는 도구를 만든다 — 외부 벤치마크와 겨루는 것이 아니라 **자기 대조**다.

핵심은 비교기가 아니라 **결론을 낼 수 없을 때 내지 않는 것**이다. 벤치마크 산출물이 곧
문서의 수치가 되므로, 판정을 사람의 절제에 맡기면 constitution §3.5 가 금지하는 배수·퍼센트가
바로 그 자리에서 만들어진다. 그래서 "판정 불가" 를 코드가 낸다.

### Context Sources

| 등급 | 뜻 |
|---|---|
| `[확인]` | 코드·문서에서 직접 읽었다 |
| `[해석]` | 읽은 것에서 추론했다 |
| `[모름]` | 확인하지 못했다 |

- [확인] `vibe/rules/loop-contract.md` 세션 축 절 — "어느 쪽이 결과가 나은지는 vibe 가 측정한 바 없다 … 기본값을 바꾸지 않고 축만 열어둔다"
- [확인] `hooks/scripts/lib/iteration-cost.js` — 회전 비용은 `measured` / `truncated` 로 신뢰도를 구분해 남긴다. 합계는 `measuredIterations`(분모)를 함께 낸다
- [확인] `hooks/scripts/lib/loop-ledger.js:readBudget` — 실행 단위 집계는 `{iterations, verified, remaining, exhausted, cost}`
- [확인] `vibe/constitution.md` §3.5 — 측정하지 않은 배수·퍼센트 금지. "더 빠르다" 로 방향만 적는 것이 틀린 배수를 적는 것보다 낫다
- [확인] `skills/vibe.test/SKILL.md:20` — "No subcommands. No CC-vs-Codex comparison semantics. One command, one report." 이 스킬의 관심사는 **설치 표면 점검**이다
- [확인] `skills/vibe.loop/SKILL.md` — 이미 서브커맨드 5종(`design`·`install`·`run`·`status`·`list`)을 갖고 `HISTORY=".vibe/metrics/loop-history.jsonl"` 를 읽는다
- [확인] `CLAUDE.md:177` · `AGENTS.md:173` — `/vibe.test` 에 `parity`·`report`·`compare` 서브커맨드가 있다고 적혀 있으나 스킬 본문은 "No subcommands" 다. **문서 드리프트** — 이 SPEC 이 같은 줄을 건드리므로 함께 고친다
- [확인] `src/tools/spec/validateSpecDocument.ts` — 노드 가드 선례. 순수 함수 + findings 배열 + formatter
- [해석] 실행 수가 적으면 어떤 차이든 우연과 구분되지 않는다. 이 저장소에 통계 도구가 없고 도입할 이유도 없으므로, **비모수적이고 보수적인 규칙**(범위 겹침)으로 판정 불가를 낸다 — 유의성 검정인 척하지 않는다
- [모름] `per-iteration` vs `continuous` 의 실제 차이 — **이 SPEC 의 산출물로 측정할 대상**이므로 여기서 값을 가정하지 않는다

### Assumptions

훑었으나 묻지 않고 기본값을 채택한 항목 전부:

1. 배치는 `vibe.test` 가 아니라 **`vibe.loop bench`** 다. `vibe.test` 는 본문이 "No subcommands / 설치 표면 점검" 으로 정체성을 못박았고, 벤치는 루프 설정을 비교하며 `loop-history.jsonl` 을 읽는다 — 루프 엔지니어링 관심사다 (로드맵 메모의 `vibe.test bench` 를 이 근거로 바꾼다)
2. 신규 스킬을 만들지 않는다 — 기존 스킬의 서브커맨드로 붙인다 (스킬 개수는 `validate:counts` 가 주장하는 수치이고, 축을 늘릴 이유가 없다)
3. 비교 단위는 **arm**(조건) — 최소 2개. 각 arm 은 `{id, description, config}`
4. `taskSet` 해시가 다른 실행은 비교하지 않는다. 다른 일을 시킨 결과를 나란히 놓는 것은 비교가 아니다
5. arm 당 최소 실행 수 기본 5. 미달이면 `insufficient-runs`
6. 사용 가능한(usable) 실행 = 비용이 `measured` ∧ `truncated` 아님 (2번 항목의 신뢰도 규약을 그대로 잇는다). **과제 셋 불일치는 제외 사유가 아니라 판정이다** — 조용히 버리면 사용자가 의도하지 않은 부분집합 위에서 비교가 진행되고 그 사실이 결과 어디에도 안 보인다. 관측된 해시를 전부 남기고 `compareArms` 가 `mixed-task-sets` 로 낸다
7. 판정 어휘 4종: `insufficient-runs` · `mixed-task-sets` · `inconclusive` · `difference-observed`. **`winner` 는 없다**
8. `difference-observed` 는 "차이가 관측됐다" 이지 "A 가 낫다" 가 아니다. 어느 쪽이 나은지는 지표의 방향(적을수록 좋은가)에 달렸고 그 판단은 사람이 한다
9. 판정 규칙: 두 arm 의 관측 **범위(min~max)가 겹치면 `inconclusive`**. 보수적이고 비모수적이며, 유의성 검정이 아님을 문서에 명시한다
10. 비교 출력에 **비율·퍼센트 필드를 만들지 않는다.** 차이는 절대 단위 `delta` 로만 낸다 — 필드가 있으면 쓰이고, 쓰이면 근거 없는 배수가 문서로 간다
11. 판정 지표는 2종: `iterations` · `cost.toolCalls`. 게이트 통과는 **비율이 아니라 개수**로 낸다(`gatePassed`/`usableRuns`) — 분모가 5인 비율은 정밀해 보이지만 아무것도 말하지 않는다. 경과 시간은 환경 소음이 커서 판정 지표로 쓰지 않는다
12. 벤치는 아무것도 차단하지 않는다. 리포트다
13. 리포트는 `~/.vibe/test-reports/` (프로젝트 로컬 아님 — 기존 규약)
14. 실행 자체(루프를 실제로 N회 도는 것)는 스킬 본문이 지시하고, 이 SPEC 의 코드는 **정의 검증·집계·판정·포맷**만 한다
15. Structure 다이어그램 절은 생략한다 — 새 경계 없음. 기존 `src/tools/*` 패턴의 잎 모듈 1개 추가

### 되돌리기 어려운 결정

없음 — 신규 순수 함수 모듈과 스킬 본문 텍스트다. 리포트는 재생성 가능하고 누적 스키마가 없다.

### Constraints

- 이 저장소 파일만 수정한다
- **비교 출력에 비율·퍼센트·배수 필드를 두지 않는다** (constitution §3.5)
- 판정 불가를 코드가 낸다 — 사람의 절제에 맡기지 않는다
- 벤치는 어떤 게이트도 차단하지 않는다
- 신규 스킬을 만들지 않는다
- 신규 함수는 복잡도 상한 준수 (≤50줄 · 파라미터 ≤5 · Cyclomatic ≤10), `any` 금지, 명시적 반환 타입

### Rejected Alternatives (Traps)

- **`vibe.test bench`** — 그 스킬 본문이 "No subcommands. One command, one report" 로 정체성을 못박았다. 설치 표면 점검과 루프 설정 비교는 입력도(설치 디렉토리 vs `loop-history.jsonl`) 관심사도 다르다
- **신규 스킬 `vibe.bench`** — 스킬 하나를 늘리는 비용이 서브커맨드 하나보다 크다. 기존 스킬이 이미 같은 데이터를 읽는다
- **t-검정·신뢰구간 도입** — 표본이 한 자릿수인데 유의성 검정을 붙이면 정밀해 **보이는** 숫자가 나온다. 없는 정밀도를 만드는 것이 근거 없는 배수보다 낫지 않다
- **비율 필드(`speedup`, `savingPercent`) 제공** — 필드가 있으면 쓰인다. §3.5 가 금지하는 문구가 바로 이 필드에서 만들어진다
- **경과 시간을 1차 지표로** — 머신·부하·네트워크가 섞여 arm 간 차이보다 잡음이 크다. `cost` 에 남기되 판정 지표로 쓰지 않는다
- **`winner` 판정** — "차이가 관측됐다" 와 "A 를 골라라" 는 다른 주장이다. 지표의 방향은 도메인 지식이고 코드가 모른다

---

## 2. Requirements

| REQ ID | 요구사항 | Done Criteria |
|---|---|---|
| REQ-loop-bench-selfcompare-001 | 벤치 정의를 코드가 검증한다 | DC-1 |
| REQ-loop-bench-selfcompare-002 | arm 별 집계에서 사용 불가 실행을 제외하고 사유별로 보고한다 | DC-2 |
| REQ-loop-bench-selfcompare-003 | 실행 수 미달이면 `insufficient-runs` 를 낸다 | DC-3 |
| REQ-loop-bench-selfcompare-004 | 태스크 셋이 다르면 `mixed-task-sets` 를 낸다 | DC-4 |
| REQ-loop-bench-selfcompare-005 | 범위가 겹치면 `inconclusive` 를 낸다 | DC-5 |
| REQ-loop-bench-selfcompare-006 | 차이는 절대 단위로만 내고 비율 필드를 만들지 않는다 | DC-6 |
| REQ-loop-bench-selfcompare-007 | 리포트가 판정과 그 근거를 함께 담는다 | DC-7 |
| REQ-loop-bench-selfcompare-008 | `vibe.loop` 에 `bench` 서브커맨드를 배선한다 | DC-8 |
| REQ-loop-bench-selfcompare-009 | `vibe.test` 서브커맨드 문서 드리프트를 고친다 | DC-9 |

### Done Criteria

| ID | 판정 | Evidence Required |
|---|---|---|
| DC-1 | arm 2개 미만·태스크 0개·arm id 중복이 각각 P1 findings 로 잡힌다 | `npx vitest run src/tools/bench` exit 0 |
| DC-2 | `summarizeArm` 이 `usableRuns` · `excluded` 사유별 개수 · 관측된 `taskSetHashes` 전부를 낸다 | 동일 테스트 exit 0 |
| DC-3 | 사용 가능 실행이 `minRunsPerArm` 미만이면 verdict 가 `insufficient-runs` | 동일 테스트 exit 0 |
| DC-4 | arm 간 `taskSetHash` 가 다르거나 한 arm 안에 2종 이상이면 verdict 가 `mixed-task-sets` — 실행을 버리지 않는다 | 동일 테스트 exit 0 |
| DC-5 | 두 arm 의 관측 범위가 겹치면 verdict 가 `inconclusive` | 동일 테스트 exit 0 |
| DC-6 | 비교 결과·리포트 어디에도 비율/퍼센트/배수가 없고 `delta` 는 절대 단위다. `difference-observed` 가 아니면 `delta` 는 `null` | 동일 테스트 exit 0 |
| DC-7 | 리포트에 verdict·사유·arm 별 분모가 포함되고, `difference-observed` 에도 "어느 쪽이 낫다" 는 문구가 없다 | 동일 테스트 exit 0 |
| DC-8 | `skills/vibe.loop/SKILL.md` 에 `bench` 서브커맨드와 판정 어휘 4종, 비차단 명시가 존재한다 | 동일 테스트(정적 계약 검사) exit 0 |
| DC-9 | `CLAUDE.md` · `AGENTS.md` 의 `vibe.test` 줄이 존재하지 않는 서브커맨드를 주장하지 않는다 | 동일 테스트 exit 0 |

---

## 3. Scenarios

| # | Given | When | Then | REQ |
|---|---|---|---|---|
| S1 | arm 이 1개뿐인 정의 | `validateBenchDefinition` | P1 `too-few-arms` | 001 |
| S2 | arm 별 usable 실행이 3건 (최소 5) | `compareArms` | `insufficient-runs` — 판정하지 않는다 | 003 |
| S3 | 두 arm 의 `taskSetHash` 가 다르다 | `compareArms` | `mixed-task-sets` | 004 |
| S4 | A 회전수 4~7, B 회전수 6~9 (범위 겹침) | `compareArms` | `inconclusive` | 005 |
| S5 | A 회전수 3~4, B 회전수 8~9 (겹침 없음) | `compareArms` | `difference-observed` + 절대 `delta` | 005·006 |
| S6 | 비용이 미측정·절단인 실행이 섞여 있다 | `summarizeArm` | 그 실행은 `excluded` 로 빠지고 사유가 남는다 | 002 |
| S8 | 한 arm 안에 과제 셋 해시가 2종 섞여 있다 | `compareArms` | `mixed-task-sets` — 섞인 실행을 버리고 진행하지 않는다 | 004 |
| S7 | `difference-observed` 결과 | `formatBenchReport` | 관측값과 분모를 적되 "A 가 낫다"·퍼센트가 없다 | 006·007 |

---

## 4. Out of Scope

- 루프를 실제로 N회 돌리는 실행기 — 스킬 본문이 지시한다
- 통계적 유의성 검정
- 외부 벤치마크(SWE-bench 등) 대조
- 벤치 결과로 기본값을 자동 변경하는 것 — 기본값 변경은 사람의 결정이다

## Anchors

이 SPEC 이 안착한 경로 — 사라지면 `npm run validate:spec-lifecycle` 이 빨간불을 켠다.

- `src/tools/bench/benchDefinition.ts`
- `src/tools/bench/benchCompare.ts`
- `src/tools/bench/benchReport.ts`
- `src/tools/bench/index.ts`
- `src/tools/bench/bench.test.ts`
- `skills/vibe.loop/SKILL.md`
