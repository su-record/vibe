# SPEC: 역방향 계약 드리프트 (구현 → SPEC)

- **Created**: 2026-09-02
- **Status**: VERIFIED (2026-09-02 — 게이트 전량 exit 0)
- **Class**: feature
- **Stakes**: production — 배포되는 스킬 본문 계약과 공개 tools export 를 바꾼다. 잘못 잡으면 verify 게이트가 오작동한다
- **Tech Stack**: TypeScript (ESM), Vitest, Markdown 스킬 본문

---

## 1. Overview / Goal

`vibe.contract` 는 **SPEC → 구현** 한 방향만 본다. 구현이 SPEC 에 없는 표면(엔드포인트·필드·상태 코드)을
갖게 되어도 아무도 모른다. 결과적으로 SPEC 은 승인 시점에 얼어붙고, "의도 설계자" 의 산출물이
시간이 지날수록 실제 시스템과 멀어진다.

이 SPEC 은 반대 방향 대조(`reverse`)를 추가한다. 핵심은 방향만 뒤집는 것이 아니라 **등급 매핑을
뒤집는 것**이다 — 구현에만 있는 표면은 코드 실패가 아니라 **SPEC 결손**이므로 루프를 차단하지 않고
인박스(사람 리뷰 큐)로 간다.

### Context Sources

| 등급 | 뜻 |
|---|---|
| `[확인]` | 코드·문서에서 직접 읽었다 |
| `[해석]` | 읽은 것에서 추론했다 |
| `[모름]` | 확인하지 못했다 |

- [확인] `skills/vibe.contract/SKILL.md` — `extract`/`check`/`diff` 3종. 전부 "The SPEC is the source of truth" 전제. Storage Contract 는 `.vibe/contracts/<feature>.md` 와 `<feature>.snapshot.md` 두 파일
- [확인] `skills/vibe.contract/SKILL.md` Integration Points — `/vibe.verify` 시나리오 통과 후 `check`, P1 drift → verify 를 fail 로 강등 + regress 자동 등록
- [확인] `vibe/rules/loop-contract.md` "Judge 권한 경계" — 판정된 P1(Model Judge 발견)은 **단독으로 차단하지 않는다**. 내릴 기준이 없으면 게이트 실패가 아니라 인박스 항목이다
- [확인] `hooks/scripts/loop-ledger.js` — `inbox <name> <ok|fail|stuck> [line...]` 서브커맨드가 이미 있고 `lib/inbox.js` 의 `prependInboxBlock` 을 호출한다. 인박스는 `.vibe/loops/inbox.md`(커밋 대상)
- [확인] `src/tools/spec/traceabilityMatrix.ts:17` — `TraceItem` 은 `requirementId` 로 키가 잡힌다. REQ 가 없는 항목은 **행을 만들 키가 없다**
- [확인] `src/tools/spec/validateSpecDocument.ts` — 노드 가드 구현 선례. 순수 함수 + `SpecFinding[]` + `formatSpecValidation`
- [확인] `package.json` `validate:plugin-tree` — `build-plugin.ts` 재생성 후 `git diff --exit-code`. `plugins/vibe/` 는 직접 편집 금지
- [확인] `CLAUDE.md` Complexity Limits — 함수 ≤50줄 · 중첩 ≤3 · 파라미터 ≤5 · Cyclomatic ≤10. `max-params` 는 신규 위반 0건 강제
- [해석] 역방향 판정은 LLM 추출에 의존한다(구현 파싱은 `check` 와 같은 경로) — 따라서 판정 자체는 Model Judge 이고, loop-contract 표에 따라 **차단 권한이 없다**. 이 SPEC 이 결정론으로 고정할 수 있는 것은 판정이 아니라 **판정의 귀결**(등급·목적지)이다
- [모름] 실제 프로젝트에서 역방향 결손이 얼마나 발생하는지 — 이 저장소에 측정 데이터가 없다. 빈도를 근거로 삼지 않고, 경로가 아예 없다는 사실만 근거로 삼는다

### Assumptions

훑었으나 묻지 않고 기본값을 채택한 항목 전부:

