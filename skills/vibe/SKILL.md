---
name: vibe
description: 어떤 vibe 스킬을 써야 할지 정해지지 않은 요구사항이 들어왔을 때 — 자연어(+URL/이미지/PDF/파일 첨부)로 의도를 분류해 vibe.* 파이프라인을 동적 설계하고, SPEC 1회 승인 후 게이트 통과까지 체인 실행
argument-hint: "<자연어 요구사항> [+ URL/이미지/PDF/파일 첨부]"
user-invocable: true
---

# /vibe

**vibe의 메인 진입점.** 사용자는 "무엇을 만들지 / 무엇을 할지"만 자연어로 말한다. vibe가 의도를 분석해 어떤 `/vibe.*` 스킬을 어떤 순서로 호출할지 파이프라인을 동적으로 설계하고, **SPEC 확정 1회 승인 후 게이트 통과까지 루프 실행**한다.

> **루프 시맨틱 SSOT**: `vibe/rules/loop-contract.md` — 이 문서가 ANCHOR→ACT→JUDGE→RECORD 계약과 모든 파라미터(exit, stuck, max_iterations, automationLevel)를 정의한다.

## Usage

```
/vibe "패럴랙스 웹사이트 만들어줘"
/vibe "여기 figma 링크 https://figma.com/file/abc 로 로그인 페이지"
/vibe "로그인 회귀 테스트 다시 돌려서 통과시켜줘"
/vibe "이 SPEC 리뷰만 한번 봐줘" + 📎 .vibe/specs/login.md
/vibe "PRD 문서 기반으로 진행" + 📎 docs/prd.pdf
/vibe "..." --interactive     # 단계별 확인 모드 (회전마다 승인)
/vibe "..." --max-iter 1      # 1회 시도만
```

## Philosophy

> 사용자는 "무엇"만 말한다. "어떤 스킬을 어떻게" 는 vibe가 결정한다.

- **단일 슬래시 진입점**: `/vibe` 하나로 모든 워크플로 시작. 다른 `/vibe.*` 도 그대로 존재하지만 power user 가 명시적으로 phase 호출하고 싶을 때 쓰는 advanced 경로.
- **동적 파이프라인**: 의도/입력 종류에 따라 매번 다른 스킬 체인 구성. 미리 정해진 고정 흐름 아님.
- **무제한 라우팅**: 라우팅 표는 빠른 경로일 뿐 닫힌 화이트리스트가 아니다. 설치된 모든 `vibe.*` 스킬이 라우팅 후보이며, 표에 없는 요구사항도 description 기반 의미 매칭으로 처리한다 (Catch-all).
- **하네스 정규화 (추론 앞단)**: vibe는 CC(추론)·Codex(직역) 어느 하네스의 암묵적 동작에도 의존하지 않는다. `/vibe`가 모호한 NL을 **명시적·직역 가능한 지시로 먼저 전개**하고, 하위 skill은 모호한 입력을 받지 않는다. 이로써 모든 하네스에서 동일 결과 + CC급 편의를 제공한다. 전문: `vibe/rules/principles/dual-harness-doctrine.md`.
- **Smart Resume**: `.vibe/{specs,features}/` 감지하여 "이어서 진행?" 자동 제안 (레거시 `.vibe/{interviews,plans}/` 는 입력 컨텍스트로만 인식).
- **SPEC 확정 1회 승인 → 루프**: SPEC(Done의 정의 + 수용 기준)을 사용자와 확정하는 것이 유일한 의무적 사람 개입. 승인 후에는 `vibe/rules/loop-contract.md`의 ANCHOR→ACT→JUDGE→RECORD 루프를 게이트 전부 통과할 때까지 자동 반복한다. 루프 종료 = 게이트 통과 또는 stuck 또는 max_iterations 도달.
- **위임자 역할**: `/vibe` 본인은 코드를 직접 쓰지 않는다. 라우팅·설계·실행 위임만 한다.

## Process

> **⏱️ Timer**: 시작 시 시스템 시각을 조회해 `{start_time}` 으로 기록한다 (하네스 무관 — 셸 `date` 등 실행 가능한 수단).

### Phase 0: Input 수집

다음을 모두 파싱한다:

