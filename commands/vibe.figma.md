---
description: Figma ↔ Code 양방향 라우터 — READ(Figma→Code) / WRITE(plan→Figma)
argument-hint: "[<figma-url>... | <plan.md>] [--new] [--create | --create-storyboard | --create-design] [--teach]"
---

# /vibe.figma

Figma와 코드 사이의 **양방향 라우터**. 인자 조합으로 분기를 결정하고, 분기에 맞는 스킬을 순차 로드한다.

## Usage

```
# Branch 1: READ — 컨벤션 준수
/vibe.figma                                          # 인터랙티브 (URL 줄바꿈으로 입력)
/vibe.figma <design-url>                             # 디자인 1개
/vibe.figma <storyboard-url> <mo-url> <pc-url>       # 스토리보드 + MO + PC 한 번에
/vibe.figma <mo-url> <pc-url>                        # MO + PC만

# Branch 2: READ — 독립 페이지 (컨벤션 무시)
/vibe.figma --new
/vibe.figma --new <mo-url> <pc-url>

# Branch 3: WRITE — plan.md → Figma 디자인 생성
/vibe.figma <plan.md> --create                       # full (와이어 + 본 디자인)
/vibe.figma <plan.md> --create-storyboard            # 와이어만 (Step E 생략)
/vibe.figma <plan.md> --create-design                # 본 디자인만 (Step D 생략)

# 공통
/vibe.figma --teach                                  # 어느 branch든 design-teach를 인터랙티브로 강제
```

> **URL 분류는 `vibe-figma` 스킬이 자동 처리합니다** — fileKey가 다른 URL은 스토리보드 vs 디자인으로, ROOT 노드 name의 "MO"/"PC"로 디바이스를 구분합니다. 사용자는 URL 종류를 신경 쓰지 않고 한 번에 던지면 됩니다.

## Branch Routing (필수: 첫 단계에서 결정)

다음 알고리즘을 **그대로** 실행한다. 추정 금지.

```
Step 1) 플래그 수집
  hasCreate           = args에 "--create" 포함 (정확히 일치, 아래 두 플래그와 별개)
  hasCreateStoryboard = args에 "--create-storyboard" 포함
  hasCreateDesign     = args에 "--create-design" 포함
  hasNew              = args에 "--new" 포함
  hasTeach            = args에 "--teach" 포함
  hasNewState         = args에 "--new-state" 포함 (Branch 3 전용: state 파일 무시하고 새로 그림)

Step 2) 위치 인자 분류
  positional  = 모든 비-플래그 인자
  mdArg       = positional 중 .md 로 끝나는 첫 번째 항목 (없으면 null)
  urlArgs     = positional 중 "figma.com/" 포함 항목 (배열, 0개 이상 가능)

Step 3) Create 모드 결정
  createFlags = [hasCreate, hasCreateStoryboard, hasCreateDesign].filter(x => x).length

  createFlags == 0 → createMode = null      (Branch 3 아님)
  createFlags == 1:
    hasCreate            → createMode = "full"
    hasCreateStoryboard  → createMode = "storyboard"
    hasCreateDesign      → createMode = "design"
  createFlags >= 2 → ❌ "--create / --create-storyboard / --create-design 중 하나만 사용 가능합니다."

  isBranch3 = (createMode != null)

Step 4) 모순 검증 (즉시 reject — 진행 금지)
  isBranch3 AND hasNew                  → ❌ "--create-* 와 --new는 함께 사용할 수 없습니다."
  isBranch3 AND mdArg == null           → ❌ "--create-* 는 plan.md 경로가 필요합니다.
                                              예: /vibe.figma .claude/vibe/plans/foo.md --create"
  isBranch3 AND urlArgs.length > 0      → ❌ "--create-* 모드에서는 figma URL을 위치 인자로 받지 않습니다.
                                              target 파일은 Step B에서 질문합니다."
  NOT isBranch3 AND mdArg != null       → ⚠ "plan.md를 받았지만 --create-* 플래그가 없습니다.
                                              Branch 3을 의도하셨나요? 어느 모드를 원하시나요?
                                                1) --create            (full: 와이어 + 본 디자인)
                                                2) --create-storyboard (와이어만)
                                                3) --create-design     (본 디자인만)
                                                4) abort"

Step 5) Branch 결정
  isBranch3   → Branch 3 (WRITE) — createMode 사용
  hasNew      → Branch 2 (READ, 독립)
  default     → Branch 1 (READ, 컨벤션)

Step 6) Branch 컨텍스트에 다음을 binding:
  {urlArgs, hasTeach, hasNewState, mdArg, createMode}
  - Branch 1/2는 urlArgs / hasTeach 를 사용 (URL 여러 개를 한 번에 스킬에 전달)
  - Branch 3은 mdArg / createMode / hasTeach / hasNewState 를 사용

결정 후, 해당 Branch 섹션의 Phase 순서대로 스킬을 로드/실행한다.
다른 Branch의 Phase는 절대 섞지 않는다.
```

