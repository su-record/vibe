---
name: vibe.spec
description: 자연어 요구사항이나 첨부 자료로 승인 가능한 SPEC을 작성해야 할 때 — 단일 패스로 작성하고 1회 승인 후 vibe.run으로 넘긴다.
argument-hint: "(선택) feature name, requirement, file path, or idea"
user-invocable: true
---

# /vibe.spec

## 완료 기준

- [ ] `.vibe/specs/<feature>.md`가 존재한다.
- [ ] 모든 REQ에 결정론적 Done Criteria와 Evidence Required가 있다.
- [ ] 제약, 범위 제외, stakes가 명시되어 있다.
- [ ] confirm mode에서는 사용자 승인 상태가 기록되어 있다.

**SPEC 단계의 얇은 진입점.** 요구사항을 받아 `spec` 스킬(단일 패스)을 실행하고, SPEC 승인(유일한 의무 게이트) 후 `/vibe.run` 으로 넘긴다. interview → plan → spec → review 다단계 파이프라인은 폐지되었다 — 명확화 질문은 spec 패스 안에서 인라인으로, 리뷰는 셀프 리뷰 1회로 흡수됐다.

## Usage

```
/vibe.spec                              # 빈 시작 — Smart Resume 또는 "무엇을 만들까요?"
/vibe.spec "패럴랙스 웹사이트"            # 아이디어/요구사항으로 시작
/vibe.spec "docs/prd.md"                # 외부 PRD/아이디어 파일 입력
/vibe.spec + 📎 첨부                     # 첨부 기반 시작
/vibe.spec "feature-name"               # 기존 feature 재개
```

## Flow

```
/vibe.spec ["input"?]
    ↓
Input 분석 + Smart Resume
    ↓
Execute the bundled implementation below — 단일 패스: 컨텍스트 수집 → (필요시) 인라인 질문 → SPEC + Feature 작성 → 셀프 리뷰 1회
    ↓
SPEC Code Guard (아래) — P1 이 있으면 승인으로 가지 않고 SPEC 작성으로 되돌아간다
    ↓
SPEC 승인 (1회 — automationLevel: autonomous 면 생략)
    ↓
/vibe.run "{feature-name}"
```

## Input 분석 + Smart Resume

```
1. 📎 첨부 있음 → 첨부를 spec 입력으로 전달
2. 인자가 파일 경로 →
     .vibe/specs/*.md   → 기존 SPEC: "승인 재확인? 재작성? /vibe.run 진행?" 질문
     기타 (.md/.txt/.pdf) → 외부 PRD 로 spec 입력에 병합
3. 인자가 feature name → .vibe/ 검색:
     spec 존재      → "재작성? 이어서 /vibe.run?" 질문
     spec 없음      → spec 패스 시작 (레거시 아티팩트가 있으면 입력으로)
4. 인자 없음 → .vibe/.last-feature 확인 → 있으면 "이어서 진행?" 제안,
     없으면 .vibe/specs/ 스캔해 진행 중 목록 제시, 그것도 없으면
     "👋 무엇을 만들고 싶으신가요?" 로 빈 시작
```

### 레거시 아티팩트 호환 (구버전 .vibe/interviews/, .vibe/plans/)

Legacy `.vibe/interviews/` or `.vibe/plans/` artifacts가 실제로 감지된 경우에만 `references/legacy-artifacts.md`를 읽는다. 신규 프로젝트와 현재 형식만 있는 호출은 읽지 않는다.

### `.last-feature` 포인터

- spec 패스에서 feature 이름 확정 시 `.vibe/.last-feature` 에 한 줄 기록 (spec 스킬이 수행).
- 개인 작업 포인터이므로 git 커밋 금지 (`.gitignore` 에 `.vibe/.last-feature`).
- 워크플로 완주(verify 통과) 시 삭제.

## 구조 다이어그램 (조건부, 승인 전)

