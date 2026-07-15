---
name: vibe.figma
description: Figma ↔ Code 양방향 라우터 — READ(Figma→Code) / WRITE(plan→Figma)
argument-hint: "[<figma-url>... | <plan.md>] [--new] [--create | --create-storyboard | --create-design] [--teach]"
user-invocable: true
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

> **URL 분류는 `figma` 스킬이 자동 처리합니다** — fileKey가 다른 URL은 스토리보드 vs 디자인으로, ROOT 노드 name의 "MO"/"PC"로 디바이스를 구분합니다. 사용자는 URL 종류를 신경 쓰지 않고 한 번에 던지면 됩니다.

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
  hasEmitDesignMd     = args에 "--emit-design-md" 포함 (Branch 1/2 전용: READ 완료 후 DESIGN.md 출력)
  hasReadDesignMd     = 프로젝트 루트에 DESIGN.md 존재 (Branch 3 전용: WRITE 시 톤·팔레트 우선 입력)

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
                                              예: /vibe.figma .vibe/plans/foo.md --create"
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
2. Load skill `figma` — Phase 0 Setup
   → 스택 감지, 디렉토리, 피처명, component-index.json, project-tokens.json

> Read `references/branch-phases.md` for URL pre-collection rules and the design-context loading algorithm (Phase 0, Branch 1).

     - hasTeach == true → 이때만 Load skill `design-teach`로 인터랙티브 진입
```

### Phase 1 — Storyboard 분석 (선택)

```
Load skill `figma` — Phase 1 Storyboard
```

> Read `references/branch-phases.md` for the storyboard auto-detect/auto-skip rule and output scope (Branch 1, Phase 1).

### Phase 2 — 재료 확보

```
Load skill `figma` — Phase 2 Extract Mode (코디네이터: MO/PC 병렬 워커)
   → tree.json + bg/ + content/ + sections/ (검증용)
```

> Read `references/branch-phases.md` for the input-selection detail and the Audit gate rule (tree.json `auditSummary`, P1/P2 handling).

### Phase 3 — 데이터 정제

```
Load skill `figma` — Phase 3
   ⛔ figma-refine.js 강제 (자체 정제 스크립트 금지)
   → /tmp/{feature}/{bp}-main/sections.json
```

### Phase 4 — BP별 스태틱 구현 (컨벤션 준수)

```
Load skill `figma` — Phase 4 Convert Mode

⤵ Phase 4 후처리
Load skill `design-refine` — normalize 모드
   → 매칭 안 된 하드코딩 값 → MASTER.md 토큰으로 정렬
   → 새 토큰 필요 항목은 review 큐에 기록
```

> Read `references/branch-phases.md` for the reuse-matching (BLOCKING) rule and the figma-to-scss/figma-validate gate.

### Phase 5 — 컴파일 게이트

```
Load skill `figma` — Phase 5
   → tsc/build/dev 서버. P1=0까지 루프. Stuck → 사용자 질문.
```

### Phase 6 — 시각 검증 + 품질 점검 (MANDATORY)

```
Load skill `figma` — Phase 6 (시각 검증 루프, P1=0까지)

⤵ Phase 6 후처리
Load skill `design-review` — audit 모드
   → 5-dimension 점검 (a11y, performance, responsive, theming, AI slop)
   → P1 finding은 review 큐에 기록 (read-only)

⛔ Phase 6 + design-review(audit) 완료 전까지 "완료 요약" 출력 금지.
```

> Read `references/branch-phases.md` for the raw-vs-computed reconciliation detail and Phase 6.5 DESIGN.md emission steps.

---

## Branch 2: `/vibe.figma --new` — READ + 독립 규격

**시나리오**: 신규 독립 페이지 (랜딩, 프로토타입). 기존 컨벤션 무시, **Figma 원본 충실도 우선**.

**입력**: Figma URL 여러 개 (Branch 1과 동일 — 스토리보드 + MO/PC 자동 분류)
**출력**: `components/{feature}/` (독립 토큰, 새 컴포넌트 자유 생성)

### Phase 0 — Setup (Lite) + URL 수집

```
2. Load skill `figma` — Phase 0 Setup
```

> Read `references/branch-phases.md` for the URL-reuse note and the Phase 0 (Lite) skip list (component-index/project-tokens).

### Phase 1 — Storyboard 분석 (선택)

```
Load skill `figma` — Phase 1
   → Branch 1 Phase 1과 동일 (storyboard URL이 있으면 분석, 없으면 SKIP)
