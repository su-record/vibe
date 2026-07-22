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

> **URL 분류는 자동 처리됩니다** — fileKey가 다른 URL은 스토리보드 vs 디자인으로, ROOT 노드 name의 "MO"/"PC"로 디바이스를 구분합니다. 사용자는 URL 종류를 신경 쓰지 않고 한 번에 던지면 됩니다.

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
2. Execute the bundled implementation below — Phase 0 Setup
   → 스택 감지, 디렉토리, 피처명, component-index.json, project-tokens.json

> Read `references/branch-phases.md` for URL pre-collection rules and the design-context loading algorithm (Phase 0, Branch 1).

     - hasTeach == true → 이때만 Load skill `vibe.design-teach`로 인터랙티브 진입
```

### Phase 1 — Storyboard 분석 (선택)

```
Execute the bundled implementation below — Phase 1 Storyboard
```

> Read `references/branch-phases.md` for the storyboard auto-detect/auto-skip rule and output scope (Branch 1, Phase 1).

### Phase 2 — 재료 확보

```
Execute the bundled implementation below — Phase 2 Extract Mode (코디네이터: MO/PC 병렬 워커)
   → tree.json + bg/ + content/ + sections/ (검증용)
```

> Read `references/branch-phases.md` for the input-selection detail and the Audit gate rule (tree.json `auditSummary`, P1/P2 handling).

### Phase 3 — 데이터 정제

```
Execute the bundled implementation below — Phase 3
   ⛔ figma-refine.js 강제 (자체 정제 스크립트 금지)
   → /tmp/{feature}/{bp}-main/sections.json
```

### Phase 4 — BP별 스태틱 구현 (컨벤션 준수)

```
Execute the bundled implementation below — Phase 4 Convert Mode

⤵ Phase 4 후처리
Load skill `vibe.design-refine` — normalize 모드
   → 매칭 안 된 하드코딩 값 → MASTER.md 토큰으로 정렬
   → 새 토큰 필요 항목은 review 큐에 기록
```

> Read `references/branch-phases.md` for the reuse-matching (BLOCKING) rule and the figma-to-scss/figma-validate gate.

### Phase 5 — 컴파일 게이트

```
Execute the bundled implementation below — Phase 5
   → tsc/build/dev 서버. P1=0까지 루프. Stuck → 사용자 질문.
```

### Phase 6 — 시각 검증 + 품질 점검 (MANDATORY)

```
Execute the bundled implementation below — Phase 6 (시각 검증 루프, P1=0까지)

⤵ Phase 6 후처리
Load skill `vibe.design-review` — audit 모드
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
2. Execute the bundled implementation below — Phase 0 Setup
```

> Read `references/branch-phases.md` for the URL-reuse note and the Phase 0 (Lite) skip list (component-index/project-tokens).

### Phase 1 — Storyboard 분석 (선택)

```
Execute the bundled implementation below — Phase 1
   → Branch 1 Phase 1과 동일 (storyboard URL이 있으면 분석, 없으면 SKIP)
```

### Phase 2 — 재료 확보

```
Execute the bundled implementation below — Phase 2 Extract Mode
   → Branch 1 Phase 2와 동일 (design URL로 추출)

   🚦 Audit gate: Branch 1과 동일하게 `auditSummary.p1 > 0` 이면 Phase 3 진입 금지.
```

### Phase 3 — 데이터 정제

```
Execute the bundled implementation below — Phase 3 (figma-refine.js 강제)
```

### Phase 4 — BP별 스태틱 구현 (Standalone 모드)

```
Execute the bundled implementation below — Phase 4 Convert Mode
```

> Read `references/branch-phases.md` for the Standalone-mode reuse/token rules (Branch 2, Phase 4).

### Phase 5 — 컴파일 게이트

```
Execute the bundled implementation below — Phase 5
```

### Phase 6 — 시각 검증 + a11y (MANDATORY)

```
Execute the bundled implementation below — Phase 6 (시각 검증 루프, P1=0까지)