## Context Reset

**이 커맨드 실행 시 이전 대화 무시.**
스토리보드/plan.md 스펙 > Figma 데이터 > 프로젝트 컨벤션 순으로 우선.

> **Timer**: Call `getCurrentTime` tool at the START. Record as `{start_time}`.

---

## URL/입력 규칙 (모든 Branch 공통)

```
AskUserQuestion 사용 시 절대 선택지(options) 제공 금지. 자유 텍스트만.
각 질문의 응답을 받은 후에만 다음으로 진행.
```

---

## Branch 1: `/vibe.figma` — READ + 프로젝트 컨벤션 준수

**시나리오**: 기존 프로젝트에 새 UI/페이지를 추가. 기존 디자인 토큰·컴포넌트·스타일 컨벤션을 따른다.

**입력**: Figma URL 여러 개 (스토리보드 + MO/PC 디자인을 한 번에). URL 종류 자동 분류.
**출력**: 프로젝트 `components/{feature}/`, `styles/{feature}/` (기존 토큰/컴포넌트 재사용)

### Phase 0 — Setup + URL 수집 + Project Context

```
1. URL 수집 (스킬 진입 전)
   - urlArgs.length > 0 → 그대로 vibe-figma 스킬에 전달 (인터랙티브 질문 생략)
   - urlArgs.length == 0 → vibe-figma 스킬이 인터랙티브로 줄바꿈 입력 받음
   ⚠ URL 분류(storyboard vs design, MO vs PC)는 스킬이 자동 처리 — router는 개입하지 않음
     · fileKey 다름 → storyboard vs design
     · ROOT 노드 name에 "MO"/"PC" → 디바이스 구분

2. Load skill `vibe-figma` — Phase 0 Setup
   → 스택 감지, 디렉토리, 피처명, component-index.json, project-tokens.json

3. Design context 로드 (non-interactive 기본)
   ⛔ design-teach 스킬을 자동으로 로드하지 말 것 (인터랙티브라 흐름이 끊김)

   알고리즘:
     - Read .claude/vibe/design-context.json
     - 존재 → 메모리에 binding 후 계속
     - 없음 → 다음 한 줄만 출력하고 계속:
         "💡 design-context.json 없음 — 기본값으로 진행합니다.
          톤/팔레트/타이포 가이드를 적용하려면 /design-teach 또는
          /vibe.figma --teach 로 다시 실행하세요."
     - hasTeach == true → 이때만 Load skill `design-teach`로 인터랙티브 진입
```

### Phase 1 — Storyboard 분석 (선택)

```
Load skill `vibe-figma` — Phase 1 Storyboard

   Phase 0에서 수집한 URL 중 "storyboard"로 자동 분류된 항목이 있으면 분석.
   없으면 이 Phase는 자동 SKIP (스킬 내부 처리).

   → 섹션 목록 + 기능 정의 + TypeScript 인터페이스 초안
   ❌ 코드 파일 생성 금지
```

### Phase 2 — 재료 확보

```
Load skill `vibe-figma-extract`
Load skill `vibe-figma` — Phase 2 (코디네이터: MO/PC 병렬 워커)

   Phase 0에서 수집한 URL 중 "design"으로 자동 분류된 항목 (MO/PC)을 사용.
   → tree.json + bg/ + content/ + sections/ (검증용)
```

### Phase 3 — 데이터 정제