| 입력원 | 처리 |
|---|---|
| 자연어 텍스트 | 의도 추출 (요구 종류, 도메인, 키워드) |
| 첨부 파일 (`📎 path`) | 확장자로 분류 (md/feature/pdf/png/jpg/...) |
| URL | 도메인으로 분류 (figma.com / github.com / 기타) |
| 옵션 플래그 | `--interactive`, `--max-iter N` 등 루프 파라미터 추출; `ultrawork`/`ralph`/`quick` 등 deprecated 별칭은 loop-contract 매핑표로 변환 |

### Phase 1: Intent 분류

입력을 다음 의도 중 하나(또는 복수)로 분류:

| 의도 | 신호 | 기본 파이프라인 |
|---|---|---|
| **new feature** | "만들어줘", "추가", 신규 아이디어, 입력 없이 빈 호출 | spec → run → verify (trace/contract 는 사용자 요청 또는 SPEC 에 API Contract 섹션이 있을 때만) |
| **figma-driven UI** | figma.com URL, "디자인", 이미지/PDF + UI 단어 | figma (Extract → Convert Mode) → run → verify |
| **clone existing UI** | 일반 웹사이트 URL + "비슷한", "클론", "이런 느낌" | clone → run → verify |
| **resume in-progress** | feature name + `.vibe/specs/{name}.md` 존재 | (resume 지점부터) |
| **review only** | "리뷰", "검토만", 코드/SPEC 첨부 + "확인" | review |
| **regression fix** | "회귀", "테스트 깨졌", "다시 통과" | regress → run → verify |
| **contract drift** | "API 변경", "계약 깨졌", "스펙 불일치" | contract → regress (P1만) |
| **scaffold** | "프로젝트 만들기", "셋업", "초기 구조" | scaffold |
| **docs sync** | "문서 갱신", "README", "AGENTS.md", "다이어그램", "코드맵" | docs (diagram/codemaps 의도 포함) |
| **analyze** | "분석", "조사", "이건 뭐야" + 파일/URL | analyze |
| **reason** | "추론", "깊게 생각", "트레이드오프", "어떻게 접근" 등 복잡한 사고 요청 | reason |
| **event** | "이벤트", "커뮤니티", "D-Day", "행사 자동화" | event |
| **harness check** | "하네스", "환경 점검" | harness |
| **test self** | "vibe 테스트", "CC ↔ Codex 비교" | test |
| **session continue** | "이어서", "메모리", "체크포인트" | continue |
| **image generation** | "이미지 생성", "아이콘", "배너", "목업 이미지" | image |

복수 의도면 우선순위: resume > figma-driven > new feature > 기타.

### Phase 1-b: Stakes 분류 (태스크 무게)

의도와 별개로 태스크의 **무게(stakes)** 를 분류한다 — 매핑 SSOT: `vibe/rules/loop-contract.md`의 Stakes 표. 아래 표는 디스패처가 다른 파일을 로드하지 않고 판정할 수 있도록 둔 사본이며, **SSOT 와 문구가 어긋나면 SSOT 가 이긴다** (드리프트는 `stakes-contract.test.ts` 가 CI 에서 차단한다).

| stakes | 판정 신호 | 적용 프로파일 |
|---|---|---|
| `demo` | 명시 키워드(데모·일회성·실험·테스트용·throwaway·토이), 닫힌 표현(그냥·간단히·빠르게·한 줄만·quick·just — 보조 신호), 기존 프로젝트 코드와 무관한 신규 폴더, `.vibe/config.json` 없는 임시 디렉토리 | `--max-iter 1` + 리뷰 1패스 + **검증 스크립트 신규 생성 금지** |
| `prototype` | 검증용 초기 버전 명시, 유지보수 가능성 있으나 배포 대상 아님 | demo 와 동일 프로파일 |
| `production` | 기본값 — 신호 없음·**상충 포함** | 기존 기본 동작 (수렴 루프, 기본 리뷰어 셋) |

- **불확실하면 상향한다** (production). 신호가 상충하면 SPEC 승인 메시지에 stakes 확인 질문 1개를 편승시킨다 — 별도 확인 왕복을 만들지 않는다.
- **닫힌 표현은 보조 신호** — 기존 프로젝트 코드 위 작업에서 닫힌 표현만 있으면(명시 키워드·임시 디렉토리 없음) 단독 하향하지 않고 상충으로 간주해 편승 질문으로 확정한다 (SSOT: `vibe/rules/loop-contract.md`).
- **생략 불가**: 판정 결과는 Phase 3 실행 계획에 `Stakes:` 줄로 **반드시** 명시한다. `Stakes:` 줄이 없는 실행 계획은 무효 — 출력 전에 다시 작성한다. 판정값은 spec/run/review 체인에 전달되고 SPEC 헤더의 `Stakes:` 필드로 고정된다.