```

### Phase 2 — 재료 확보

```
Load skill `figma` — Phase 2 Extract Mode
   → Branch 1 Phase 2와 동일 (design URL로 추출)

   🚦 Audit gate: Branch 1과 동일하게 `auditSummary.p1 > 0` 이면 Phase 3 진입 금지.
```

### Phase 3 — 데이터 정제

```
Load skill `figma` — Phase 3 (figma-refine.js 강제)
```

### Phase 4 — BP별 스태틱 구현 (Standalone 모드)

```
Load skill `figma` — Phase 4 Convert Mode
```

> Read `references/branch-phases.md` for the Standalone-mode reuse/token rules (Branch 2, Phase 4).

### Phase 5 — 컴파일 게이트

```
Load skill `figma` — Phase 5
```

### Phase 6 — 시각 검증 + a11y (MANDATORY)

```
Load skill `figma` — Phase 6 (시각 검증 루프, P1=0까지)

⤵ Phase 6 후처리
Load skill `design-review` — audit 모드
   → a11y는 항상 검증. 컨벤션 무시 모드여도 접근성은 양보 불가.

⛔ Phase 6 + design-review(audit) 완료 전까지 "완료 요약" 출력 금지.
```

> Read `references/branch-phases.md` for the raw-vs-computed note and Phase 6.5 DESIGN.md emission steps (Branch 2).

---

## Branch 3: `/vibe.figma <plan.md> --create*` — WRITE (plan.md → Figma)

**시나리오**: plan.md의 UI 서술(Look & Feel, 레이아웃, 반응형)을 Figma 파일에 디자인으로 생성.

**입력**:
- 라우팅에서 받은 `mdArg` (필수, .md 경로)
- 라우팅에서 받은 `createMode` ∈ {full, storyboard, design}
- target Figma file URL/key (Step B에서 질문)

**출력**: 지정된 Figma 파일 내 새 페이지/프레임/섹션

> **Phase 명명 주의**: Branch 3은 `figma` 스킬의 Phase 0~6과 충돌을 피하기 위해 **Step A~F**로 표기한다.
> **2단계 생성 원칙**: `createMode == full`이면 본 디자인 직진 금지. 반드시 **와이어프레임(Step D) → 사용자 검토 → 본 디자인(Step E)** 순서.

### createMode별 실행 매트릭스

> Read `references/step-algorithms.md` for the full per-Step createMode matrix (A–F × full/storyboard/design) and the `design` mode Step E branching summary.

### Step A — plan.md 파싱 + 디자인 컨텍스트

> Read `references/step-algorithms.md` for the full plan.md required-section extraction list, missing-section rejection message, feature-name rule, and design-context priority resolution.

```
   - hasTeach == true 인 경우에만 Load skill `design-teach`로 인터랙티브 보강

3. Load skill `ui-ux-pro-max`
   → plan.md의 분위기/타이포/컬러 키워드로 가이드 매칭
   → 컬러 팔레트, 폰트 페어링, UX 가이드 후보 생성
```

### Step B — Figma 타겟 파일 + State 로드 + Plugin 규칙

> Read `references/step-algorithms.md` for the AskUserQuestion prompt, fileKey extraction, and state-file path detail.

```
4. Load skill `figma:figma-use` (MANDATORY prerequisite)
   → use_figma 호출 규칙 (color 0-1, 폰트 로드, layoutSizing 순서 등)