```
Load skill `vibe-figma` — Phase 3
   ⛔ figma-refine.js 강제 (자체 정제 스크립트 금지)
   → /tmp/{feature}/{bp}-main/sections.json
```

### Phase 4 — BP별 스태틱 구현 (컨벤션 준수)

```
Load skill `vibe-figma-convert`
Load skill `vibe-figma` — Phase 4

   재사용 매칭 (BLOCKING):
     ① component-index.json 매칭 → import (새로 만들지 않음)
     ② project-tokens.json 매칭 → @use (새 토큰 생성 최소화)

   ⛔ figma-to-scss.js 강제 / figma-validate.js PASS 없이 다음 섹션 금지

⤵ Phase 4 후처리
Load skill `design-normalize`
   → 매칭 안 된 하드코딩 값 → MASTER.md 토큰으로 정렬
   → 새 토큰 필요 항목은 review 큐에 기록
```

### Phase 5 — 컴파일 게이트

```
Load skill `vibe-figma` — Phase 5
   → tsc/build/dev 서버. P1=0까지 루프. Stuck → 사용자 질문.
```

### Phase 6 — 시각 검증 + 품질 점검 (MANDATORY)

```
Load skill `vibe-figma` — Phase 6 (시각 검증 루프, P1=0까지)

⤵ Phase 6 후처리
Load skill `design-audit`
   → 5-dimension 점검 (a11y, performance, responsive, theming, AI slop)
   → P1 finding은 review 큐에 기록 (read-only)

⛔ Phase 6 + design-audit 완료 전까지 "완료 요약" 출력 금지.
```

---

## Branch 2: `/vibe.figma --new` — READ + 독립 규격

**시나리오**: 신규 독립 페이지 (랜딩, 프로토타입). 기존 컨벤션 무시, **Figma 원본 충실도 우선**.

**입력**: Figma URL 여러 개 (Branch 1과 동일 — 스토리보드 + MO/PC 자동 분류)
**출력**: `components/{feature}/` (독립 토큰, 새 컴포넌트 자유 생성)

### Phase 0 — Setup (Lite) + URL 수집

```
1. URL 수집 — Branch 1 Phase 0와 동일 (urlArgs 있으면 전달, 없으면 인터랙티브)

2. Load skill `vibe-figma` — Phase 0 Setup
   → 스택만 감지. 디렉토리 생성.
   ⛔ component-index.json 인덱싱 SKIP
   ⛔ project-tokens.json 스캔 SKIP
   (재사용 매칭을 강제하지 않으므로 인덱스 불필요)
```

### Phase 1 — Storyboard 분석 (선택)

```
Load skill `vibe-figma` — Phase 1
   → Branch 1 Phase 1과 동일 (storyboard URL이 있으면 분석, 없으면 SKIP)
```

### Phase 2 — 재료 확보

```
Load skill `vibe-figma-extract`
Load skill `vibe-figma` — Phase 2
   → Branch 1 Phase 2와 동일 (design URL로 추출)
```

### Phase 3 — 데이터 정제

```
Load skill `vibe-figma` — Phase 3 (figma-refine.js 강제)
```

### Phase 4 — BP별 스태틱 구현 (Standalone 모드)

```
Load skill `vibe-figma-convert`
Load skill `vibe-figma` — Phase 4

   ⛔ 재사용 매칭 SKIP — 새 컴포넌트 자유 생성
   ✅ 새 토큰 자유 생성 (피처 스코프 네이밍: $feature-color-xxx)
   ✅ figma-to-scss.js / figma-validate.js는 그대로 강제

   ❌ design-normalize 호출 금지 (이 Branch는 토큰 alignment 대상이 아님)
```

### Phase 5 — 컴파일 게이트

```
Load skill `vibe-figma` — Phase 5
```

### Phase 6 — 시각 검증 + a11y (MANDATORY)

```
Load skill `vibe-figma` — Phase 6 (시각 검증 루프, P1=0까지)

⤵ Phase 6 후처리
Load skill `design-audit`
   → a11y는 항상 검증. 컨벤션 무시 모드여도 접근성은 양보 불가.

⛔ Phase 6 + design-audit 완료 전까지 "완료 요약" 출력 금지.
```

---