⤵ Phase 6 후처리
Load skill `vibe.design-review` — audit 모드
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
   - hasTeach == true 인 경우에만 Load skill `vibe.design-teach`로 인터랙티브 보강

3. Load skill `vibe.ui-ux-pro-max`
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

## Bundled implementation


# vibe.figma — Structural Code Generation

## Core Principles

```
The Figma tree is the source of truth for code. Screenshots are for verification only.

✅ Figma Auto Layout → CSS Flexbox 1:1 mechanical mapping
✅ Figma CSS properties → SCSS direct conversion (no guessing)
✅ Claude handles semantic decisions only: tag selection, component splitting, interactions
```

## Immutable Rules

```
1. Do NOT render content as images (frames with TEXT children, INSTANCEs, buttons/prices,
   whole sections). Image rendering only for BG, vector-text GROUPs, verification screenshots.
2. BG must use CSS background-image only. <img> tag is forbidden.
3. No new screenshot calls during Phase 4. Use only Phase 2 materials —
   no matter how complex, implement with HTML+CSS.
```

## Full Flow

```
Input: receive all URLs at once
  Storyboard: figma.com/...?node-id=aaa (if present)
  MO Design:  figma.com/...?node-id=xxx
  PC Design:  figma.com/...?node-id=yyy (if present)

→ Phase 0: Setup
→ Phase 1: Storyboard analysis → functional spec document
→ Phase 2: Gather materials (→ Extract Mode section below)
→ Phase 3: Remapping (MO↔PC matching → remapped.json)
→ Phase 4: Sequential code generation (→ Convert Mode section below)
→ Phase 5: Compile gate
→ Phase 6: Visual verification loop

Working directory: /tmp/{feature}/{mo,pc}-main/{tree.json, bg/, content/, sections/}
  + remapped.json ← sole input for Phase 4
Code output: directly in the project — components/{feature}/, styles/{feature}/
```

---

## Phase 0: Setup

```
1. Stack detection: package.json → react/vue/svelte, next/nuxt, scss/tailwind
2. Feature name: Figma filename → kebab-case
3. Directories: components/{feature}/, public/images/{feature}/, styles/{feature}/
4. Component indexing → component-index.json (≤50 components, props/slots/classes, ≤2 min)
5. Hooks/Types/Constants → context-index.json
6. Design token scan → project-tokens.json (SCSS > CSS Variables > Tailwind > CSS-in-JS)
   (all indexes under /tmp/{feature}/)
```

---

## Phase 1: Storyboard Analysis

```
User input: URLs or PDF/images separated by newlines
URL classification (automatic): different fileKey → storyboard vs design;
  ROOT name contains "MO" → mobile, "PC" → desktop

Storyboard analysis: collect frames at depth=3 → classify by name pattern
  SPEC (functional definition) → CONFIG (resolution) → PAGE (main sections) → SHARED (common)
  PDF/images follow the same structural extraction

❌ No code file creation during Phase 1

Output (text only): section list table · per-section functional definition
  ([Function] + [Interaction] + [State]) · common component list · TS interface draft
```

---

## Phase 2: Gather Materials ← Research (parallel)

**→ Follow the Extract Mode rules below.**
**Coordinator pattern: run MO/PC extraction as parallel workers.**

```
# [FIGMA_SCRIPT] = {{VIBE_PATH}}/hooks/scripts/figma-extract.js

Simultaneous MO/PC extraction — each worker: screenshot → tree → images →
  asset rendering → sections/. Proceed to Phase 3 only after both complete.
Single BP: run sequentially with 1 worker
Multi-frame (same BP, different pages): sequential (500ms interval), partial failure allowed
```

---

## Phase 3: Data Refinement ← Synthesis (independent per BP)

**Split and refine each BP's tree.json by section. MO↔PC matching is NOT done here.**

### BLOCKING Command — Writing custom refine scripts is strictly forbidden