**경계가 바뀌는 SPEC 에만** 붙인다. 셋 중 하나라도 해당할 때:

1. 새 모듈·서비스 **경계** 도입
2. **데이터 흐름** 변경 (읽고 쓰는 주체나 순서)
3. **3개 이상 모듈** 횡단

해당하면 `vibe.docs` 의 `references/diagram-spec.md` 를 읽어 그 규범대로 Mermaid 를
그리고 SPEC 의 `### Structure` 절에 넣는다. **규범을 여기에 복사하지 않는다** — 코드
근거·노드 상한·간선 라벨 규칙은 그쪽이 SSOT 다.

왜 승인 **전**인가: 구현이 끝난 뒤 diff 에서 구조적 오해를 발견하면 수정 범위가
커진다. 산문 SPEC 은 "박스가 빠졌다 / 화살표가 거꾸로다" 를 숨기지만 그림은 드러낸다.

왜 **조건부**인가: 해당 없는 기능에까지 강제하면 비용만 오르고 통과 의식이 된다.
그리고 시각적 완성도는 정확성을 착각하게 만든다 — 그릴 이유가 없으면 그리지 않는 편이
낫다. 트리거에 걸리지 않으면 절을 지우고 넘어간다.

## SPEC Code Guard (승인 전 의무)

SPEC 을 쓴 직후, **승인을 요청하기 전에** 실행한다. 셀프 리뷰가 아니라 코드 판정이다:

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/spec/index.js').then(t => { const fs=require('fs'); const p='.vibe/specs/{feature-name}.md'; const r=t.validateSpecDocument(fs.readFileSync(p,'utf-8'),{specPath:p}); console.log(t.formatSpecValidation(r)); process.exitCode = r.valid ? 0 : 1; })"
```

| 검사 | 심각도 | 왜 하류가 깨지는가 |
|---|---|---|
| REQ-* ID 부재 | P1 | RTM 이 `status:"empty"` — 커버리지 게이트가 판정불가가 된다 |
| Stakes 부재/오값 | P1 | 디스패처가 파이프라인 깊이를 정할 입력이 없다 |
| Context Sources 근거 등급 부재 | P2 | 확인·해석·모름이 섞여 리뷰어가 해석을 확인으로 읽는다 |
| Done Criteria 부재/빈 섹션 | P1 | JUDGE 가 판정할 기준이 없다 |
| 미치환 placeholder | P1 | 직역 하네스가 예시 텍스트를 실데이터로 넣는다 |
| Scenarios 부재 | P2 | `vibe.run` 시나리오 루프의 분해 단위가 없다 |
| REQ 슬러그 ≠ 파일명 | P2 | 게이트는 통과하나 ID 규약 이탈로 추적이 흐려진다 |

**P1 이 하나라도 있으면 승인 요청으로 넘어가지 않는다** — SPEC 작성으로 되돌아가 고치고 다시 검사한다 (backward edge). 2회 연속 같은 findings 면 stuck 으로 처리한다 (SSOT: `vibe/rules/loop-contract.md`). P2 는 통과를 막지 않고 승인 메시지에 함께 표시한다.

## 승인 게이트를 디스크에 남긴다

승인을 요청하기 **전에** 게이트를 연다. 세션이 끊겨도 무엇을 묻고 있었는지 남는다
(SSOT: `vibe/rules/loop-contract.md` 게이트 객체 절):

```bash
node "$HOOKS_DIR/loop-ledger.js" gate open spec-{feature-name} \
  "SPEC '{feature-name}' 로 진행할까요? {가정 1건 명시}" \
  "승인 → run 진행" "수정 후 재작성" "중단"