## Branch 3: `/vibe.figma <plan.md> --create*` — WRITE (plan.md → Figma)

**시나리오**: plan.md의 UI 서술(Look & Feel, 레이아웃, 반응형)을 Figma 파일에 디자인으로 생성.

**입력**:
- 라우팅에서 받은 `mdArg` (필수, .md 경로)
- 라우팅에서 받은 `createMode` ∈ {full, storyboard, design}
- target Figma file URL/key (Step B에서 질문)

**출력**: 지정된 Figma 파일 내 새 페이지/프레임/섹션

> **Phase 명명 주의**: Branch 3은 `vibe-figma` 스킬의 Phase 0~6과 충돌을 피하기 위해 **Step A~F**로 표기한다.
> **2단계 생성 원칙**: `createMode == full`이면 본 디자인 직진 금지. 반드시 **와이어프레임(Step D) → 사용자 검토 → 본 디자인(Step E)** 순서.

### createMode별 실행 매트릭스

| Step | full | storyboard | design |
|---|---|---|---|
| A. plan.md 파싱 | ✅ | ✅ | ✅ |
| B. target file + state 로드 | ✅ | ✅ | ✅ |
| C. 디자인 시스템 발견 | ✅ | ⛔ SKIP (와이어는 컴포넌트 불필요) | ✅ |
| D. 와이어프레임 생성 | ✅ | ✅ | ⛔ SKIP |
| 🚪 Step D ↔ E 검토 게이트 | ✅ | ⛔ (Step E 없음) | ⛔ (Step D 없음) |
| E. 본 디자인 적용 | ✅ | ⛔ SKIP | ✅ (분기 동작, 아래 참조) |
| F. 시각 검증 | ✅ (full) | ✅ (wire 대상, 구조 체크만) | ✅ (design 대상) |

**`createMode == design`의 Step E 동작 (결함 없는 실행을 위한 분기)**:

- state.sections 가 **완전히 비어있음** (hasNewState 또는 첫 실행)
  → 각 섹션별로 새 frame 생성 후 **곧바로** 컴포넌트 배치 (와이어 placeholder 단계 통째로 생략)
  → 이 경로에서는 wireNodeId == designNodeId 가 됨 (같은 노드, 한 번에 완성)
- state.sections 에 **일부 섹션의 wireNodeId 가 존재**
  → 존재하는 섹션: 기존 wireNodeId 위에 덮어쓰기 (full 모드의 E와 동일)
  → 없는 섹션: ❌ reject "이 섹션({섹션명})은 와이어가 없습니다.
                      `--create-storyboard` 로 먼저 와이어를 만들거나, `--create` (full)로 호출하세요.
                      빈 state에서 처음부터 design 모드로 그리려면 `--new-state` 를 추가하세요."

### Step A — plan.md 파싱 + 디자인 컨텍스트

```
1. Read {mdArg}
   필수 추출 섹션:
     - "## 1. 개요" → 페이지 이름/목적
     - "## 7. Look & Feel" → 분위기, 컬러, 타이포, 레퍼런스, 인터랙션
     - "## 8. 레이아웃/섹션 구성" → 섹션 순서, 목적, 핵심 콘텐츠
     - "## 9. 반응형 전략" → 디바이스 우선순위, 브레이크포인트

   ⛔ 위 섹션 중 7/8 누락 시: 사용자에게 "plan.md에 UI 섹션이 비어있습니다.
      /vibe.spec를 먼저 돌려 기획서를 보강할까요?" 라고 묻고 중단.

   ✅ 피처명 결정: mdArg 파일명에서 .md 제거한 값을 {feature}로 사용

2. Design context 로드 (non-interactive 기본)
   - Read .claude/vibe/design-context.json
     · 존재 → 톤/팔레트 보강용으로 binding
     · 없음 → plan.md의 "## 7. Look & Feel" 값으로 임시 컨텍스트 구성
   - hasTeach == true 인 경우에만 Load skill `design-teach`로 인터랙티브 보강

3. Load skill `ui-ux-pro-max`
   → plan.md의 분위기/타이포/컬러 키워드로 가이드 매칭
   → 컬러 팔레트, 폰트 페어링, UX 가이드 후보 생성
```

### Step B — Figma 타겟 파일 + State 로드 + Plugin 규칙