```bash
# MO
node {{VIBE_PATH}}/hooks/scripts/figma-refine.js \
  /tmp/{feature}/mo-main/tree.json \
  --out=/tmp/{feature}/mo-main/sections.json \
  --design-width=720 \
  --bp=mo

# PC
node {{VIBE_PATH}}/hooks/scripts/figma-refine.js \
  /tmp/{feature}/pc-main/tree.json \
  --out=/tmp/{feature}/pc-main/sections.json \
  --design-width=2560 \
  --bp=pc
```

⛔ **Phase 4 is blocked until these commands are executed.**
⛔ **No custom refine scripts, no parsing tree.json directly to produce sections.json.**
✅ Use only figma-refine.js output. If unsatisfactory, modify figma-refine.js.

```
⛔ Refine each BP independently — do NOT mix MO and PC.
⛔ The refined JSON (full recursive subtree per section) is the sole input for Phase 4.
```

### Output

```
/tmp/{feature}/{mo,pc}-main/sections.json    ← per-BP refinement result

sections.json structure:
  {
    meta: { feature, designWidth, bp },
    sections: [{
      name: "Hero", nodeId, type, size, css,
      text, imageRef, fills, layoutSizingH, layoutSizingV,
      children: [ ... ],   // ⛔ full recursive subtree — down to leaf nodes
      images: { bg: "bg/hero-bg.webp", content: ["content/hero-title.webp"] }
    }]
  }
```

### Node Refinement Rules (tree.json → sections.json)

```
1. size-0px nodes, VECTOR decorative lines (w/h ≤ 2px), isMask nodes → remove
2. BG frames → separate from children, move to images.bg
3. Vector-text GROUPs + design text (TEXT with multiple/gradient fills or effects)
   → separate from children, add to images.content
4. Remaining nodes → keep in children (with CSS, recursive)

Multi-frame (same BP, different pages): identify common elements → shared components;
  union of common tokens → shared _tokens.scss
```

---

## Phase 4: Per-BP Static Implementation ← Implement (sequential per BP)

**→ Follow the Convert Mode rules below.**
**⛔ Implement MO fully first → pass verification → then implement PC. No responsive conversion.**
**⛔ CSS values must use Figma original px as-is. vw conversion, clamp, @media are forbidden.**

### BLOCKING Command — SCSS must only use script output

```bash
# Step A: Auto-generate SCSS skeleton (run once per BP)
node {{VIBE_PATH}}/hooks/scripts/figma-to-scss.js \
  /tmp/{feature}/{bp}-main/sections.json \
  --out=/path/to/project/assets/scss/{feature}/

# Step B: Per-section validation (after writing each section's code)
node {{VIBE_PATH}}/hooks/scripts/figma-validate.js \
  /path/to/project/assets/scss/{feature}/ \
  /tmp/{feature}/{bp}-main/sections.json \
  --section={SectionName}
```

⛔ **Writing SCSS directly (or via custom generation scripts) invalidates Phase 4.**
⛔ **Do NOT proceed to the next section without a figma-validate.js PASS.**
⛔ **No CSS values inside scoped style blocks** — only @import/@use of external SCSS files.
✅ Use figma-to-scss.js output as-is. If unsatisfactory, modify figma-to-scss.js.

```
Phase 4A: MO Static Implementation (input: mo-main/sections.json)
  ⛔ No parallelism. Process one section at a time:
    1. Read the target section from sections.json
    2. Write an image vs HTML classification table (BLOCKING — see Convert Mode §C1)
    3. figma-to-scss.js → auto-generate SCSS skeleton (px as-is) — Step A once
    4. Claude: HTML structure + semantic tags + layout + interactions (Vue/React files only)
    5. figma-validate.js — Step B: PASS → next section │ FAIL → fix → re-run
       (repeat until P1=0, no round cap)
  → Phase 5 (MO compile) → Phase 6 (MO visual verification)

Phase 4B: PC Static Implementation (input: pc-main/sections.json)
  Same process as MO → Phase 5 (PC compile) → Phase 6 (PC visual verification)

Phase 4C: Responsive Integration (after both MO+PC pass verification)
  → Separate flow to be established (TODO)

Claude's role (restricted): semantic decisions only (Convert Mode §C3) + image classification
  + executing figma-to-scss.js / figma-validate.js.
  ❌ No modifying SCSS values, no CSS in <style> blocks, no vw/clamp/@media,
     no custom functions/mixins, no custom refine/generate scripts.

SCSS Setup (before the first section):
  index.scss, _tokens.scss, _base.scss
  Token mapping: reference existing tokens from project-tokens.json → create new ones if no match

Component matching (before each section):
  Compare against component-index.json → import if matched, create new if not

Multi-frame:
  Step 1: shared components first → components/shared/
  Step 2: unique sections per frame
```