> **⚠️ 위 표는 닫힌 화이트리스트가 아니라 "흔한 케이스 빠른 경로"다.** 표에 없는 요구사항이라도 막지 말고 **Catch-all 라우팅**(아래)으로 처리한다.

### Catch-all 라우팅 (표에 없는 의도)

입력이 위 표 어느 행과도 명확히 매칭되지 않으면:

1. **의미 매칭**: 사용 가능한 모든 `vibe.*` 스킬의 `description` 을 읽어 요구사항과 의미적으로 가장 가까운 스킬을 고른다. (표는 참고용일 뿐, 실제 라우팅 후보는 설치된 전체 `vibe.*`)
2. **복합 설계**: 단일 스킬로 안 되면 여러 스킬을 조합한 파이프라인을 동적으로 설계한다.
3. **되묻기는 최후**: 어떤 스킬과도 매칭이 안 될 때만 사용자에게 "어떤 작업인지" 명확화 질문을 한다.

> 새 `vibe.*` 스킬이 추가되어 위 표에 행이 없더라도, Catch-all 이 description 기반으로 자동 라우팅하므로 기능이 막히지 않는다. 표 누락 = 기능 제한이 되어선 안 된다.

### Phase 2: Smart Resume 감지

**파일 존재 검사는 눈으로 하지 않는다 — 명령이 확정한다.** Phase 0 의 URL·첨부 분류와
stakes 의 결정론 신호(config 유무·임시 디렉토리·git 여부)도 이 한 번의 호출로 함께 받는다:

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/dispatch/index.js').then(t => { console.log(JSON.stringify(t.collectDispatchSignals(process.cwd(), {urls: [], attachments: [], feature: undefined}), null, 2)); })"
```

반환값을 **사실로 받는다**:

| 필드 | 의미 |
|---|---|
| `resume.resumeFrom` | `run`(SPEC 있음) / `none`(처음부터) |
| `resume.specPath` · `featurePath` | 실제 경로 (분할 SPEC `_index.md` 포함) |
| `resume.legacyArtifacts` | 구버전 plans/interviews — **입력 컨텍스트로만** 쓰고 재생성 금지 |
| `stakes.hasVibeConfig` · `isTempDir` · `isGitRepo` | Phase 1-b 의 결정론 신호 (언어 신호는 모델 판단으로 남는다) |
| `urls[].kind` | `figma` / `github` / `youtube` / `web` |
| `attachments[].kind` · `exists` | `spec` / `feature` / `document` / `image` / `code` |

> 의도 분류(Phase 1)는 그대로 모델이 한다 — 애매한 판단은 모델, 파일 존재·도메인·확장자는 코드다.

감지된 진행 상태가 있으면 사용자에게 명시:

```
🔍 진행 중인 작업 감지: "login"
   ✅ spec · ⏳ run

이어서 run 부터 진행할까요? 아니면 새 작업?
[1] 이어서 run
[2] 새 작업 (위 요구사항으로)
[3] 취소
```

### Phase 3: 파이프라인 설계

**먼저 입력을 정규화한다 (하네스 무관 명시화):**

- **예시·placeholder 표기**: 사용자가 설명용으로 던진 예시 텍스트를 실데이터로 넘기지 않는다. `<예시>`, `[채워넣을 값]` 로 명시. (직역 하네스가 그대로 데이터로 쓰는 것 방지)
- **research 명시**: 조사가 필요하면 파이프라인에 명시적 탐색 단계를 넣는다. planning mode 같은 하네스 스위치에 의존하지 않는다.
- **도메인 지식 흡수**: 사용자가 준 라이브러리·함수·파일 위치를 SPEC 입력으로 전달한다.

이어서 분류된 의도 + resume 상태 + 루프 파라미터(automationLevel, --max-iter 등)를 종합해 실행 계획 작성:

```
📋 Pipeline Plan