```
1. AskUserQuestion (자유 텍스트):
   "디자인을 생성할 target Figma 파일 URL을 입력해주세요.
    (figma.com/design/{fileKey}/...)"

2. URL → fileKey 추출

3. State 파일 로드 (idempotency, 재실행 시 중복 생성 방지)
   경로: /tmp/{feature}/figma-create-state.json

   스키마:
     {
       "feature": "<feature>",
       "fileKey": "<figma fileKey>",
       "createdAt": "<ISO-8601>",
       "updatedAt": "<ISO-8601>",
       "planHash": "<sha256 of plan.md content>",
       "sections": [
         {
           "name": "<섹션 이름 (plan.md 8번 표 기준)>",
           "bp": "mo" | "pc",
           "wireNodeId": "<figma nodeId of wireframe frame>",   // Step D 결과
           "designNodeId": "<figma nodeId of styled frame>",    // Step E 결과 (없으면 null)
           "wireHash": "<sha256 of plan.md 8번 row — 레이아웃 키>",
           "designHash": "<sha256 of plan.md 7번+8번+9번 row — 비주얼 키>",
           "createdAt": "<ISO-8601>",
           "updatedAt": "<ISO-8601>"
         }
       ]
     }

   ⚠ wireHash와 designHash를 분리하는 이유:
     - plan.md 8번(레이아웃)만 변경 → wire 재생성 + design 재생성
     - plan.md 7번(Look & Feel)만 변경 → wire SKIP + design만 재생성
     - 둘 다 변경 안 됨 → 둘 다 cached

   알고리즘:
     - hasNewState == true → 기존 state 무시, 빈 state로 시작 (이전 nodeId 참조 안 함)
     - 파일 없음 → 빈 state 생성 (sections: []), Step D부터 모두 신규 생성
     - 존재 + state.fileKey != 입력 fileKey → ❌ 거부:
         "이 plan.md는 다른 Figma 파일({state.fileKey})에 매핑돼 있습니다.
          다른 파일에 새로 그리려면 --new-state 플래그를 추가하거나
          /tmp/{feature}/figma-create-state.json 을 삭제하세요."
     - 존재 + state.fileKey == 입력 fileKey → reuse 모드:
         · planHash 비교: 다르면 "plan.md가 수정됐습니다. 변경된 섹션만 update 진행" 안내
         · sections 매칭은 Step D(wireHash) / Step E(designHash)에서 각각 결정

4. Load skill `figma:figma-use` (MANDATORY prerequisite)
   → use_figma 호출 규칙 (color 0-1, 폰트 로드, layoutSizing 순서 등)

5. Load skill `figma:figma-generate-design`
   → 디자인 시스템 컴포넌트 발견 + 섹션별 조립 워크플로
```

### Step C — 디자인 시스템 발견

```
⛔ createMode == "storyboard" 인 경우 이 Step 전체 SKIP
   (와이어는 컴포넌트/변수 정보가 필요 없음)

Load skill `figma:figma-generate-design` — Step 2: Discover Design System

   2a. 컴포넌트: search_design_system 또는 기존 스크린 instance walk
   2b. 변수(토큰): get_variable_defs로 색/간격/radius 수집
   2c. 텍스트/이펙트 스타일: 발견된 토큰을 plan.md Look & Feel과 매칭
       매칭 안 되면 "이 plan.md는 기존 디자인 시스템에 없는 토큰을 요구합니다.
       새로 만들까요? (figma:figma-generate-library 권장) 또는 가까운 토큰으로 진행할까요?"
```

### Step D — 와이어프레임 생성 (incremental + idempotent)

**목적**: plan.md 8번(레이아웃)만으로 회색 박스 + 텍스트 placeholder의 골격을 그린다. 컬러/타이포/컴포넌트 인스턴스는 **금지**.