```

사용자가 답하면 `gate answer spec-{feature-name} "<선택>"` 으로 닫는다. 이미 열린
게이트가 있으면(ANCHOR 의 `openGates`) 같은 질문을 새로 만들지 말고 그것을 이어받는다.

## 승인과 루프

SPEC 승인이 `vibe/rules/loop-contract.md` 가 정의하는 **유일한 의무적 사람 개입**이다. 승인 후에는 ANCHOR→ACT→JUDGE→RECORD 루프가 게이트 통과까지 자동 반복한다 (`/vibe.run` → `/vibe.verify`). 별도의 파이프라인 승인·단계별 stop gate 는 없다.

- `automationLevel: autonomous` (`.vibe/config.json`) 또는 deprecated `ultrawork`/`ulw` 별칭 → SPEC 승인도 생략, 비대화형 완주.
- `--interactive` → 회전마다 확인 (과거 기본값).

## Next Step

```
/vibe.run "{feature-name}"        # 승인된 SPEC 구현 (spec 승인 직후 자동 제안)
/vibe.verify "{feature-name}"     # Done Criteria 판정 → run-ledger 기록
```

trace(`/vibe.trace`)·contract(`/vibe.contract`) 는 사용자가 요청하거나 SPEC 에 API Contract 섹션이 있을 때만 체인한다.

---

## Bundled implementation


# spec — Single-Pass SPEC

자연어 요구사항 하나를 받아 **한 번의 패스로** 실행 가능한 SPEC을 만든다. 별도의 interview → plan → review 단계는 없다 — 질문이 필요하면 이 패스 안에서 인라인으로 묻고, 리뷰는 셀프 리뷰 1회로 끝낸다. 완성된 SPEC의 승인이 loop-contract 가 정의하는 **유일한 의무적 사람 개입 지점**이다.

> 루프 시맨틱 SSOT: `vibe/rules/loop-contract.md`. SPEC = ANCHOR 아티팩트, Done Criteria = JUDGE 게이트.

## Input

| 입력 | 처리 |
|---|---|
| 자연어 요구사항 | 그대로 SPEC 패스의 주 입력 |
| 📎 첨부 (md/txt/pdf/이미지 등) | 하네스의 파일 읽기 수단(CC `Read` 도구 / Codex 셸 등)으로 전체를 읽어 분석 후 요구사항에 병합 |
| 파일 경로 인자 (PRD 등) | 존재 확인 후 전체를 읽는다 — 첨부와 동일 취급 |
| **레거시 아티팩트** `.vibe/interviews/{feature}.md`, `.vibe/plans/{feature}.md` | 존재하면 **입력 컨텍스트로만** 읽는다. 절대 요구하거나 재생성하지 않는다 — 없어도 정상 경로 |

## Process

### 1. Git branch + pointer

- `git branch --show-current` — `main`/`master` 이면 `git checkout -b feature/{feature-name}` (소문자·하이픈). feature 브랜치면 그대로 진행.
- feature 이름 확정 즉시 `.vibe/.last-feature` 에 이름 한 줄 기록 (값이 같으면 no-op).

### 2. Project context

- `.vibe/config.json` 읽기 — `references.languages[]` 의 스택 가이드, `stacks` 확인.
- 기존 코드 파악이 필요하면 하네스의 네이티브 협업 기능에 독립 탐색 worker로 위임한다. Claude Code는 Task/Agent, Codex는 native collaboration에 매핑하며 기본 모델을 상속한다 (coordinator session에서 프로젝트 전체를 훑지 않는다):

```text
Worker: Find existing implementations related to [FEATURE]. Return the tech stack,
relevant files, and patterns in under 200 tokens.
```

### 3. Clarify — 넓게 훑고, 좁게 묻는다

별도 인터뷰 단계가 아니다. 이 단계가 제한하는 것은 **질문 수가 아니라 사용자가 반드시 답해야 하는 수**다. 결정 지점은 전부 훑되(3-a), 사용자에게는 최대 3개만 묻는다(3-b). 나머지는 전부 Assumptions 로 편입된다 — 훑지 않아서 SPEC 에 아예 존재하지 않는 결정 지점을 없애는 것이 목적이다.

#### 3-a. 커버리지 스윕 (내부 단계 — 사용자에게 출력하지 않는다)

"이 요구사항으로 SPEC 을 쓸 때 결정이 필요한 지점" 을 **개수 제한 없이** 열거한다. 각 항목에 제안 기본값을 붙인다:

```
{결정 지점} → {제안 기본값} → {갈라짐: Done Criteria 가 실제로 달라지는가 yes/no}
```

훑을 축(최소): 범위 경계 · 데이터 모델의 필수 필드 · 외부 연동 여부 · 인증/권한 · 오류 처리 방침 · 수치 파라미터(타임아웃·크기·재시도) · 하위 호환 · 기존 테스트/계약 영향 · 산출물 위치 · 언어·표기 규약.

이 목록 자체는 출력하지 않는다. 출력 대상은 3-b 의 질문과 최종 SPEC 의 Assumptions 뿐이다.

#### 3-b. 답변 요청 (사용자에게 출력)

3-a 결과에서 `갈라짐: yes` 인 항목만 남기고, 그중 **최대 3개**만 묻는다. 3개를 넘으면 영향 범위가 큰 순으로 3개를 고르고 나머지는 기본값을 채택한다.

- 질문은 **한 번에 묶어서** (번호 목록), 각 질문에 제안 기본값을 붙인다.
- **3-b 로 묻지 않은 3-a 항목은 전부** SPEC 의 Assumptions 섹션에 기록한다. 누락 0건 — Step 5 체크리스트가 이를 점검한다.
- Assumptions 를 사용자에게 보일 때(Step 6)는 3개 이하면 전부, 3개 초과면 핵심 3개 + `그 외 N건은 SPEC 참조` 로 접어서 제시한다.
- `automationLevel: autonomous` 면 3-b 질문을 생략하고 3-a 전 항목의 기본값을 채택해 Assumptions 에 기록한다.

사소한 값(타임아웃, 페이지 크기, 재시도 횟수 등)은 3-a 에서 `갈라짐: no` 로 판정해 묻지 말고 상식적 기본값 + Assumptions 로 처리한다.

### 4. Write SPEC — one pass

`vibe/templates/spec-template.md` 구조로 `.vibe/specs/{feature-name}.md` 를 작성한다. 핵심 요건:

- **Stakes (헤더 필수 필드)** — `demo | prototype | production` + 판정 근거 1구. 디스패처가 전달한 판정값을 기록하고, 직접 진입(`/vibe.spec`)이면 여기서 판정한다 (SSOT: `vibe/rules/loop-contract.md` Stakes 표, 불확실하면 production). demo/prototype 이면 SPEC 자체도 경량으로 — 분할 금지, Done Criteria 최소화.
- **Overview / Goal** — 무엇을, 왜. 1-3 문장.
- **Context Sources** — 입력으로 사용한 파일·문서·URL·관측 상태. 출처 없는 추정은 Assumptions 로 분리.
- **Requirements** — `REQ-{feature}-NNN` ID와 연결된 Done Criteria를 표로 명시.
- **Done Criteria** — 결정론적 게이트만. 각 항목은 "명령/관찰로 pass·fail 판정 가능"해야 한다 (테스트 exit code, 빌드 성공, 특정 동작 관찰). "잘 동작한다" 류 서술 금지 — 이것이 루프의 JUDGE 입력이 된다.
- **Evidence Required** — Done 을 증명할 명령 결과·테스트 리포트·로그·스크린샷·코드 위치.
- **Human Taste (Non-Blocking)** — UX·브랜드·제품 감각처럼 release 시 사람이 판단할 기준. 완료 게이트로 쓰지 않는다.
- **Scenarios** — Given-When-Then. Happy path + 주요 edge case. 각 시나리오는 Done Criteria 중 하나에 매핑.
- **Out of Scope** — 이번에 하지 않는 것을 명시 (비어 있으면 스코프 팽창 신호).
- **Assumptions** — 3단계에서 채택한 기본값 전부.
- **Constraints** — 구현·보안·호환성 경계. execution packet으로 압축돼도 반드시 보존한다.
- **Rejected Alternatives (Traps)** — 검토했으나 기각한 설계 접근 + **기계적 기각 사유** 1줄씩 ("확장 안 됨" 같은 라벨이 아니라 "shelve 는 multi-writer 에서 thread-safe 하지 않다" 수준). 루프가 같은 막다른 길을 재방문하지 않기 위한 섹션 — Constraints 처럼 execution packet 압축에도 보존한다. 실질적 설계 선택지가 없었거나 demo/prototype 이면 생략.
- **API Contract** (해당 시에만) — 엔드포인트/요청/응답 형태. 이 섹션이 있으면 이후 `/vibe.contract` 가 drift 를 검사한다.

이어서 `.vibe/features/{feature-name}.feature` 를 생성한다: 시나리오 섹션을 gherkin 으로 변환 (Done Criteria ↔ Scenario 매핑 유지). `/vibe.run` 이 이 파일을 구현·검증 단위로 사용한다.

**Large scope** (5+ phases 또는 15+ 신규 파일 또는 4+ 독립 기능): 폴더 분할 — `.vibe/specs/{feature}/_index.md` + `phase-N-{name}.md`, feature 파일도 동일 구조로 매칭. 조용히 분할하고 결과만 보고한다.

**파일 규칙**: `.vibe/` 밖에 파일을 만들지 않는다. SPEC 파일마다 매칭되는 Feature 파일이 있어야 한다.

### 5. Self-review — once

작성 직후, 아래 체크리스트로 자기 SPEC 을 **1회** 점검하고 걸리는 항목을 즉시 고친다. 외부 LLM 리뷰 없음, 수렴 루프 없음 — 한 번 고치면 끝.

- [ ] 모든 Done Criteria 가 명령/관찰로 판정 가능한가 (모델 자기 보고가 아닌)
- [ ] Context Sources 와 Assumptions 가 분리됐고, 각 Done Criteria 의 Evidence Required 가 있는가
- [ ] Human Taste 가 결정론적 완료 게이트에 섞이지 않았는가
- [ ] 모든 시나리오가 Done Criteria 에 매핑되는가 (고아 시나리오 없음)
- [ ] 수치가 필요한 곳에 수치가 있는가 (제한·타임아웃·크기 — 없으면 기본값 + Assumptions)
- [ ] Out of Scope 가 비어 있지 않은가
- [ ] 요구사항에 있던 것 중 SPEC 에서 빠진 것이 없는가
- [ ] 3-a 커버리지 스윕에서 나온 결정 지점이 **전부** 3-b 질문 또는 Assumptions 중 하나로 귀결됐는가 (누락 0건)
- [ ] 설계 선택지가 있었던 결정에 기각 대안이 Rejected Alternatives (Traps) 로 남았는가 — 기계적 사유 포함 (production 만; 선택지가 없었으면 통과)
- [ ] 헤더에 `Stakes:` 필드가 있고, demo/prototype 인데 SPEC 이 분할·대형화되지 않았는가

### 6. Approval — the single gate

SPEC 요약(Goal, Done Criteria, 시나리오 수, Out of Scope, 열린 Assumptions)을 제시하고 승인을 받는다:

```
📋 SPEC 준비 완료: {feature-name}
   .vibe/specs/{feature-name}.md · .vibe/features/{feature-name}.feature

   Goal: {1줄}
   Stakes: {demo|prototype|production} — {판정 근거 1구}
   Done Criteria: {N}개 (전부 결정론 게이트)
   Scenarios: {M}개 · Out of Scope: {K}항목
   Assumptions: {3개 이하면 전부 · 초과면 핵심 3개 + "그 외 N건은 SPEC 참조"}