목표: 패럴랙스 웹사이트 신규 개발
Input: 자연어 ("패럴랙스 웹사이트 만들어줘")
Resume: 없음 (신규)
Keywords: 없음
Stakes: production (신호 없음 — 기본 상향)

Phase 1: /vibe.spec → 단일 패스 SPEC + 승인 (유일한 의무 게이트)
Phase 2: /vibe.figma → UI 디자인 트랙 (type=website 감지)
Phase 3: /vibe.run  → 구현
Phase 4: /vibe.verify → 검증

예상: 4 phase, 사람 개입 1회 (SPEC 승인)
```

설계된 파이프라인은 요약 출력 후 바로 실행한다 — **별도의 파이프라인 승인 게이트는 없다.** 유일한 의무적 사람 개입은 spec 단계 안의 SPEC 확정 승인이다 (loop-contract SSOT).

**SPEC 승인 skip 조건:**
- `automationLevel: autonomous` 설정 (`.vibe/config.json`) 또는 `ultrawork`/`ulw` 별칭 → SPEC 승인 게이트 skip, 루프는 정상 동작
- `--max-iter 1` 또는 `quick` 별칭 → 1회 시도 후 종료

### Phase 4: 체인 실행

승인된 파이프라인을 순차 호출한다. **호출 표면은 하네스마다 다르므로 아래 adapter 로 번역한다** — 어느 한쪽 문법을 본문에 박아두면 다른 하네스에서 그대로 깨진다.

| 하네스 | 호출 표면 |
|---|---|
| Claude Code | 스킬 로드 (`vibe.{name}`) — 슬래시 진입점 `/vibe.{name}` 과 동일 대상 |
| Codex | 스킬 로드 (`vibe.{name}`) — `$vibe.{name}` 또는 `/skills` |

```
호출 계약(하네스 무관): "skill `vibe.{name}` 을 인자 <args> 로 로드한다"

예 (파이프라인 3단계):
1. load skill vibe.spec   args: "패럴랙스 웹사이트"
2. load skill vibe.figma  args: (없음)
3. load skill vibe.run    args: (없음)
```

⛔ 본문에 `SlashCommand({...})` 같은 CC 전용 호출 문법을 쓰지 않는다. Codex 에는 그 도구가 없어
직역 하네스가 문자 그대로 실행하려다 실패한다 (dual-harness doctrine: 명시성 공통분모).
스킬 **이름과 인자**가 계약이고, 그것을 실제 호출로 바꾸는 것은 각 하네스의 몫이다.

**세션 경계 (`vibe.spec` Step 6 의 `[2]` 선택):** 사용자가 승인 메시지에서 `[2] 승인 → 새 세션에서 run` 을 골랐으면 **체인을 계속하지 않는다.** `vibe.run` 을 호출하지 말고 아래를 출력한 뒤 종료한다:

```
✅ SPEC 승인 완료: {feature-name}
   .vibe/specs/{feature-name}.md · .vibe/features/{feature-name}.feature

새 세션에서 재개하세요:
  /vibe.run "{feature-name}"
```

- execution packet 은 여기서 컴파일하지 않는다 — 새 세션의 `vibe.run` Step 1-0 이 담당한다 (컴파일 시점 불변).
- 별도 핸드오프 아티팩트를 만들지 않는다 — SPEC·Feature·`.vibe/.last-feature` 가 재개에 필요한 전부다.
- `automationLevel: autonomous` 에서는 `[2]` 가 선택될 수 없으므로(권고 자체를 띄우지 않음) 이 분기는 발생하지 않는다.
- 이 종료는 stuck 도 실행 실패도 아니다 — 루프 종료 사유가 아니라 **사용자 선택에 의한 정상 일시 중단**으로 기록한다.

각 phase 종료 후 JUDGE 단계:
- 게이트 통과 (**측정된** P1=0 ∧ verifyPassed) → 루프 종료, Phase 5 보고. 판정된 P1(리뷰어 findings)은 단독으로 게이트를 막지 않는다 — SSOT: `vibe/rules/loop-contract.md` Judge 권한 경계
- 게이트 미통과 → RECORD(run-ledger + loop-history.jsonl) 후 다음 ANCHOR로
- stuck(연속 2회 동일 findings 해시) → **어느 automationLevel 에서도 루프를 종료한다.** `confirm` 이면 사용자에게 묻되 질문을 컨텍스트에만 두지 말고 `loop-ledger.js gate open stuck-{feature} "<무엇이 막혔는지>" "<선택지…>"` 로 남긴다 — 세션이 끊겨도 무엇을 기다리는지 살아남는다 (게이트 객체 절). `autonomous` 면 질문 없이 TODO 기록 후 다음 독립 단위로. 미달을 완료로 기록하지 않는다 (SSOT: `vibe/rules/loop-contract.md` stuck 절)
- max_iterations(기본 10) 도달 → 잔여를 인박스로 이월
- **실행 실패(error)** — 스킬 미설치·도구 부재·파일 없음·명령 비정상 종료는 stuck 이 아니다(해시 비교로 안 잡힌다). 같은 방식으로 재시도하지 않고 루프를 종료한다: `confirm` 이면 원인을 제시하고 조치/건너뛰기/중단을 묻고, `autonomous` 이면 `loop-ledger.js inbox <name> fail "<원인>"` 기록 후 다음 독립 단위로. 실행 실패도 완료로 기록하지 않는다 (SSOT: `vibe/rules/loop-contract.md` 실행 실패 절)

### Phase 5: 종료 보고

```
✅ /vibe 완료