5. Load skill `figma:figma-generate-design`
   → 디자인 시스템 컴포넌트 발견 + 섹션별 조립 워크플로
```

> Read `references/state-schema.md` for the full state JSON schema, wireHash/designHash rationale, and reuse/reject algorithm.

### Step C — 디자인 시스템 발견

```
⛔ createMode == "storyboard" 인 경우 이 Step 전체 SKIP
   (와이어는 컴포넌트/변수 정보가 필요 없음)

Load skill `figma:figma-generate-design` — Step 2: Discover Design System
```

> Read `references/step-algorithms.md` for the full 2a/2b/2c discovery sub-steps and unmatched-token prompt.

### Step D — 와이어프레임 생성 (incremental + idempotent)

**목적**: plan.md 8번(레이아웃)만으로 회색 박스 + 텍스트 placeholder의 골격을 그린다. 컬러/타이포/컴포넌트 인스턴스는 **금지**.

```
⛔ createMode == "design" 인 경우 이 Step 전체 SKIP
   (디자인만 모드는 Step E로 직진 — 와이어 단계 통째로 생략)

Load skill `figma:figma-generate-design` — Step 3 패턴 재사용 (와이어 모드)

   Step D 종료 직전:
     state.updatedAt = now
     Write /tmp/{feature}/figma-create-state.json
```

> Read `references/step-algorithms.md` for the full per-section wire generation algorithm (신규/캐시/구조변경 케이스), incremental-call rule, and responsive handling.

#### 🚪 사용자 검토 게이트 (Step D ↔ Step E 사이)

```
⛔ createMode != "full" 인 경우 이 게이트 SKIP
   - storyboard 모드: Step E가 없어서 게이트 의미 없음 → 곧바로 Step F로
   - design 모드: Step D가 없어서 게이트 의미 없음 → Step E 먼저 실행

1. mcp__plugin_figma_figma__get_screenshot 으로 와이어 프레임들 캡처
```

> Read `references/step-algorithms.md` for the full user review-gate message template and ralph/ultrawork auto-continue behavior.

### Step E — 본 디자인 적용 (incremental + idempotent)

**목적**: plan.md 7번+8번+9번 기반으로 컴포넌트 인스턴스/색/타이포/실제 텍스트를 그린다. 모드에 따라 wireNodeId 재사용 여부가 달라진다.

```
⛔ createMode == "storyboard" 인 경우 이 Step 전체 SKIP
   (와이어만 모드는 Step E 없이 Step F로)

Load skill `figma:figma-generate-design` — Step 3+: Assemble Sections (디자인 모드)

   Step E 종료 직전:
     state.planHash = sha256(plan.md 전체)
     state.updatedAt = now
     Write /tmp/{feature}/figma-create-state.json
```

> Read `references/step-algorithms.md` for the full 분기 A (full 모드) / 분기 B (design 모드) pseudocode and common rules (incremental use_figma calls, wireNodeId preservation).

### Step F — 시각 검증 + 최종 사용자 확인

```
1. mcp__plugin_figma_figma__get_screenshot 으로 생성된 프레임 캡처
   - createMode == "storyboard" → wireNodeId들 캡처
   - createMode == "design"     → designNodeId들 캡처
   - createMode == "full"        → designNodeId들 캡처
```

> Read `references/step-algorithms.md` for the full per-mode LLM self-check list and final user-facing summary template.

```
⛔ Step F 완료 전까지 "완료 요약" 출력 금지.
⛔ 코드 파일 생성 절대 금지 (이 Branch는 WRITE-to-Figma 전용).
```

---

## Branch 간 절대 금지 사항

```
❌ Branch 1 도중 figma:figma-use / figma:figma-generate-design 호출 금지 (READ 모드)
❌ Branch 2 도중 design-refine(normalize) 호출 금지 (독립 모드)
❌ Branch 3 도중 figma 스킬의 Extract/Convert Mode · figma-refine.js 호출 금지 (WRITE 모드)
❌ Branch 결정 후 다른 Branch의 Phase로 점프 금지
```