```
⛔ createMode == "design" 인 경우 이 Step 전체 SKIP
   (디자인만 모드는 Step E로 직진 — 와이어 단계 통째로 생략)

Load skill `figma:figma-generate-design` — Step 3 패턴 재사용 (와이어 모드)

   plan.md "## 8. 레이아웃/섹션 구성" 표를 순회:
     for each 섹션 in plan.md:
       1. 섹션 row 직렬화 → wireHash 계산 (8번 row만 해시)
       2. state.sections에서 같은 name 매칭:
          ├─ 매칭 없음 (신규):
          │    a. use_figma 호출로 wire 프레임 생성 (Auto Layout만)
          │       - 배경: #F5F5F5 (회색)
          │       - 자식: 핵심 콘텐츠 컬럼의 항목마다 회색 박스 + 텍스트 라벨
          │       - 컴포넌트 instance 배치 금지 (Step E에서 채움)
          │       - 변수 바인딩 금지 (Step E에서 채움)
          │    b. 반환된 wireNodeId를 state.sections에 entry append
          │       (designNodeId = null 로 초기화)
          ├─ 매칭 + wireHash 동일 (구조 변화 없음):
          │    SKIP, "✓ {섹션명} wire (cached)" 출력
          └─ 매칭 + wireHash 다름 (구조 변경됨):
               a. use_figma로 기존 wireNodeId 내부 정리 (children 삭제)
               b. 신규 케이스 a 재실행 (wireNodeId 재사용)
               c. state entry의 wireHash + updatedAt 갱신
               d. designNodeId가 있으면 → null로 리셋 (구조 바뀌었으니 본 디자인도 다시 그려야 함)

   ⛔ 한 번의 use_figma 호출에 모든 섹션을 몰아넣지 말 것.
      섹션 단위로 incremental 호출 → 검증 → 다음 섹션.

   반응형 처리:
     plan.md "## 9. 반응형 전략"의 브레이크포인트별로 별도 wire 프레임 생성
     state.sections에는 bp 필드로 mo/pc 구분하여 각각 entry 저장

   Step D 종료 직전:
     state.updatedAt = now
     Write /tmp/{feature}/figma-create-state.json
```

#### 🚪 사용자 검토 게이트 (Step D ↔ Step E 사이)

```
⛔ createMode != "full" 인 경우 이 게이트 SKIP
   - storyboard 모드: Step E가 없어서 게이트 의미 없음 → 곧바로 Step F로
   - design 모드: Step D가 없어서 게이트 의미 없음 → Step E 먼저 실행

1. mcp__plugin_figma_figma__get_screenshot 으로 와이어 프레임들 캡처
2. 사용자에게 제시:
   "📐 와이어프레임이 생성되었습니다.
    figma URL: https://figma.com/design/{fileKey}/...?node-id={firstWireNodeId}
    섹션 요약: 신규 N / 갱신 M / 캐시 K

    구조가 plan.md와 일치합니까?
      yes  → Step E (본 디자인) 진행
      <자유 텍스트> → 수정 요청 (해당 섹션의 wireHash 강제 무효화 후 Step D 재실행)
      abort → 워크플로 중단"

3. ralph/ultrawork 모드:
   사용자 질문 SKIP, 자동 yes로 Step E 진행
   (단, 섹션이 0개면 abort)
```

### Step E — 본 디자인 적용 (incremental + idempotent)

**목적**: plan.md 7번+8번+9번 기반으로 컴포넌트 인스턴스/색/타이포/실제 텍스트를 그린다. 모드에 따라 wireNodeId 재사용 여부가 달라진다.