1. 역방향 드리프트 종류는 4종으로 고정한다: `unspecified-endpoint` · `unspecified-field` · `unspecified-status-code` · `unspecified-parameter`
2. "구현이 SPEC 보다 **좁다**"(약속한 필드가 없다 등)는 역방향이 아니라 기존 `check` 의 관할이다 — 여기서 다루지 않는다. 역방향은 `구현 ⊃ SPEC` 만 본다
3. 등급은 `unspecified-endpoint` = P2, 나머지 3종 = P3. **P1 은 만들지 않는다** — 역방향에 P1 이 존재하면 차단 권한 없는 판정이 차단하게 된다
4. 목적지는 전 종류 인박스 고정. 게이트(`gate open`)로 보내지 않는다 — 게이트는 *지금 답을 기다리는 질문*이고, SPEC 결손은 답을 기다리지 않는다
5. 저장 위치는 `.vibe/contracts/<feature>.reverse.md` (기존 Storage Contract 에 파일 1종 추가)
6. RTM 에는 행을 추가하지 않는다 — `TraceItem` 이 `requirementId` 키인데 구현에만 있는 표면에는 REQ 가 없다. 키 없는 행을 넣으면 커버리지 계산이 오염된다
7. `vibe.verify` 통합 지점은 기존 `check` 직후. `check` 가 P1 으로 verify 를 강등하는 경로에 **영향을 주지 않는다**
8. `vibe.regress` 자동 등록을 하지 않는다 — 회귀 테스트는 "다시 깨지면 안 되는 동작" 을 고정하는 것이고, SPEC 결손은 동작이 아니다
9. 신규 모듈은 `src/tools/contract/`. `src/tools/index.ts` 에서 공개 export
10. 구현 파싱·엔드포인트 탐지는 **새로 만들지 않는다** — 기존 `check` 의 Framework Detection Rules 를 그대로 쓰고, 이 SPEC 이 추가하는 것은 판정 결과의 분류·기록뿐
11. Structure 다이어그램 절은 생략한다 — 새 경계·데이터 흐름 변경·3개 모듈 횡단 중 어디에도 해당하지 않는다 (기존 `src/tools/*` 패턴의 잎 모듈 1개 추가)
12. `CLAUDE.md` / `AGENTS.md` 의 `vibe.contract` 한 줄 서술을 갱신한다 — 현재 문구가 "SPEC 에서 추출한 계약과 구현을 비교" 로 단방향을 단언하고 있어 그대로 두면 틀린 서술이 된다

### 되돌리기 어려운 결정

없음 — 신규 순수 함수 모듈과 스킬 본문 텍스트다. 되돌리려면 커밋을 되돌리면 되고,
누적되는 데이터도 외부 계약도 없다. `.vibe/contracts/<feature>.reverse.md` 는 재생성 가능한 산출물이다.

### Constraints

- 이 저장소 파일만 수정한다 (`~/.claude`, `~/.codex`, `~/.vibe` 설치본 금지)
- **역방향 판정은 어떤 경우에도 루프를 차단하지 않는다** — loop-contract Judge 권한 경계
- 기존 `check` 의 P1 → verify 강등 경로를 건드리지 않는다
- `plugins/vibe/` 는 `npm run build:plugin` 으로 재생성한다
- 신규 함수는 복잡도 상한 준수 (≤50줄 · 파라미터 ≤5 · Cyclomatic ≤10), `any` 금지, 명시적 반환 타입

### Rejected Alternatives (Traps)

- **역방향 드리프트를 P1 으로 올려 verify 를 강등** — 판정 주체가 LLM 추출이라 오탐이 루프를 세운다. loop-contract 는 "판정된 P1 은 테스트·관측 기준으로 내리기 전에는 차단 근거가 아니다" 로 이미 이 경우를 배제한다
- **RTM 에 `unspecified-implementation` 행 추가** — `TraceItem` 이 `requirementId` 로 키를 잡는다. REQ 없는 행은 `coveragePercent` 분모를 오염시켜 커버리지 게이트를 왜곡한다
- **SPEC 을 자동으로 고쳐 쓴다** — SPEC 확정은 유일한 의무적 사람 개입 지점이다. 자동 갱신은 그 게이트를 우회한다
- **`gate open` 으로 사람을 세운다** — 게이트는 답을 기다리는 살아 있는 질문이고 `.vibe/gates/`(gitignore)에 산다. SPEC 결손은 결정이 끝난 뒤 남길 기록이므로 인박스(`.vibe/loops/` — 커밋)가 맞다

---

## 2. Requirements