실행 파이프라인:
  ✅ /vibe.spec   (단일 패스 SPEC + 승인)
  ✅ /vibe.figma  (UI 디자인 트랙)
  ✅ /vibe.run    (구현)
  ✅ /vibe.verify (검증 — 9/9 통과)
  ✅ /vibe.trace  (RTM 100%)

생성물:
  📄 .vibe/specs/parallax-site.md
  📄 .vibe/features/parallax-site.feature
  📁 src/pages/parallax/
  📄 .vibe/reports/parallax-site-rtm.md

⏱️ 시작: {start_time}
⏱️ 완료: {종료 시 조회한 시스템 시각}
```

## Routing Examples & Output

라우팅 예시 4종(figma 신규 · resume · review only · autonomous)과 종료 보고 출력 포맷:
`references/routing-examples.md`

## ⛔ 하지 않는 것

- 직접 코드 작성 / 파일 수정 (위임만)
- SPEC 확정 없이 루프 진입 (SPEC = Done의 정의, 유일한 의무 승인 지점)
- 사용자가 명시한 phase 를 임의로 추가/제거
- Resume 상태를 무시하고 처음부터 다시 시작

## 루프 옵션

| 옵션 | 효과 |
|---|---|
| `--interactive` | 매 회전마다 사람 승인 (과거 기본값) |
| `--max-iter N` | 회전 상한 N 으로 설정 (N=1이면 1회 시도) |
| `automationLevel: autonomous` (`.vibe/config.json`) | stuck/SPEC 게이트 외 모든 확인 skip |

## Deprecated 별칭 (하위 호환 — 새 코드에서 사용하지 말 것)

> 아래 키워드는 계속 동작하지만 loop-contract 파라미터로 환원된다. 새 문서나 예시에서 가르치지 않는다. 전문: `vibe/rules/loop-contract.md` Deprecated 별칭 매핑표.

| 별칭 | 환원 |
|---|---|
| `ultrawork` / `ulw` | `automationLevel: autonomous` + 병렬 ACT |
| `ralph` | 기본 동작과 동일 (no-op); exit=coverage-100으로 해석 가능 |
| `quick` | `--max-iter 1` + 최소 JUDGE |
| `verify` | 기본 동작과 동일 (no-op) — JUDGE는 항상 결정론 검증 |
| `ralplan` | 동일 loop-contract를 계획 단계에 적용 |


## Done Criteria

- [ ] Intent 분류 결과와 Stakes 판정이 실행 계획에 명시됐다 (`Stakes:` 줄 없는 계획은 무효)
- [ ] Resume 감지를 수행했다 — `.vibe/{specs,features}/` 확인 기록이 있다
- [ ] SPEC 승인 게이트를 1회 통과했다 (또는 `automationLevel: autonomous` 로 skip 근거가 있다)
- [ ] 체인의 각 phase 가 하네스 중립 호출 계약으로 표현됐다 (CC 전용 문법 0건)
- [ ] 루프 종료 사유가 셋 중 하나로 기록됐다: 게이트 통과 │ stuck │ max_iterations