---

## Phase 5: Compile Gate

```
No round cap. Loop until compile succeeds (or stuck → ask user).

0. Capture baseline (before Phase 4): record existing tsc + build errors → fix NEW errors only
1. TypeScript: vue-tsc/svelte-check/tsc --noEmit
2. Build: npm run build (120s timeout)
3. Dev server: npm run dev → detect port → polling

On error: parse → auto-fix → re-check
Termination:
  ✅ Success: all checks pass → enter Phase 6
  ⚠️ Stuck (same errors as previous round) → ask user: fix instructions │ "proceed"
     (record TODO, go to Phase 6) │ "abort". ultrawork: record TODO + proceed silently.

On completion: preserve dev server PID → used in Phase 6

⛔ After Phase 5 passes (or user proceeds), must enter Phase 6.
   Do NOT output a "completion summary" or declare work complete without Phase 6.
```

---

## Phase 6: Visual Verification Loop ← Verify (parallel) MANDATORY

**⛔ Mandatory — enter automatically upon Phase 5 completion; skipping = task "incomplete".**
**Coordinator pattern: independent per-section verification can run as parallel workers.**

```
No round cap. Loop until P1=0 (or stuck → ask user).
Infrastructure: src/infra/lib/browser/ (Puppeteer + CDP)

1. Capture rendered screenshot → pixelmatch comparison against Figma screenshot
   diffRatio > 0.1 → P1
2. CSS value comparison: computed CSS vs tree.json expected values
   delta > 4px → P1, ≤ 4px → P2
3. Check for missing images and text
4. Fix P1 issues first (refer to tree.json, no guessing) → revalidate compile → reload

Narrowing scope: Round 1 P1+P2+P3 → Round 2 P1+P2 → Round 3+ P1 only (until P1=0)

Termination:
  ✅ Success: P1 = 0 AND no new findings → complete
  ⚠️ Stuck (same findings as previous round) → ask user: direct resolution │ "proceed"
     (record TODO, complete) │ "abort". ultrawork: record TODO + complete silently.

Responsive: after MO verification, change viewport → same loop against PC screenshots
Cleanup: shut down browser + dev server

⛔ "Completion summary" output is only allowed after Phase 6 is complete (or user proceeds).
```

---

## Extract Mode (Phase 2 body) — Acquire Code Generation Data

Uses the Figma REST API (`src/infra/lib/figma/`) to extract **all data needed for structural code generation**. Priority: 1st node tree + CSS (PRIMARY source) → 2nd image assets → 3rd screenshots (Phase 6 validation only, never for generation).

### E1. Node Tree + CSS — Source of Truth

```
Bash:
  node "{{VIBE_PATH}}/hooks/scripts/figma-extract.js" tree {fileKey} {nodeId}

Returns (FigmaNode JSON):
  { nodeId, name, type, size, css: { display, flexDirection, gap, ... },
    text (TEXT only), imageRef, imageScaleMode (FILL/FIT/CROP/TILE),
    layoutSizingH/V (FIXED/HUG/FILL), fills (only when 2+), isMask,
    raw: { itemSpacing, padding*, cornerRadius, strokeWeight, strokeAlign, blendMode,
           opacity, fontSize, lineHeightPx, letterSpacing, fontWeight, leadingTrim,
           textBoxTrim },   ← Figma numbers for Phase 6 raw-vs-computed reconciliation
    warnings: [{ property, value, severity: "P1"|"P2", reason }],  ← translation-loss only
    children: [...] }

Root node also carries:
  auditSummary: { total, p1, p2, items: [{ nodeId, name, property, value, severity, reason }] }

→ Save to /tmp/{feature}/tree.json

Figma property → CSS mapping (what the extractor auto-converts): rubrics/css-mapping.md
```