승인하면 이 SPEC 이 루프의 Done 정의가 됩니다.
[1] 승인 → 이 세션에서 계속   [2] 승인 → 새 세션에서 run{권장 표시}
[3] 수정 요청                 [4] 중단
```

- 수정 요청 → 반영 후 재제시 (사용자 주도 반복 — 자동 루프 아님).
- `automationLevel: autonomous` → 승인 생략, 요약만 출력하고 `[1]` 로 진행 (세션 경계 권고 없음 — 비대화형이라 리셋 불가).

#### 세션 경계 선택지 (`[2]`)

승인 게이트에 **편승하는 선택지**다. 별도 프롬프트를 만들지 않는다 — loop-contract 의 "의무적 사람 개입은 SPEC 승인 1회" 불변식을 지킨다.

- **선택지 개수는 항상 4개로 고정한다.** 트리거 충족 여부와 무관하게 `[1]`~`[4]` 를 그대로 출력한다. 조건에 따라 다르게 출력하지 않는다.
- 아래 관측 가능한 프록시 중 **하나라도** 충족하면 `{권장 표시}` 자리에 ` (권장)` 을 넣는다. 하나도 충족하지 않으면 빈 문자열로 둔다:
  1. 명확화 왕복 ≥ 2회 — 3-b 질문 배치 1회 = 1왕복, SPEC 수정 요청 1회 = 1왕복
  2. SPEC 수정 요청 ≥ 1회
  3. 분할 SPEC (5+ phase 로 폴더 분할됨)
- 컨텍스트 사용률(%)은 트리거로 쓰지 않는다 — 하네스 중립적으로 읽을 수단이 없어 CC 와 Codex 에서 권고 시점이 갈린다.
- `[2]` 를 권하는 근거: 명확화 왕복·SPEC 수정 과정·Rejected Alternatives 논의 텍스트가 구현 컨텍스트에 잔류하면 노이즈가 된다. 특히 기각안은 SPEC 에 "기각됨" 으로 적혀 있어도 대화 히스토리에는 살아있는 형태로 남는다.
- `[2]` 선택 시 SPEC·Feature·`.vibe/.last-feature` 는 이미 디스크에 있으므로 별도 핸드오프 아티팩트를 만들지 않는다. execution packet 은 지금 컴파일하지 않는다 — 새 세션의 `vibe.run` Step 1-0 이 그대로 담당한다.
- 승인 후 SPEC 변경은 코드 변경과 같은 커밋으로 (SPEC-First — `vibe.run` 참조).
- **Stakes 편승 질문**: 디스패처의 stakes 판정(`vibe/rules/loop-contract.md` Stakes 표)이 불확실하거나 신호가 상충하면, 이 승인 메시지에 stakes 확인 질문 1개(demo/prototype/production 선택지)를 포함한다. 별도의 추가 확인 왕복을 만들지 않는다 — 승인 게이트가 유일한 질문 지점이다.

## Output

| 파일 | 경로 |
|---|---|
| SPEC | `.vibe/specs/{feature-name}.md` (또는 분할 폴더) |
| Feature (BDD) | `.vibe/features/{feature-name}.feature` (또는 분할 폴더) |
| Pointer | `.vibe/.last-feature` |

Step 6 에서 `[2]` (새 세션에서 run) 를 선택했으면 여기서 종료하고, 새 세션에서 `/vibe.run "{feature-name}"` 로 재개한다 — 위 세 파일이 재개에 필요한 전부다.

승인된 SPEC 은 루프의 ANCHOR 로 쓰인다: `/vibe.run` 이 시나리오 단위로 구현·검증하고, `/vibe.verify` 가 Done Criteria 를 판정해 `.vibe/metrics/run-ledger.json` 의 `verifyPassed` 를 기록한다. 게이트 통과 여부는 항상 run-ledger·테스트 exit code 가 판정한다.

---

ARGUMENTS: $ARGUMENTS