```
⛔ createMode == "storyboard" 인 경우 이 Step 전체 SKIP
   (와이어만 모드는 Step E 없이 Step F로)

Load skill `figma:figma-generate-design` — Step 3+: Assemble Sections (디자인 모드)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
분기 A) createMode == "full":
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   state.sections를 순회 (Step D에서 채워진 상태):
     for each section in state.sections:
       1. 섹션 row 직렬화 → designHash 계산 (7번+8번+9번 row 해시)
       2. designNodeId == null 이거나 designHash 변경됨:
          a. use_figma로 wireNodeId 내부의 자식 정리 (placeholder 삭제)
             ⚠ wireNodeId 자체는 삭제 금지 (Auto Layout 골격 보존)
          b. 같은 wireNodeId 안에 컴포넌트 instance 배치 + 변수 바인딩
          c. 텍스트는 plan.md "핵심 콘텐츠" 컬럼의 실제 값 사용
          d. designNodeId = wireNodeId 로 set (같은 노드가 2단계로 진화)
          e. state entry의 designHash + updatedAt 갱신
       3. designHash 동일: SKIP, "✓ {섹션명} design (cached)" 출력

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
분기 B) createMode == "design":
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   plan.md "## 8. 레이아웃/섹션 구성" 표를 순회 (state가 없을 수 있음):
     for each 섹션 in plan.md:
       1. 섹션 row 직렬화 → designHash 계산
       2. state.sections에서 같은 name 매칭:
          ├─ 매칭 있음 + wireNodeId 존재 → 분기 A의 update 경로 실행 (wireNodeId 재사용)
          ├─ 매칭 있음 + wireNodeId null → ❌ "이 섹션({섹션명})은 이전에 design 모드로 그려졌지만
          │                                   state가 깨졌습니다. --new-state 로 리셋하세요."
          └─ 매칭 없음:
              ⚠ state.sections 가 완전히 비어있음 (첫 실행 또는 hasNewState)이면 허용:
                a. use_figma 호출로 frame 생성 (Auto Layout + 컴포넌트 + 텍스트 한 번에)
                b. wireNodeId = designNodeId = 반환된 frameNodeId
                c. state.sections에 entry append (wireHash/designHash 둘 다 계산)
              ⛔ state.sections 가 일부 비어있지 않으면 reject:
                "이 섹션({섹션명})은 와이어가 없습니다. --create-storyboard 로 먼저 만들거나
                 --create (full)로 호출하세요."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
공통 규칙:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ⛔ 한 번의 use_figma 호출에 모든 섹션을 몰아넣지 말 것.
   ⛔ 분기 A에서 wireNodeId를 삭제하고 새 노드를 만들지 말 것 (state 무효화됨).

   Step E 종료 직전:
     state.planHash = sha256(plan.md 전체)
     state.updatedAt = now
     Write /tmp/{feature}/figma-create-state.json
```

### Step F — 시각 검증 + 최종 사용자 확인

```
1. mcp__plugin_figma_figma__get_screenshot 으로 생성된 프레임 캡처
   - createMode == "storyboard" → wireNodeId들 캡처
   - createMode == "design"     → designNodeId들 캡처
   - createMode == "full"        → designNodeId들 캡처

2. LLM 셀프 체크 (createMode에 따라 항목 narrow):

   createMode == "storyboard" (구조 체크만 — 컬러 판단 불가):
     - 섹션 순서가 plan.md 표와 일치하는가?
     - 핵심 CTA 위치가 plan.md와 일치하는가?
     ⛔ 컬러/분위기 체크 SKIP (와이어는 회색)

   createMode == "design" 또는 "full":
     - 섹션 순서가 plan.md 표와 일치하는가?
     - 분위기/컬러 키워드가 시각적으로 반영됐는가?
     - 핵심 CTA가 Hero에 존재하는가?

3. 사용자에게 다음을 제시:
   - createMode 표시 ("mode: full" / "mode: storyboard only" / "mode: design only")
   - figma URL (fileKey + 첫 nodeId 딥링크)
   - 섹션별 결과 요약:
     · full:       wire 신규 N / 갱신 M / 캐시 K + design 신규 N / 갱신 M / 캐시 K
     · storyboard: wire 신규 N / 갱신 M / 캐시 K
     · design:     design 신규 N / 갱신 M / 캐시 K
   - state 파일 경로
   - (storyboard 모드) "다음 단계: 같은 plan.md로 `--create-design` 또는 `--create` 를 호출하면
     이 와이어 위에 본 디자인이 입혀집니다."

⛔ Step F 완료 전까지 "완료 요약" 출력 금지.
⛔ 코드 파일 생성 절대 금지 (이 Branch는 WRITE-to-Figma 전용).
```

---

## Branch 간 절대 금지 사항

```
❌ Branch 1 도중 figma:figma-use / figma:figma-generate-design 호출 금지 (READ 모드)
❌ Branch 2 도중 design-normalize 호출 금지 (독립 모드)
❌ Branch 3 도중 vibe-figma-extract / vibe-figma-convert / figma-refine.js 호출 금지 (WRITE 모드)
❌ Branch 결정 후 다른 Branch의 Phase로 점프 금지
```
