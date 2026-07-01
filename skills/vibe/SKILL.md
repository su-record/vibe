---
name: vibe
description: Dynamic dispatcher — 자연어 요구사항 + 첨부(URL/이미지/PDF/파일)를 받아 적합한 vibe.* 파이프라인을 동적 설계하고 1회 승인 후 체인 실행
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

> **⏱️ Timer**: 시작 시 `getCurrentTime` 호출하고 결과를 `{start_time}` 으로 기록한다.

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
| **figma-driven UI** | figma.com URL, "디자인", 이미지/PDF + UI 단어 | figma-extract → figma-convert → run → verify |
| **clone existing UI** | 일반 웹사이트 URL + "비슷한", "클론", "이런 느낌" | clone → run → verify |
| **resume in-progress** | feature name + `.vibe/specs/{name}.md` 존재 | (resume 지점부터) |
| **review only** | "리뷰", "검토만", 코드/SPEC 첨부 + "확인" | review |
| **regression fix** | "회귀", "테스트 깨졌", "다시 통과" | regress → run → verify |
| **contract drift** | "API 변경", "계약 깨졌", "스펙 불일치" | contract → regress (P1만) |
| **scaffold** | "프로젝트 만들기", "셋업", "초기 구조" | scaffold |
| **docs sync** | "문서 갱신", "README", "AGENTS.md" | docs |
| **analyze** | "분석", "조사", "이건 뭐야" + 파일/URL | analyze |
| **reason** | "추론", "깊게 생각", "트레이드오프", "어떻게 접근" 등 복잡한 사고 요청 | reason |
| **event** | "이벤트", "커뮤니티", "D-Day", "행사 자동화" | event |
| **harness check** | "하네스", "환경 점검" | harness |
| **test self** | "vibe 테스트", "CC ↔ Codex 비교" | test |
| **utils** | "이어서", "메모리", "체크포인트" | utils |

복수 의도면 우선순위: resume > figma-driven > new feature > 기타.

> **⚠️ 위 표는 닫힌 화이트리스트가 아니라 "흔한 케이스 빠른 경로"다.** 표에 없는 요구사항이라도 막지 말고 **Catch-all 라우팅**(아래)으로 처리한다.

### Catch-all 라우팅 (표에 없는 의도)

입력이 위 표 어느 행과도 명확히 매칭되지 않으면:

1. **의미 매칭**: 사용 가능한 모든 `vibe.*` 스킬의 `description` 을 읽어 요구사항과 의미적으로 가장 가까운 스킬을 고른다. (표는 참고용일 뿐, 실제 라우팅 후보는 설치된 전체 `vibe.*`)
2. **복합 설계**: 단일 스킬로 안 되면 여러 스킬을 조합한 파이프라인을 동적으로 설계한다.
3. **되묻기는 최후**: 어떤 스킬과도 매칭이 안 될 때만 사용자에게 "어떤 작업인지" 명확화 질문을 한다.

> 새 `vibe.*` 스킬이 추가되어 위 표에 행이 없더라도, Catch-all 이 description 기반으로 자동 라우팅하므로 기능이 막히지 않는다. 표 누락 = 기능 제한이 되어선 안 된다.

### Phase 2: Smart Resume 감지

```
.vibe/.last-feature 존재 → 직전 feature 이름 추출
.vibe/specs/{feature}/ 또는 .vibe/specs/{feature}.md 존재 → spec 단계 완료
.vibe/features/{feature}/ 또는 .vibe/features/{feature}.feature 존재 → feature 단계 완료
.vibe/plans/{feature}.md · .vibe/interviews/{feature}.md 존재 → 레거시 아티팩트 (구버전) — spec 패스의 입력 컨텍스트로만 사용, 재생성 금지
```

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

승인된 파이프라인을 순차 호출:

```
호출 형식: SlashCommand({command: "/vibe.{name} <args>"})

예:
1. SlashCommand({command: "/vibe.spec \"패럴랙스 웹사이트\""})
2. SlashCommand({command: "/vibe.figma"})
3. SlashCommand({command: "/vibe.run"})
...
```

각 phase 종료 후 JUDGE 단계:
- 게이트 통과 (P1=0 ∧ verifyPassed) → 루프 종료, Phase 5 보고
- 게이트 미통과 → RECORD(run-ledger + loop-history.jsonl) 후 다음 ANCHOR로
- stuck(연속 2회 동일 findings 해시) → `automationLevel: confirm`이면 사용자 질문; `autonomous`이면 TODO 기록 후 루프 종료
- max_iterations(기본 10) 도달 → 잔여를 인박스로 이월

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
⏱️ 완료: {getCurrentTime 결과}
```

## Routing Examples

### 예시 1: 신규 + figma

```
입력: /vibe "https://www.figma.com/design/abc/login 로 로그인 페이지"

→ Intent: figma-driven UI
→ Resume: 없음
→ Pipeline:
   1. /vibe.figma  (figma-extract + figma-convert)
   2. /vibe.spec   (생성된 SPEC 자동 보정)
   3. /vibe.run
   4. /vibe.verify
   5. /vibe.trace
```

### 예시 2: Resume

```
입력: /vibe "이어서"  (혹은 빈 호출)

→ Resume: .vibe/specs/login/ 발견 (3개 phase 파일)
→ .vibe/features/login/ 없음
→ Pipeline:
   1. /vibe.run (구현부터)
   2. /vibe.verify
   3. /vibe.trace
```

### 예시 3: Review only

```
입력: /vibe "이 코드 리뷰만" + 📎 src/auth/login.ts

→ Intent: review only
→ Pipeline:
   1. /vibe.review (단일 phase)
```

### 예시 4: automationLevel autonomous (ultrawork 별칭)

```
입력: /vibe "결제 API 만들어줘" ultrawork

→ automationLevel: autonomous 설정 → SPEC 승인 게이트 skip
→ 병렬 ACT 활성화
→ ANCHOR→ACT→JUDGE→RECORD 루프 (게이트 통과까지 자동 반복)
→ stuck 시 TODO 기록 후 루프 종료 (사용자 질문 없음)
```

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

## Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 /vibe Dynamic Dispatcher
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Phase 0: Input 분석]
...

[Phase 1: Intent 분류]
→ new feature + figma-driven UI

[Phase 2: Resume 감지]
→ 진행 중인 작업 없음

[Phase 3: 파이프라인 설계]
...

[Phase 4: 실행]
... (SPEC 승인은 spec 단계 내부의 1회 게이트)

[Phase 5: 종료 보고]
...
```

---

ARGUMENTS: {자연어 요구사항 + 첨부}