### E2. Translation-loss Audit (Figma → CSS Incompatibilities)

The extractor flags properties CSS cannot reproduce cleanly (per-node `warnings[]`, rolled up as root `auditSummary`).

**P1 (block Phase 3 until resolved or waived):** `strokeAlign` ≠ `CENTER` (CSS border only renders centered strokes) · `blendMode` ∈ { `LINEAR_BURN`, `LINEAR_DODGE`, `PLUS_DARKER`, `PLUS_LIGHTER` } (no CSS equivalent).

**P2 (record + proceed):** `leadingTrim`/`textBoxTrim` ≠ `NONE` (limited `text-box-trim` support) · `constraints` ∈ { `SCALE`, `CENTER` } (no direct CSS layout mapping) · `individualStrokeWeights` with `strokeAlign` ≠ `CENTER`.

**Gate rule:** if `auditSummary.p1 > 0`, resolve each item (replace layer in Figma, accept approximation with user sign-off, or mark as known deviation) before Phase 3. Log P2 items into feature notes for Phase 6 reviewer attention.

### E3. Image Assets — Node Rendering Based

Full determination rules and real-world failure cases: `rubrics/image-rules.md`.

```
Do NOT download imageRef individually (shared texture fill → multi-MB originals).
All images are rendered as nodes:
  node "{{VIBE_PATH}}/hooks/scripts/figma-extract.js" screenshot {fileKey} {nodeId} --out=...

BG frames → bg/{section}-bg.webp
  Identification: name contains "BG"/"bg", OR same size as parent (±10%) + 3+ child images
Content nodes → content/{name}.webp
  Icons (VECTOR/GROUP ≤ 64px) · item/reward/token/coin thumbnails
  · vector-text GROUPs (3+ VECTORs, each <60px)
  · design text (TEXT with 2+ fills, effects, GRADIENT fill, or non-web-font fontFamily)
    → must be rendered; placed as <img alt="text content">, never CSS text
  · decorative panels (textured backgrounds) → render like BG frames

imageRef download is a fallback only (API failure, DOCUMENT level); >5MB → texture-fill warning.
Screenshots (validation only): full-screenshot.webp + per 1-depth child → sections/{name}.webp
```

### E4. Extraction Completion Validation (Required Before Phase 3)

```
If any item is missing → re-extract (do NOT proceed to Phase 3)

1. tree.json exists + root children > 0 · 2. BG per section exists in bg/
3. Every design-text TEXT node (2+ fills or effects) rendered in content/
4. Every vector-text GROUP (3+ VECTORs) rendered in content/
5. Per-section validation screenshots exist in sections/ · 6. All filenames kebab-case
```

---

## Convert Mode (Phase 4 body) — Tree-Based Structured Code Generation

**Mechanically map sections.json to HTML. Do not guess.**
**Claude handles only semantic decisions (tag selection, component separation, interactions). SCSS comes from figma-to-scss.js (Phase 4 blocking commands).**

### C0. Reuse Check (Before Writing Code)

```
Matching component in component-index.json?
  ✅ Import and customize via props — do not create a new one
  ❌ Never modify an existing component's internals or duplicate a 90%-similar one
```

### C1. Image vs HTML Determination (BLOCKING)