| REQ ID | 요구사항 | Done Criteria |
|---|---|---|
| REQ-reverse-contract-drift-001 | 역방향 드리프트 종류 4종과 등급 매핑을 SSOT 로 정의한다 | DC-1 |
| REQ-reverse-contract-drift-002 | 모든 역방향 판정이 비차단이고 목적지가 인박스임을 코드로 고정한다 | DC-2 |
| REQ-reverse-contract-drift-003 | 판정 결과를 `.vibe/contracts/<feature>.reverse.md` 형식으로 포맷한다 | DC-3 |
| REQ-reverse-contract-drift-004 | 인박스 기록용 줄을 포맷한다 | DC-4 |
| REQ-reverse-contract-drift-005 | `src/tools/index.ts` 에서 공개 export 한다 | DC-5 |
| REQ-reverse-contract-drift-006 | `vibe.contract` 스킬에 `reverse` 서브커맨드를 배선한다 | DC-6 |
| REQ-reverse-contract-drift-007 | 기존 `check` 의 P1 강등 경로가 회귀하지 않는다 | DC-7 |
| REQ-reverse-contract-drift-008 | 배포 트리와 문서가 소스와 일치한다 | DC-8 |

### Done Criteria

| ID | 판정 | Evidence Required |
|---|---|---|
| DC-1 | `REVERSE_DRIFT_KINDS` 가 4종을 담고, 각 종류가 `classifyReverseDrift` 로 등급을 얻는다 | `npx vitest run src/tools/contract` exit 0 |
| DC-2 | 모든 종류에 대해 `blocking === false` 이고 `destination === 'inbox'` 이며 `severity !== 'P1'` | 동일 테스트 exit 0 |
| DC-3 | `formatReverseReport` 산출물이 frontmatter(`feature`·`compared-at`·`spec`·`kind-counts`)와 종류별 목록을 포함한다 | 동일 테스트 exit 0 |
| DC-4 | `formatReverseInboxLines` 가 발견 0건이면 빈 배열을 낸다 (빈 블록을 인박스에 남기지 않는다) | 동일 테스트 exit 0 |
| DC-5 | `import { classifyReverseDrift } from './dist/tools/index.js'` 가 해석된다 | `npm run build` exit 0 + 동일 테스트 exit 0 |
| DC-6 | `skills/vibe.contract/SKILL.md` 에 `reverse` 서브커맨드, 역전 등급표, 비차단 명시가 존재한다 | `npx vitest run src/tools/contract` 의 스킬 본문 계약 테스트 exit 0 |
| DC-7 | 기존 스킬 본문의 `P1 drift → demote verify to fail` 문구가 그대로 남아 있다 | 동일 테스트 exit 0 |
| DC-8 | `npm run validate:plugin-tree` · `verify:all` · `gen:plugin-hooks:check` · `validate:mermaid` 전부 exit 0 | 명령 출력 |

---

## 3. Scenarios

| # | Given | When | Then | REQ |
|---|---|---|---|---|
| S1 | 계약 파일에 `GET /users/:id` 만 있고 구현에 `GET /users/:id/avatar` 가 더 있다 | `reverse users` | `unspecified-endpoint` P2 1건이 `.reverse.md` 에 기록되고 인박스 줄이 생성된다 | 001·003·004 |
| S2 | 구현 표면이 계약과 정확히 일치한다 | `reverse users` | `.reverse.md` 가 `total: 0` 과 "결손 없음" 으로 생성되고, 인박스 줄은 **빈 배열**이라 호출하지 않는다 | 003·004 |
| S3 | 역방향 발견이 P2·P3 섞여 여러 건이다 | verify 시나리오 통과 후 `check` → `reverse` 체인 | verify 판정이 바뀌지 않는다 — 발견은 인박스로만 간다 | 002·006 |
| S4 | 구현이 SPEC 이 약속한 필드를 누락했다 | `reverse users` | 역방향의 관할이 아니다 — `check` 가 P1 으로 잡고 verify 를 강등한다 (회귀 없음) | 007 |
| S5 | 호출자가 알 수 없는 종류 문자열을 넘긴다 | `classifyReverseDrift('unspecified-galaxy')` | 조용히 통과시키지 않고 예외를 던진다 | 001 |

## 4. Out of Scope

- 구현 파싱기 신규 작성 (기존 `check` 의 프레임워크 탐지를 재사용)
- SPEC 자동 갱신
- 역방향 결손의 회귀 테스트 등록
- 개선 로드맵 2~5번 항목 (경제성 계측 · 벤치마크 · 런타임 축 · 일회성 코드 레인) — `.vibe/todos/` 에 별도 기록

## Anchors

이 SPEC 이 안착한 경로 — 사라지면 `npm run validate:spec-lifecycle` 이 빨간불을 켠다.

- `src/tools/contract/reverseDrift.ts`
- `src/tools/contract/index.ts`
- `src/tools/contract/reverseDrift.test.ts`
- `skills/vibe.contract/SKILL.md`