```
⛔ Before writing code: write the determination table first.

YES on any one → HTML:
  Q1. TEXT children? · Q2. repeating INSTANCE? (→ v-for, inner assets only as <img>)
  Q3. interactive? (btn, CTA → <button>) · Q4. dynamic data? (price, quantity, duration)
  All NO → image rendering is acceptable

⛔ Design text (Q1 exception — must be image; D1–D5, same as Extract Mode E3):
  D1. 2+ fills · D2. effects (DROP_SHADOW, stroke) · D3. GRADIENT fill
  D4. parent GROUP/FRAME has 3+ VECTORs · D5. fontFamily not in project web fonts
  → <img src="content/{section}-{name}.webp" alt="text content"> — no CSS text attempt

BG frames: ❌ no <img> tags — parent SCSS background-image only
  .section { background-image: url('bg.webp'); background-size: cover; }
```

### C2. Node → HTML Mapping (Mechanical)

```
FRAME + Auto Layout → <div> + flex (direction/gap/padding directly mapped)
FRAME + no Auto Layout → <div> + position:relative (children absolute)
TEXT → <span> (Claude promotes to h2/p/button)
IMAGE fill (passed determination) → <img>
VECTOR/GROUP ≤64px → icon <img>
INSTANCE repeated 2+ → v-for / .map()
Size 0px, VECTOR ≤2px → skip
```

CSS property mapping reference (grounding for figma-to-scss.js output review, plus legacy vw/responsive rules): `rubrics/css-mapping.md` — Phase 4 forbids hand-writing these values.

### C3. Claude Semantic Decisions (The Only Inference Area)

```
1. Tag promotion: <span> → <h2> (section title) / <p> (description) / <button> (clickable)
2. Component separation: 1st-depth children = sections, INSTANCE repetition = shared
3. Interactions: @click handlers, state variables, conditional rendering
4. Accessibility: decorative → alt="" aria-hidden="true" · content → alt="description"
   · interactive → role, aria-label
5. Semantic HTML: top-level <section>, heading order h1~h6, lists <ul>/<ol>
```

Component skeleton template: `templates/component.md`.

### C4. SCSS File Structure

```
layout/     → position, display, flex, width, height, padding, gap, overflow, z-index
components/ → font, color, border, shadow, opacity, background
_base.scss  → .{feature} { width: 100%; max-width: 720px; margin: 0 auto; overflow-x: hidden; }
_tokens.scss → reference existing tokens (@use); if no mapping, create a new
               feature-scoped token ($feature-color-xxx)
```

### C5. Self-Validation

```
⛔ Any failure → rewrite that section's code (do not proceed to the next section)

1. All template classes defined in SCSS · 2. Image src files actually exist
3. Auto Layout node → flex present in SCSS
4. ⛔ No @function/@mixin defined in SCSS (existing token @use is allowed)
5. ⛔ Every SCSS property grounded in sections.json css object
   (aspect-ratio, container queries, etc. not in the tree → FAIL)
6. ⛔ Image filenames kebab-case (hash filenames like 68ad470b.webp → FAIL)
```

---

## Error Recovery

| Failure | Recovery |
|---------|----------|
| figma-extract.js script error | Node.js >=18? API token in config? Retry once. |
| Figma API 401 | Prompt user to set FIGMA_ACCESS_TOKEN in env or ~/.vibe/config.json |
| Figma API 404 | Verify fileKey from URL; check file is shared/accessible |
| Figma API 429 (rate limit) | Wait 60s, retry with reduced node scope (single page) |
| API timeout on large file | Split request by page via nodeId parameter |
| Screenshot download failure | Proceed with tree.json only (visual verification → manual) |
| tree.json missing in Phase 4 | Run Extract Mode (Phase 2) first |
| component-index.json missing | Generate minimal index from tree.json section names |
| sections.json malformed | Regenerate from tree.json via figma-refine.js |
| SCSS output empty | Check sections.json for valid style nodes; else default reset styles |
| figma-to-scss.js parse failure | Validate tree.json structure; if malformed, re-run Extract Mode |
| figma-validate.js comparison failure | Skip automated validation; screenshot side-by-side manual review |
| Puppeteer/CDP not available | Skip visual verification; manual browser check |
