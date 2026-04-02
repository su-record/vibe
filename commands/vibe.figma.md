---
description: Figma design to code — extract + generate in one step
argument-hint: ""
---

# /vibe.figma

Figma 디자인 + 스토리보드 → 프로덕션 코드. **뷰포트별 점진적 빌드** 방식.

## Usage

```
/vibe.figma                  # 인터랙티브 모드 (단계별 URL 입력)
/vibe.figma --new            # 새 피처 모드 (기존 디자인 시스템 무시)
/vibe.figma --refine         # 보완 모드 (기존 코드 + Figma 재비교 → 수정)
```

## Incremental Build Flow (핵심 플로우)

한번에 전체를 만들지 않고, **뷰포트별로 점진적으로 쌓아가는 방식**:

```
Step A: 스토리보드 URL 입력
  → 브레이크포인트, 인터랙션, 스펙 추출
  → base 레이아웃 & 컴포넌트 구조 설계 + 파일 생성
        ↓
Step B: 모바일 디자인 URL 입력
  → 모바일 스타일 반영, 이미지 추출
  → 컴포넌트 리팩토링 (모바일 기준)
  → 🔄 검증 루프 (Figma vs 코드 비교, P1=0까지)
        ↓
Step C: PC 디자인 URL 입력
  → PC 스타일 반영 (반응형 clamp/breakpoint 추가)
  → 이미지 추출 (PC용 에셋)
  → 컴포넌트 리팩토링 (PC 대응)
  → 🔄 검증 루프 (Figma vs 코드 비교, P1=0까지)
        ↓
Step D: 최종 공통화 리팩토링
  → 모바일/PC 스타일 공통 토큰 추출
  → 중복 코드 통합
  → 유사 컴포넌트 variant 통합 (80% rule)
  → 🔄 최종 검증 루프 (양쪽 뷰포트 동시 검증)
```

### 단계별 URL 입력 (AskUserQuestion — options 사용 금지, 자유 텍스트만)

```
각 Step에서 AskUserQuestion으로 하나씩 입력:
  ⚠️ 절대 선택지(options)를 제공하지 않는다. 순수 텍스트 입력만.
  ⚠️ 각 질문의 응답을 받은 후에만 다음으로 진행.

Step A: "📋 스토리보드 Figma URL을 입력해주세요. (없으면 '없음')"
  → ⏸️ 응답 대기
  → URL 또는 "없음"

Step B: "📱 모바일 디자인 Figma URL을 입력해주세요."
  → ⏸️ 응답 대기
  → URL 저장 + 추출 + 스타일 반영 + 검증

Step C: "🖥️ PC 디자인 Figma URL을 입력해주세요. (없으면 '없음')"
  → ⏸️ 응답 대기
  → URL 또는 "없음" (없으면 single viewport mode)

디자인 URL이 1개만이면: 단일 뷰포트 (Step B만 실행, Step C 스킵)
디자인 URL이 2개이면: 반응형 (Step B + C + D)
```

### Mode

| Mode | 조건 | 동작 |
|------|------|------|
| **Project integration** | 기본값 | 기존 디자인 시스템/토큰 활용, 프로젝트 컨벤션 준수 |
| **--new** | 플래그 지정 시 | 자체 완결 토큰 + 컴포넌트, 기존 디자인 시스템 무관 |
| **--refine** | 플래그 지정 시 | 기존 코드를 Figma 재비교 → 부족한 부분만 수정 |

### 스토리보드에서 추출하는 정보

| 항목 | 활용 |
|------|------|
| 브레이크포인트 / 해상도 가이드 | base 레이아웃 설계 |
| 인터랙션 스펙 (호버, 클릭, 스크롤) | 이벤트 핸들러 + CSS states |
| 애니메이션 스펙 (타이밍, 이징) | transition/animation |
| 상태별 UI (로딩, 에러, 성공) | 조건부 렌더링 |
| 반응형 동작 설명 | responsive 코드 |
| 컬러/타이포 가이드 | 토큰 생성 |

## Context Reset

**이 커맨드 실행 시 이전 대화 무시.**
- Figma 데이터 + 프로젝트 스택 기반으로 판단
- 스토리보드 스펙이 디자인과 충돌 시 → 스토리보드 우선

---

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## Model Routing

| Step | Claude | GPT (Codex) | 이유 |
|------|--------|-------------|------|
| Step A (스토리보드 + 구조) | **Haiku → Sonnet** | — | MCP 추출 → 구조 설계 |
| Step B (모바일 추출) | **Haiku** | — | MCP + 이미지 다운로드 |
| Step B (모바일 코드 생성) | **Sonnet** | **gpt-5.3-codex-spark** (병렬) | 섹션별 컴포넌트 생성 |
| Step B (모바일 검증) | **Sonnet** | — | 이미지 비교 + auto-fix |
| Step C (PC 추출) | **Haiku** | — | MCP + 이미지 다운로드 |
| Step C (PC 반응형 반영) | **Sonnet** | — | 기존 코드에 반응형 레이어 추가 |
| Step C (PC 검증) | **Sonnet** | — | 양쪽 뷰포트 비교 |
| Step D (공통화) | **Sonnet** | — | 리팩토링 + 최종 검증 |
| Post (코드 리뷰) | — | **gpt-5.3-codex** | 전체 코드 품질 검증 |

### GPT 모델 선택 기준

| 모델 | config key | 용도 |
|------|-----------|------|
| `gpt-5.4` | `models.gpt` | 아키텍처 판단, 복잡한 추론 |
| `gpt-5.3-codex` | `models.gptCodex` | 코드 리뷰, 분석 (정확도 우선) |
| `gpt-5.3-codex-spark` | `models.gptCodexSpark` | 코드 생성 (속도 우선) |

`~/.vibe/config.json`의 `models` 에서 오버라이드 가능.

### Codex 병렬 활용 (codex-plugin-cc 설치 시)

```
Phase 6 — 컴포넌트 생성:
  섹션 3개 이상 → /codex:rescue --background (gpt-5.3-codex-spark)
  각 섹션 컴포넌트를 Codex에 병렬 위임, Claude는 루트 페이지 + 토큰 담당

Post — 코드 리뷰:
  /codex:review (gpt-5.3-codex)
  생성된 코드의 design fidelity + 코드 품질 크로스 검증

Codex 미설치 시 자동 스킵 — Claude만으로 순차 생성.
```

## Step A: 스토리보드 + Base 구조

### A-1. 스토리보드 URL 입력

AskUserQuestion (options 사용 금지, 자유 텍스트만):
```
question: "📋 스토리보드 Figma URL을 입력해주세요. (없으면 '없음')"
→ ⏸️ 응답 대기 (응답 받기 전 다음 진행 금지)
→ figma.com URL → storyboardUrl 저장
→ "없음" → storyboardUrl = null
```

### A-2. 스토리보드 추출 (storyboardUrl이 있을 때)

```
URL에서 fileKey, nodeId 추출:
  https://www.figma.com/design/:fileKey/:fileName?node-id=:nodeId
  → nodeId: 하이픈을 콜론으로 ("1-109" → "1:109")

1. get_metadata(fileKey, nodeId) → 전체 프레임 목록
2. 관련 섹션별 get_design_context:
   - "해상도 대응" / "Media Query" → 브레이크포인트
   - "인터랙션" / "Interaction" → 호버/클릭/스크롤 스펙
   - "애니메이션" / "Animation" / "Motion" → 트랜지션 스펙
   - "상태" / "State" → 로딩/에러/성공 UI
   - "컬러" / "Color" / "타이포" / "Typography" → 디자인 가이드
```

### A-3. 프로젝트 스택 감지 + Base 구조 설계

```
1. 프로젝트 스택 감지 (Phase 3 참조)
2. 디자인 시스템 감지 (--new 미지정 시)
3. 브레이크포인트 로드 (Phase 3-3 참조, 스토리보드 우선)
4. 피처명 결정 (Figma 파일명에서 추출)
5. 파일 구조 생성:
   - 루트 페이지 파일 (빈 shell)
   - 컴포넌트 디렉토리 (빈 폴더)
   - 토큰 파일 (스토리보드 기반 초기값)
```

---

## Step B: 모바일 디자인 반영

### B-1. 모바일 디자인 URL 입력

AskUserQuestion (options 사용 금지):
```
question: "📱 모바일 디자인 Figma URL을 입력해주세요."
→ ⏸️ 응답 대기
→ URL 저장: mobileUrl
```

### B-2. 모바일 디자인 추출 (MCP)

```
1. get_design_context(fileKey, nodeId) → 코드 + 스크린샷 + 에셋 URL
→ 스크린샷으로 전체 디자인 분석 (레이아웃, 타이포, 색상, 컴포넌트 구조)
```

### B-3. 이미지 에셋 다운로드 (BLOCKING)

> **⛔ 이미지 다운로드 완료 전 코드 생성 진행 금지.**

```
1. get_design_context 응답에서 모든 이미지 URL 추출
   (패턴: https://www.figma.com/api/mcp/asset/...)
2. WebFetch로 각 URL 다운로드
3. 프로젝트 에셋 디렉토리에 저장 (Nuxt: static/images/{feature}/)
4. 파일명: 레이어 이름 기반 kebab-case
5. URL→로컬경로 매핑 테이블 생성
6. SVG: 작은 아이콘 → 인라인, 큰 SVG → 파일
```

### B-4. 모바일 코드 생성

```
1. 모바일 기준으로 컴포넌트 코드 생성 (Phase 4~6 적용)
2. 이미지 에셋은 매핑 테이블의 로컬 경로 사용
3. 스토리보드 스펙 반영 (인터랙션, 애니메이션)
4. 모바일 전용 스타일 작성 (desktop 미고려)
```

### B-5. 모바일 검증 루프

```
🔄 Phase 9 검증 루프 실행:
  - Figma 모바일 스크린샷 vs 생성된 코드 비교
  - P1=0 될 때까지 수정 반복
  - 이미지 에셋 전부 표시되는지 확인
```

---

## Step C: PC 디자인 반영 (반응형)

### C-1. PC 디자인 URL 입력

AskUserQuestion (options 사용 금지):
```
question: "🖥️ PC 디자인 Figma URL을 입력해주세요. (없으면 '없음')"
→ ⏸️ 응답 대기
→ URL → pcUrl 저장 (responsive mode)
→ "없음" → single viewport mode (Step D로 직행)
```

### C-2. PC 디자인 추출 (MCP)

```
1. get_design_context(fileKey, nodeId) → 코드 + 스크린샷 + 에셋 URL
→ 모바일 스크린샷과 side-by-side 비교 → viewport diff table 생성
```

### C-3. PC 이미지 에셋 다운로드 (BLOCKING)

```
모바일과 동일 프로세스.
PC 전용 이미지가 있으면 추가 다운로드.
동일 이미지는 스킵 (중복 방지).
```

### C-4. PC 스타일 반영 + 반응형 리팩토링

```
기존 모바일 코드에 PC 대응 추가:
1. 공통 값 → clamp() fluid 토큰으로 변환
2. 레이아웃 구조 변경 → @media (min-width: {breakpoint}px) 추가
3. PC 전용 요소 → display toggle (.desktopOnly)
4. 모바일 전용 요소 → display toggle (.mobileOnly)
5. PC 전용 배경 이미지 → @media 분기
6. 기존 모바일 코드는 가능한 보존하고 반응형 레이어만 추가
```

### C-5. PC 검증 루프

```
🔄 Phase 9 검증 루프 실행:
  - Figma PC 스크린샷 vs 생성된 코드 (PC viewport) 비교
  - P1=0 될 때까지 수정 반복
  - 모바일 검증도 재확인 (PC 수정으로 모바일이 깨지지 않았는지)
```

---

## Step D: 최종 공통화 리팩토링

### D-1. 스타일 공통화

```
1. 모바일/PC에서 동일한 값 → 공통 토큰으로 추출
2. 중복 CSS/SCSS 규칙 통합
3. 컴포넌트 내 중복 로직 제거
```

### D-2. 컴포넌트 통합

```
1. 유사 컴포넌트 (80% rule) → variant prop으로 통합
2. 중복 sub-component → 공유 컴포넌트로 추출
3. Fragment/template 활용하여 불필요한 래퍼 제거
```

### D-3. 최종 검증 루프

```
🔄 양쪽 뷰포트 동시 검증:
  - 모바일 Figma vs 코드 (mobile viewport)
  - PC Figma vs 코드 (desktop viewport)
  - 양쪽 모두 P1=0, Match Score 95%+
  - 이미지 에셋 전부 정상 표시
```

---

## Phase 1: Design Analysis (Image-First)

### Single mode

Read `figma-output/frame.png` and analyze:

| Aspect | What to Extract |
|--------|-----------------|
| Layout | Flex/Grid direction, alignment, wrapping |
| Components | Visual boundaries (cards, buttons, inputs, modals) |
| Spacing | Padding, margins, gaps between elements |
| Typography | Font sizes, weights, line heights, hierarchy |
| Colors | Background, text, border, accent colors |
| States | Hover/active/disabled indicators if visible |
| Responsive hints | Breakpoint indicators, fluid vs fixed widths |

### Responsive mode

Read **ALL** frame images and analyze **side-by-side**:

| Aspect | What to Compare |
|--------|-----------------|
| Layout shift | Which elements reflow? (e.g., horizontal → vertical stack) |
| Visibility | Which elements hide/show per viewport? |
| Typography scale | Font size ratio between viewports |
| Spacing scale | Padding/gap ratio between viewports |
| Component shape | Does the component change form? (e.g., drawer → sidebar) |
| Navigation | Does nav change? (e.g., hamburger ↔ full nav bar) |

Build a **viewport diff table**:

```
| Element        | Mobile (375px)         | Desktop (1440px)       | Strategy          |
|---------------|------------------------|------------------------|-------------------|
| Nav           | hamburger + drawer     | horizontal bar         | component swap    |
| Hero title    | 24px                   | 48px                   | fluid: clamp()    |
| Card grid     | 1 column               | 3 columns              | grid auto-fit     |
| Sidebar       | hidden                 | visible                | display toggle    |
| Body text     | 14px                   | 16px                   | fluid: clamp()    |
| Padding       | 16px                   | 48px                   | fluid: clamp()    |
```

## Phase 2: Layer Data Extraction

### Single mode

Read `figma-output/layers.json` and extract:

1. **Component hierarchy** — Map nested layers to component tree
2. **Design tokens** — Colors (fill, stroke), font properties, spacing values, border radius, shadows
3. **Auto-layout** — Direction, gap, padding (maps directly to flex/grid)
4. **Constraints** — Fixed vs fluid sizing
5. **Component instances** — Identify reusable patterns
6. **Image fills** — Identify layers with `type: "IMAGE"` fills (see Phase 2-A)

### Responsive mode

Read **ALL** `layers.{N}.json` files and extract **per-viewport**:

1. **Per-viewport tokens** — Record exact values for each viewport:
   ```
   { "mobile": { "h1": 24, "body": 14, "padding": 16 },
     "desktop": { "h1": 48, "body": 16, "padding": 48 } }
   ```
2. **Layout differences** — Auto-layout direction changes (e.g., HORIZONTAL → VERTICAL)
3. **Visibility map** — Which layers exist in one viewport but not the other
4. **Shared tokens** — Values identical across all viewports (colors, border-radius, shadows are usually shared)

### Phase 2-A: Image Fill Classification

Figma에서 이미지는 레이어의 `fills` 배열에 `type: "IMAGE"`로 들어옴. 이를 **용도별로 분류**해야 코드에서 올바른 패턴을 생성할 수 있음.

#### 감지 방법

`layers.json`에서 아래 패턴을 탐색:

```
fills: [{ type: "IMAGE", scaleMode: "FILL" | "FIT" | "CROP" | "TILE", imageRef: "..." }]
```

#### 분류 기준

| 판별 조건 | 분류 | 코드 패턴 |
|----------|------|----------|
| 레이어가 프레임/섹션의 **직계 배경**이고, 위에 텍스트/UI 요소가 겹침 | **Background Image** | `background-image` + `background-size` |
| 레이어가 독립적이고, 위에 겹치는 요소 없음 | **Content Image** | `<img>` 또는 `<picture>` |
| 레이어 이름에 `icon`, `logo`, `avatar` 포함 | **Inline Asset** | `<img>` (작은 크기) |
| 레이어가 반복 패턴(`scaleMode: "TILE"`) | **Pattern/Texture** | `background-image` + `background-repeat` |
| 레이어가 전체 프레임을 덮고 opacity < 1 또는 blendMode 적용 | **Overlay Image** | `background-image` + overlay `::before`/`::after` |

#### 이미지-텍스트 겹침 판별 (Background vs Content)

```
frame의 fills에 IMAGE가 있고, children에 TEXT 레이어가 있으면:
  → Background Image (텍스트 아래 깔리는 배경)

독립 레이어의 fills에 IMAGE가 있고, 형제 레이어와 겹치지 않으면:
  → Content Image
```

#### 이미지 소스 추출

- `imageRef` 값으로 Figma API의 이미지 렌더링 사용 (`/images/{fileKey}`)
- 추출된 이미지는 `figma-output/assets/` 디렉토리에 저장
- 파일명은 레이어 이름 기반: `hero-bg.png`, `product-photo.jpg`

### Responsive Scaling Calculation

Per-viewport 토큰 쌍에서 clamp() 값을 계산. 공식은 **Phase 4-3** 참조.

핵심: Figma 디자인이 2x 스케일(2560px/720px)이므로, 반드시 타겟 해상도(1920px/480px)로 환산 후 clamp를 계산해야 함.

**Correction rule**: When image and JSON disagree, **image wins**. The image shows designer intent; JSON may have structural artifacts.

## Phase 3: Project Stack Detection + Mode Resolution

### 3-1. Detect Stack

1. Read `.claude/vibe/config.json` → check `stacks` field
2. If no config, detect from project files:
   - `package.json` → React, Vue, Svelte, Angular, etc.
   - `tailwind.config.*` → Tailwind CSS
   - `next.config.*` → Next.js
   - `nuxt.config.*` → Nuxt
   - `*.module.css` → CSS Modules pattern
   - `*.scss` / `sass` in deps → SCSS
   - `styled-components` / `@emotion` in deps → CSS-in-JS

### 3-2. Load Design Context (Design Skill Integration)

Read these files **in order** — later sources override earlier ones:

1. **`.claude/vibe/design-context.json`** — brand personality, aesthetic direction, constraints
   - `aesthetic.style` → guides visual weight (minimal vs bold)
   - `aesthetic.colorMood` → warm/cool/vibrant tone for token selection
   - `brand.personality` → preserve brand-expressive elements
   - `constraints.accessibility` → AA or AAA level (affects contrast, focus, ARIA depth)
   - `constraints.devices` → responsive breakpoints priority
2. **`.claude/vibe/design-system/{project}/MASTER.md`** — authoritative token definitions
   - If MASTER.md exists: **map Figma tokens to MASTER.md tokens first**, only create new tokens for values with no match
   - If no MASTER.md: generate `figma-tokens.css` as standalone token source

**Decision rule**: When Figma token ≈ existing MASTER.md token (within 10% color distance or ±2px spacing), **use the existing token** — do not duplicate.

### 3-3. Load Breakpoints

Breakpoints are loaded from multiple sources in priority order:

#### Source Priority

| Priority | Source | How |
|----------|--------|-----|
| 1 | **Storyboard** | Phase 0-1에서 추출한 `storyboardSpec.breakpoints` |
| 2 | **`~/.vibe/config.json`** | `figma.breakpoints` — user-customized via `vibe figma breakpoints --set` |
| 3 | **Project CSS/Tailwind** | Grep `tailwind.config.*` → `theme.screens`, or `@media.*min-width` patterns in codebase |
| 4 | **Defaults** | Built-in values (breakpoint: 1024px, etc.) |

#### Default Breakpoints (built-in)

Based on game industry responsive storyboard standards:

```
breakpoint:     1024px    ← PC↔Mobile boundary (@media min-width)
pcTarget:       1920px    ← PC main target resolution
mobilePortrait:  480px    ← Mobile portrait max width
mobileMinimum:   360px    ← Mobile minimum supported width
designPc:       2560px    ← Figma PC artboard width (design is 2x scale)
designMobile:    720px    ← Figma Mobile artboard width (design is 2x scale)
```

#### How to use in code generation

```
@media breakpoint:
  - Single breakpoint model: @media (min-width: {breakpoint}px)
  - Mobile-first: styles below breakpoint = mobile, above = PC

clamp() range:
  - minVw = mobileMinimum (360px) — smallest supported viewport
  - maxVw = pcTarget (1920px) — largest target viewport
  - Values scale linearly between these bounds

Design scale factor:
  - PC design at {designPc}px targets {pcTarget}px → scale = pcTarget/designPc
  - Mobile design at {designMobile}px targets {mobilePortrait}px → scale = mobilePortrait/designMobile
  - Apply scale to convert Figma pixel values to target pixel values
```

#### User customization

Users can override any value via CLI:

```bash
vibe figma breakpoints                          # Show current values
vibe figma breakpoints --set breakpoint=768     # Change PC↔Mobile boundary
vibe figma breakpoints --set mobileMinimum=320  # Change mobile minimum
```

Stored in `~/.vibe/config.json` → `figma.breakpoints`. Partial overrides merge with defaults.

### 3-4. Resolve Generation Mode

**Both modes use the project's existing directory structure.** Never create `figma-output/generated/`.

```
if --new flag:
  → detect project's page/component/style directories (same as default)
  → generate self-contained token file (no MASTER.md dependency)
  → components are self-contained (own tokens, no external design system imports)
  → placed in project's standard directories with feature-named subfolder

default (no flag):
  → scan existing component directories, theme files, token definitions
  → map output to project's conventions (file location, naming, imports)
  → add only NEW tokens that don't exist yet
```

---

## Phase 4: Style Architecture

### 4-1. Global Styles File

**Token resolution priority** (default mode):

1. **MASTER.md tokens** — if `.claude/vibe/design-system/{project}/MASTER.md` exists, map Figma values to these tokens
2. **design-context.json tokens** — if `detectedStack.fonts`, `aesthetic.colorMood` exist, align with these
3. **New figma-tokens** — only for values that have no existing match

**--new mode**: Generate self-contained token file (no MASTER.md dependency), in project's standard directories.

#### Output Structure (both modes — project structure 준수)

프로젝트의 기존 디렉토리 구조를 감지하여 올바른 위치에 파일 생성.

**Step 1: 디렉토리 감지**

```
페이지 디렉토리:
  Next.js → pages/ or app/
  Nuxt    → pages/
  React   → src/pages/ or src/views/
  Vue     → src/views/

컴포넌트 디렉토리:
  Next.js → components/ or src/components/
  Nuxt    → components/
  React   → src/components/
  Vue     → src/components/

스타일 디렉토리:
  SCSS    → assets/scss/ or src/scss/ or src/styles/
  CSS     → src/styles/ or styles/
  Tailwind → tailwind.config.* (extend)
```

**Step 2: 피처명 기반 폴더 생성**

Figma 파일명에서 피처명 자동 추출 → kebab-case 변환.

```
예: Figma 파일명 "PUBG 9주년 이벤트" → pubg-anniversary

Nuxt 프로젝트:
  pages/pubg-anniversary.vue                      ← 루트 페이지
  components/pubg-anniversary/
    HeroSection.vue                                ← 섹션 컴포넌트
    EventSection.vue
    RewardSection.vue
    ...
  assets/scss/_pubg-anniversary-tokens.scss        ← 피처별 토큰

React + Next.js 프로젝트:
  app/pubg-anniversary/page.tsx                    ← 루트 페이지
  components/pubg-anniversary/
    HeroSection.tsx
    HeroSection.module.css (or .module.scss)
    EventSection.tsx
    ...
  styles/pubg-anniversary-tokens.css               ← 피처별 토큰

Default mode 차이점:
  → 토큰 파일에서 기존 MASTER.md / 프로젝트 토큰 참조
  → 새 토큰만 추가

--new mode 차이점:
  → 토큰 파일이 자체 완결 (외부 의존 없음)
  → 다른 프로젝트에 폴더째 복사 가능
```

### 4-2. Token File Format

**CSS Custom Properties (default):**

```css
/* figma-tokens.css — Auto-generated from Figma. Do not edit manually. */
/* Source: https://www.figma.com/design/{fileKey} */

:root {
  /* Colors */
  --figma-primary: #3B82F6;
  --figma-primary-hover: #2563EB;
  --figma-surface: #FFFFFF;
  --figma-surface-secondary: #F9FAFB;
  --figma-text-primary: #111827;
  --figma-text-secondary: #6B7280;
  --figma-border: #E5E7EB;

  /* Typography */
  --figma-font-family: 'Inter', system-ui, sans-serif;
  --figma-text-xs: 0.75rem;    /* 12px */
  --figma-text-sm: 0.875rem;   /* 14px */
  --figma-text-base: 1rem;     /* 16px */
  --figma-text-lg: 1.125rem;   /* 18px */
  --figma-text-xl: 1.25rem;    /* 20px */
  --figma-leading-tight: 1.25;
  --figma-leading-normal: 1.5;

  /* Spacing */
  --figma-space-1: 0.25rem;    /* 4px */
  --figma-space-2: 0.5rem;     /* 8px */
  --figma-space-3: 0.75rem;    /* 12px */
  --figma-space-4: 1rem;       /* 16px */
  --figma-space-6: 1.5rem;     /* 24px */
  --figma-space-8: 2rem;       /* 32px */

  /* Shadows */
  --figma-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --figma-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);

  /* Border Radius */
  --figma-radius-sm: 0.25rem;  /* 4px */
  --figma-radius-md: 0.5rem;   /* 8px */
  --figma-radius-lg: 0.75rem;  /* 12px */
  --figma-radius-full: 9999px;
}
```

**Tailwind extend (if Tailwind detected):**

```js
// figma.config.ts — merge into tailwind.config.ts theme.extend
export const figmaTokens = {
  colors: {
    figma: {
      primary: '#3B82F6',
      'primary-hover': '#2563EB',
      // ...
    },
  },
  spacing: { /* ... */ },
  borderRadius: { /* ... */ },
};
```

**SCSS (if `*.scss` or `sass` detected):**

```scss
// _figma-tokens.scss — Auto-generated from Figma. Do not edit manually.

// ── Variables ──
$figma-primary: #3B82F6;
$figma-primary-hover: #2563EB;
$figma-surface: #FFFFFF;
$figma-text-primary: #111827;
$figma-text-secondary: #6B7280;
$figma-border: #E5E7EB;

$figma-font-family: 'Inter', system-ui, sans-serif;
$figma-text-xs: 0.75rem;
$figma-text-sm: 0.875rem;
$figma-text-base: 1rem;
$figma-text-lg: 1.125rem;
$figma-text-xl: 1.25rem;

$figma-space-1: 0.25rem;
$figma-space-2: 0.5rem;
$figma-space-4: 1rem;
$figma-space-6: 1.5rem;
$figma-space-8: 2rem;

$figma-radius-sm: 0.25rem;
$figma-radius-md: 0.5rem;
$figma-radius-lg: 0.75rem;

$figma-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
$figma-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);

// ── Breakpoints ──
$figma-bp: 1024px;
$figma-bp-mobile-min: 360px;
$figma-bp-pc-target: 1920px;

// ── Mixins ──
@mixin figma-pc {
  @media (min-width: $figma-bp) { @content; }
}

@mixin figma-mobile-only {
  @media (max-width: $figma-bp - 1px) { @content; }
}

// ── Functions ──
@function figma-fluid($mobile, $desktop, $min-vw: $figma-bp-mobile-min, $max-vw: $figma-bp-pc-target) {
  $slope: ($desktop - $mobile) / ($max-vw - $min-vw);
  $intercept: $mobile - $slope * $min-vw;
  @return clamp(#{$mobile}, #{$intercept} + #{$slope * 100}vw, #{$desktop});
}

// Usage: font-size: figma-fluid(1rem, 2rem);
```

**SCSS 사용 시 추가 규칙:**
- CSS custom properties 대신 `$변수` 사용 (프로젝트 컨벤션에 따라 둘 다 가능)
- `@mixin figma-pc` 로 breakpoint 일관성 유지 — `@media` 직접 사용 금지
- `figma-fluid()` 함수로 clamp() 계산 자동화 — 수동 계산 금지
- 파일명: `_figma-tokens.scss` (partial, `_` prefix)
- `@use 'figma-tokens' as figma;` 로 네임스페이스 import

### 4-3. Responsive Token Format (responsive mode only)

When `responsive.json` exists, tokens that **differ across viewports** use `clamp()` for fluid scaling.
Tokens that are **identical** across viewports remain static.

**clamp() range uses breakpoints from Phase 3-3:**

```
minVw = mobileMinimum (default: 360px)
maxVw = pcTarget (default: 1920px)
breakpoint = breakpoint (default: 1024px) ← used for @media

Design values must be scaled before clamp:
  PC Figma value × (pcTarget / designPc) = target PC value
  Mobile Figma value × (mobilePortrait / designMobile) = target mobile value
```

**CSS Custom Properties (responsive):**

```css
/* figma-tokens.css — Responsive tokens from Figma */
/* clamp range: {mobileMinimum}px → {pcTarget}px */
/* Breakpoint: {breakpoint}px (PC↔Mobile) */
/* Design scale: PC {designPc}→{pcTarget}, Mobile {designMobile}→{mobilePortrait} */

:root {
  /* === Shared (same across all viewports) === */
  --figma-primary: #3B82F6;
  --figma-font-family: 'Inter', system-ui, sans-serif;
  --figma-radius-md: 0.5rem;
  --figma-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);

  /* === Fluid Typography (scales with viewport) === */
  /* Figma PC 96px → target 36px, Figma Mobile 48px → target 32px */
  --figma-text-h1: clamp(2rem, {intercept}rem + {slope}vw, 2.25rem);
  --figma-text-body: clamp(0.875rem, {intercept}rem + {slope}vw, 1rem);

  /* === Fluid Spacing (scales with viewport) === */
  --figma-space-section: clamp(1rem, {intercept}rem + {slope}vw, 3rem);
  --figma-space-content: clamp(0.75rem, {intercept}rem + {slope}vw, 1.5rem);

  /* === Breakpoint (from config, user-customizable) === */
  --figma-bp: 1024px;
}
```

**clamp() calculation formula:**

```
Step 1: Scale Figma values to target viewport
  targetMobile = figmaMobileValue × (mobilePortrait / designMobile)
  targetPc     = figmaPcValue × (pcTarget / designPc)

  Example (defaults): Figma PC h1=96px, Figma Mobile h1=48px
    targetPc     = 96 × (1920 / 2560) = 72px
    targetMobile = 48 × (480 / 720)   = 32px

Step 2: Calculate clamp()
  minVw = mobileMinimum (360)
  maxVw = pcTarget (1920)
  min = targetMobile, max = targetPc

  slope = (max - min) / (maxVw - minVw)
  intercept = min - slope * minVw
  → clamp({min/16}rem, {intercept/16}rem + {slope*100}vw, {max/16}rem)

  Example:
    slope = (72 - 32) / (1920 - 360) = 0.02564
    intercept = 32 - 0.02564 × 360 = 22.77
    → clamp(2rem, 1.423rem + 2.564vw, 4.5rem)
```

**Tailwind (responsive — if Tailwind detected):**

Use Tailwind's responsive prefixes instead of clamp() for layout, clamp() for typography/spacing:

```js
export const figmaTokens = {
  fontSize: {
    'figma-h1': ['clamp(1.5rem, 1.076rem + 1.878vw, 3rem)', { lineHeight: '1.2' }],
    'figma-body': ['clamp(0.875rem, 0.828rem + 0.188vw, 1rem)', { lineHeight: '1.5' }],
  },
  spacing: {
    'figma-section': 'clamp(1rem, 0.248rem + 3.286vw, 3rem)',
  },
};
```

**SCSS (responsive):**

```scss
// _figma-tokens.scss — figma-fluid() 함수로 자동 계산
@use 'sass:math';

$figma-bp: 1024px;
$figma-bp-mobile-min: 360px;
$figma-bp-pc-target: 1920px;

@function figma-fluid($mobile, $desktop, $min-vw: $figma-bp-mobile-min, $max-vw: $figma-bp-pc-target) {
  $slope: math.div($desktop - $mobile, $max-vw - $min-vw);
  $intercept: $mobile - $slope * $min-vw;
  @return clamp(#{$mobile}, #{$intercept} + #{$slope * 100}vw, #{$desktop});
}

@mixin figma-pc { @media (min-width: $figma-bp) { @content; } }

// Token 사용
$figma-text-h1: figma-fluid(2rem, 4.5rem);
$figma-text-body: figma-fluid(0.875rem, 1rem);
$figma-space-section: figma-fluid(1rem, 3rem);
```

```scss
// Component.module.scss — 사용 예시
@use 'figma-tokens' as figma;

.heroSection {
  padding: figma.$figma-space-section;
}

.heroTitle {
  font-size: figma.$figma-text-h1;
}

.cardGrid {
  display: grid;
  grid-template-columns: 1fr;

  @include figma.figma-pc {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### 4-4. Class Naming Rules

클래스 이름은 **역할(role)**을 드러내야 하며, 구조나 스타일 속성을 이름에 넣지 않는다.

#### 네이밍 원칙

| 원칙 | 좋은 예 | 나쁜 예 |
|------|--------|--------|
| **역할 기반** | `.heroSection`, `.productCard`, `.navPrimary` | `.section1`, `.card`, `.nav` |
| **용도 명시** | `.heroBg`, `.cardThumbnail`, `.avatarImg` | `.bg`, `.img`, `.image1` |
| **상태 포함** | `.buttonPrimary`, `.inputError` | `.blueButton`, `.redBorder` |
| **관계 표현** | `.heroTitle`, `.heroDescription` | `.title`, `.text` |
| **축약 금지** | `.navigationMenu`, `.backgroundImage` | `.navMnu`, `.bgImg` |

#### 구체적 규칙

```
1. 컴포넌트 루트: 섹션/컴포넌트 이름 그대로
   .loginForm, .heroSection, .productGrid

2. 자식 요소: 부모이름 + 역할
   .heroTitle, .heroDescription, .heroCta
   .loginFormInput, .loginFormSubmit

3. 이미지 클래스: 반드시 용도를 명시
   .heroBg          ← 히어로 배경 이미지
   .heroBgOverlay   ← 배경 위 오버레이
   .productPhoto    ← 상품 사진
   .brandLogo       ← 브랜드 로고

4. 상태 변형: variant/state 접미사
   .buttonPrimary, .buttonDisabled
   .cardHighlight, .cardCompact
```

#### Anti-Patterns

```css
/* WRONG: 의미 없는 이름 */
.wrapper { }
.inner { }
.box { }
.item { }
.text1 { }

/* CORRECT: 역할이 드러나는 이름 */
.eventSection { }
.eventContent { }
.rewardCard { }
.rewardItem { }
.eventDescription { }
```

**Component style file MUST reference global tokens:**

```css
/* LoginForm.module.css */
.loginForm {
  padding: var(--figma-space-6);
  background: var(--figma-surface);
  border-radius: var(--figma-radius-lg);
  box-shadow: var(--figma-shadow-md);
}

.loginFormTitle {
  font-size: var(--figma-text-xl);
  font-weight: 600;
  color: var(--figma-text-primary);
  line-height: var(--figma-leading-tight);
}

.loginFormSubmit {
  background: var(--figma-primary);
  color: var(--figma-surface);
  border-radius: var(--figma-radius-md);
  padding: var(--figma-space-2) var(--figma-space-4);
  transition: background 150ms ease;
}

.loginFormSubmit:hover {
  background: var(--figma-primary-hover);
}
```

---

## Phase 5: Markup Quality Standards

### 5-1. Semantic HTML (Mandatory)

Every element MUST use the most specific semantic tag available. `<div>` is a last resort.

| Visual Element | Correct Tag | Wrong |
|---------------|------------|-------|
| Page section | `<section>`, `<article>`, `<aside>` | `<div>` |
| Navigation | `<nav>` | `<div class="nav">` |
| Page header | `<header>` | `<div class="header">` |
| Page footer | `<footer>` | `<div class="footer">` |
| Heading hierarchy | `<h1>`→`<h6>` (sequential, no skips) | `<div class="title">` |
| Paragraph text | `<p>` | `<div>` or `<span>` |
| List of items | `<ul>`/`<ol>` + `<li>` | `<div>` repeated |
| Clickable action | `<button>` | `<div onClick>` |
| Navigation link | `<a href>` | `<span onClick>` |
| Form field | `<input>` + `<label>` | `<div contenteditable>` |
| Image | `<img alt="descriptive">` or `<figure>` + `<figcaption>` | `<div style="background-image">` for content images |
| Tabular data | `<table>` + `<thead>` + `<tbody>` | `<div>` grid |
| Time/Date | `<time datetime>` | `<span>` |
| Emphasized text | `<strong>`, `<em>` | `<span class="bold">` |
| Grouped fields | `<fieldset>` + `<legend>` | `<div>` |

### 5-2. Accessibility Checklist

Every generated component MUST pass:

- [ ] All interactive elements keyboard-reachable (tab order)
- [ ] `<button>` for actions, `<a>` for navigation — never reversed
- [ ] `<img>` has descriptive `alt` (not "image", not filename)
- [ ] Form `<input>` linked to `<label>` (via `htmlFor` / `id`)
- [ ] Color contrast >= 4.5:1 (text), >= 3:1 (large text, UI controls)
- [ ] Focus indicator visible on all interactive elements
- [ ] `aria-label` on icon-only buttons
- [ ] `role` attribute on custom interactive widgets
- [ ] Heading hierarchy is sequential (no h1 → h3 skip)
- [ ] `<ul>`/`<ol>` for any visually listed items

### 5-3. Wrapper Elimination (Fragment / template)

**불필요한 래핑 태그를 제거**하고 프레임워크가 제공하는 투명 래퍼를 사용:

| Stack | 투명 래퍼 | 사용 시점 |
|-------|----------|----------|
| React / Next.js | `<>...</>` 또는 `<React.Fragment>` | 형제 요소를 그룹핑할 때 (DOM에 노드 추가 안 함) |
| Vue / Nuxt | `<template>` (컴포넌트 루트 이외) | `v-if`, `v-for` 로 여러 요소를 조건부 렌더링할 때 |
| Svelte | `{#if}`, `{#each}` 블록 | 자체적으로 래핑 불필요 |

```tsx
// WRONG: 불필요한 div 래핑
<div>
  <Header />
  <Main />
  <Footer />
</div>

// CORRECT: React Fragment
<>
  <Header />
  <Main />
  <Footer />
</>
```

```vue
<!-- WRONG: 불필요한 div 래핑 -->
<div v-if="showGroup">
  <ItemA />
  <ItemB />
</div>

<!-- CORRECT: Vue template (DOM에 렌더링 안 됨) -->
<template v-if="showGroup">
  <ItemA />
  <ItemB />
</template>
```

**규칙**: 래핑 요소에 스타일이나 이벤트가 없으면 → Fragment/template 사용. 스타일이 있으면 → semantic 태그 사용.

### 5-4. Similar UI Consolidation (80% Rule)

디자인에서 **유사도 80% 이상**인 UI 패턴이 발견되면, 별도 컴포넌트로 분리하지 말고 **하나의 컴포넌트 + variant props/slots**으로 통합:

```
유사도 판단 기준:
  - 레이아웃 구조 동일
  - 색상/크기/텍스트만 다름
  → 하나의 컴포넌트 + props로 변형

  - 구조 자체가 다름 (요소 추가/제거, 레이아웃 방향 변경)
  → 별도 컴포넌트
```

| Stack | 변형 방법 |
|-------|----------|
| React | `variant` prop + 조건부 className / style |
| Vue | `variant` prop + `<slot>` for 커스텀 영역 |
| Svelte | `variant` prop + `<slot>` |
| React Native | `variant` prop + StyleSheet 조건 선택 |

```tsx
// React — 하나의 Card 컴포넌트가 3가지 변형 처리
interface CardProps {
  variant: 'default' | 'highlight' | 'compact';
  title: string;
  children: React.ReactNode;
}

export function Card({ variant, title, children }: CardProps): JSX.Element {
  return (
    <article className={styles[variant]}>
      <h3 className={styles.title}>{title}</h3>
      {children}
    </article>
  );
}
```

```vue
<!-- Vue — slot으로 커스텀 영역 제공 -->
<template>
  <article :class="$style[variant]">
    <h3 :class="$style.title">{{ title }}</h3>
    <slot />
  </article>
</template>

<script setup lang="ts">
defineProps<{ variant: 'default' | 'highlight' | 'compact'; title: string }>();
</script>
```

### 5-5. Component Structure Rules

```
Max nesting depth: 3 levels (container > group > element)
Max component length: 50 lines
Max props: 5 per component
```

**Split triggers:**

| Signal | Action |
|--------|--------|
| Component > 50 lines | Split into sub-components |
| Repeated visual pattern (2+ times) | Extract shared component |
| **Similar pattern (80%+ match)** | **Single component + variant prop** |
| Distinct visual boundary (card, modal, form) | Own component + own style file |
| 3+ related props | Group into object prop or extract sub-component |

### 5-6. Markup Anti-Patterns (NEVER Generate)

```tsx
// WRONG: div soup
<div className="card">
  <div className="card-header">
    <div className="title">Login</div>
  </div>
  <div className="card-body">
    <div className="input-group">
      <div className="label">Email</div>
      <div className="input"><input /></div>
    </div>
  </div>
</div>

// CORRECT: semantic markup
<article className={styles.card}>
  <header className={styles.header}>
    <h2 className={styles.title}>Login</h2>
  </header>
  <form className={styles.body}>
    <fieldset className={styles.fieldGroup}>
      <label htmlFor="email" className={styles.label}>Email</label>
      <input id="email" type="email" className={styles.input} />
    </fieldset>
  </form>
</article>
```

```tsx
// WRONG: 불필요한 래핑
<div>
  <ComponentA />
  <ComponentB />
</div>

// CORRECT: Fragment
<>
  <ComponentA />
  <ComponentB />
</>
```

```tsx
// WRONG: 유사한 UI를 별도 컴포넌트로
<DefaultCard />   // 구조 동일, 색상만 다름
<HighlightCard /> // 구조 동일, 색상만 다름

// CORRECT: 단일 컴포넌트 + variant
<Card variant="default" />
<Card variant="highlight" />
```

---

## Phase 6: Code Generation

### 6-0. Apply Storyboard Spec + Design Context

**스토리보드 스펙 (Phase 0-1)이 있으면 우선 적용:**

| storyboardSpec | Effect on Code Generation |
|----------------|--------------------------|
| `interactions` | 호버/클릭/스크롤 이벤트 → CSS `:hover`/`:active`/`:focus` + JS 핸들러 |
| `animations` | 트랜지션/애니메이션 → `transition`, `@keyframes`, timing/easing 스펙대로 |
| `states` | 로딩/에러/성공/빈 상태 → 조건부 렌더링 + 상태별 UI 컴포넌트 |
| `breakpoints` | Phase 3-3에서 이미 적용됨 |
| `colorGuide` | 스토리보드 컬러 가이드 → 토큰 검증 |
| `typographyGuide` | 스토리보드 타이포 가이드 → 토큰 검증 |

**design-context.json이 있으면 추가 적용:**

| Context Field | Effect on Code Generation |
|---------------|--------------------------|
| `constraints.accessibility = "AAA"` | Use `aria-describedby` on all form fields, `prefers-reduced-motion` media query, `prefers-contrast` support |
| `constraints.devices = ["mobile"]` | Mobile-only layout, no desktop breakpoints, touch target ≥ 44px |
| `constraints.devices = ["mobile","desktop"]` | Mobile-first with `md:` breakpoint |
| `aesthetic.style = "minimal"` | Reduce visual weight — fewer shadows, thinner borders, more whitespace |
| `aesthetic.style = "bold"` | Stronger shadows, thicker borders, larger typography scale |
| `brand.personality` | Preserve brand-unique visual patterns (do NOT distill these away) |
| `detectedStack.fonts` | Use project's existing font stack instead of Figma's font family |

### 6-1. Stack-Specific Rules

Generate code following these rules per stack:

#### React / Next.js + TypeScript

```
- Functional components with explicit return types
- Props interface defined above component
- Named exports (not default)
- <></> Fragment for sibling grouping (no unnecessary wrapper div)
- CSS Modules: import styles from './Component.module.css'
- Tailwind: classes in JSX, extract repeated patterns to @apply
- Responsive: mobile-first breakpoints
- Variant pattern: discriminated union props for similar UI
- useMemo/useCallback only when measurably needed (not by default)
- Next.js: use 'use client' only when client interactivity needed
- Next.js: Image component for images, Link for navigation
```

#### Vue 3 / Nuxt

```
- <script setup lang="ts"> composition API
- defineProps with TypeScript interface (with defaults via withDefaults)
- <template> for invisible grouping (v-if, v-for on multiple elements)
- <style scoped> (or <style module>) with CSS custom property references
- v-bind in <style> for dynamic values: color: v-bind(themeColor)
- <slot> + named slots for composable variant patterns
- <Teleport> for modals/overlays
- Or Tailwind classes in template
- Nuxt: <NuxtLink> for navigation, <NuxtImg> for images
- Nuxt: definePageMeta for page-level config
- computed() for derived state (not methods for template expressions)
```

#### Svelte

```
- TypeScript in <script lang="ts">
- Export let for props with types
- {#if}/{#each}/{#await} blocks — inherently wrapper-free
- <slot> for composable patterns
- <style> block with CSS custom property references
- Or Tailwind classes in markup
- Reactive declarations ($:) for derived values
- transition: directive for animations
```

#### SCSS (any framework with SCSS)

```
- @use 'figma-tokens' as figma — namespaced import (not @import)
- $변수 for tokens: figma.$figma-primary, figma.$figma-space-4
- @include figma.figma-pc { } for breakpoint — @media 직접 사용 금지
- figma-fluid($mobile, $desktop) for responsive values — 수동 clamp() 금지
- Nesting max 3 levels: .section { .title { .icon { } } } ← 한계
- & for BEM-like modifiers: &--active, &__title
- @each for variant generation from map
- Partials: _figma-tokens.scss, _figma-mixins.scss
- Vue: <style lang="scss" scoped> with @use
```

```scss
// Component usage example
@use 'figma-tokens' as figma;

.heroSection {
  position: relative;
  padding: figma.figma-fluid(1rem, 3rem);

  &Title {
    font-size: figma.figma-fluid(1.5rem, 3rem);
    color: figma.$figma-text-primary;
  }

  &Cta {
    background: figma.$figma-primary;
    border-radius: figma.$figma-radius-md;

    &:hover { background: figma.$figma-primary-hover; }
  }
}

.cardGrid {
  display: grid;
  grid-template-columns: 1fr;

  @include figma.figma-pc {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

#### React Native

```
- StyleSheet.create at bottom of file
- <></> Fragment for sibling grouping
- Dimensions-aware responsive layout
- Platform.select / Platform.OS for platform-specific styles
- Extract shared style constants to styles/tokens.ts
```

#### Flutter (Dart)

```
- StatelessWidget or StatefulWidget as appropriate
- Theme.of(context) for design tokens
- Extract shared values to lib/theme/figma_tokens.dart
- Proper widget composition
```

### 6-2. Image Code Patterns (from Phase 2-A classification)

Phase 2-A에서 분류된 이미지 유형별 코드 생성 규칙:

#### Background Image Class Separation (핵심 원칙)

배경 이미지 관련 요소는 **용도별로 별도 클래스**로 분리한다. 레이아웃과 이미지를 합치지 않는다.

##### 별도 클래스로 분리해야 하는 유형

| 유형 | 클래스 예시 | 분리 이유 |
|------|-----------|----------|
| **섹션 전면 배경** | `.heroBg`, `.eventBg`, `.rewardsBg` | 이벤트 기간/시즌별 이미지 교체 |
| **오버레이** | `.heroBgOverlay`, `.eventBgOverlay` | 투명도/그라데이션 독립 조절 |
| **패턴/텍스처** | `.sectionPattern`, `.headerTexture` | `background-repeat`/`size` 별도 제어 |
| **파티클/장식 효과** | `.heroParticle`, `.sparkleEffect` | 애니메이션 on/off, 성능 이슈 시 제거 |
| **캐릭터/일러스트** | `.heroCharacter`, `.eventIllust` | 콜라보/캐릭터별 교체, position 조절 |
| **그라데이션** | `.sectionGradient`, `.fadeBottom` | 테마별 색상 변경 |
| **비디오 포스터** | `.videoPoster` | 비디오 로드 전 폴백, JS에서 교체 |

##### Multi-Layer Pattern (섹션 배경 기본 구조)

Figma에서 배경 이미지가 있는 섹션은 다음 레이어 구조로 생성:

```
.{section}Section          ← 레이아웃 (position, size, padding, overflow)
  .{section}Bg             ← 배경 이미지 (URL, size, position) — z-index: 0
  .{section}BgOverlay      ← 오버레이 (gradient, opacity) — z-index: 1
  .{section}Character      ← 캐릭터/일러스트 (선택) — z-index: 2
  .{section}Pattern        ← 패턴/텍스처 (선택) — z-index: 1
  .{section}Content        ← 텍스트/버튼/UI — z-index: 최상위
```

```tsx
// 실제 마크업 예시 — 게임 이벤트 히어로 섹션
<section className={styles.heroSection}>
  <div className={styles.heroBg} />
  <div className={styles.heroBgOverlay} />
  <div className={styles.heroCharacter} />
  <div className={styles.heroContent}>
    <h1 className={styles.heroTitle}>Stellar Blade × PUBG</h1>
    <p className={styles.heroDescription}>기간한정 콜라보 이벤트</p>
    <a href="#rewards" className={styles.heroCta}>보상 확인하기</a>
  </div>
</section>
```

```css
/* heroSection.module.css */
.heroSection { position: relative; overflow: hidden; min-height: 100vh; }

.heroBg {
  position: absolute; inset: 0; z-index: 0;
  background-image: url('/assets/hero-bg.webp');
  background-size: cover;
  background-position: center;
}

.heroBgOverlay {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7));
}

.heroCharacter {
  position: absolute; bottom: 0; right: 5%; z-index: 2;
  width: 40%; height: 80%;
  background-image: url('/assets/hero-character.webp');
  background-size: contain;
  background-position: bottom center;
  background-repeat: no-repeat;
}

.heroContent { position: relative; z-index: 3; }
```

**모든 배경 관련 이미지가 독립 클래스**이므로:
- JS에서 `.heroBg`만 교체하면 배경만 바뀜
- `.heroCharacter`만 교체하면 캐릭터만 바뀜
- `.heroBgOverlay`의 opacity를 조절하면 텍스트 가독성만 조절 가능
- 성능 이슈 시 `.heroParticle`만 `display: none`

#### Responsive Background Image (반응형 배경 — PC/Mobile 분기)

```css
/* 배경 이미지 클래스 안에서만 반응형 처리 */
.heroBg {
  background-image: url('/assets/hero-mobile.webp');
  background-size: cover;
  background-position: center;
  position: absolute;
  inset: 0;
  z-index: 0;
}

@media (min-width: 1024px) {  /* {breakpoint}px */
  .heroBg {
    background-image: url('/assets/hero-pc.webp');
  }
}
```

**섹션별 배경 이미지가 여러 개인 경우** — 각각 고유 클래스:

```css
.heroBg     { background-image: url('/assets/hero-bg.webp'); /* ... */ }
.eventBg    { background-image: url('/assets/event-bg.webp'); /* ... */ }
.rewardsBg  { background-image: url('/assets/rewards-bg.webp'); /* ... */ }
```

**Figma 오버레이 감지**: 레이어에 `opacity < 1` 또는 `fills`에 반투명 색상이 IMAGE 위에 있으면 → `{section}BgOverlay` 클래스로 처리.

#### Content Image (독립적인 이미지 콘텐츠)

```tsx
// React / Next.js
<img
  src="/assets/product.webp"
  alt="상품 설명"              // Figma 레이어 이름 기반
  width={600}                  // Figma 레이어 width (scaled)
  height={400}                 // Figma 레이어 height (scaled)
  loading="lazy"               // 뷰포트 밖이면 lazy
/>

// Next.js — Image 컴포넌트 우선
import Image from 'next/image';
<Image
  src="/assets/product.webp"
  alt="상품 설명"
  width={600}
  height={400}
  priority={false}             // hero 이미지만 priority={true}
/>
```

```vue
<!-- Nuxt — NuxtImg 우선 -->
<NuxtImg
  src="/assets/product.webp"
  alt="상품 설명"
  width="600"
  height="400"
  loading="lazy"
/>
```

#### Responsive Content Image (뷰포트별 다른 이미지)

```html
<picture>
  <source media="(min-width: 1024px)" srcset="/assets/hero-pc.webp" />
  <img src="/assets/hero-mobile.webp" alt="히어로 이미지" loading="eager" />
</picture>
```

#### 이미지 공통 규칙

| 규칙 | 설명 |
|------|------|
| **format** | `.webp` 우선 (fallback: `.png`/`.jpg`) |
| **alt** | Figma 레이어 이름에서 파생, 장식 이미지는 `alt=""` + `aria-hidden="true"` |
| **width/height** | 항상 명시 (CLS 방지), Figma 레이어 크기를 스케일 팩터 적용 후 사용 |
| **loading** | 뷰포트 상단(hero, header) → `eager`, 나머지 → `lazy` |
| **object-fit** | `cover` (배경/히어로), `contain` (로고/아이콘), `fill` 사용 금지 |
| **반응형 크기** | Content image는 `max-width: 100%; height: auto;` 기본 |
| **배경 이미지 + 텍스트** | 반드시 오버레이(`::before` 또는 gradient)로 텍스트 가독성 확보 |
| **장식 패턴** | `background-repeat: repeat` + `background-size` 조절 |

#### Anti-Patterns

```tsx
// WRONG: 레이아웃 클래스에 background-image를 합침
<section className={styles.hero} />  /* .hero에 bg-image + padding + flex 등 다 섞임 */

// CORRECT: 배경 이미지는 별도 클래스
<section className={styles.heroSection}>
  <div className={styles.heroBg} />
  <div className={styles.heroContent}>...</div>
</section>
```

```tsx
// WRONG: inline style로 배경 이미지
<div style={{ backgroundImage: `url(${bg})` }} />

// CORRECT: 전용 클래스에 이미지 URL
<div className={styles.heroBg} />
/* JS 동적 교체 시: element.style.backgroundImage = url(...) on .heroBg만 */
```

```css
/* WRONG: 배경 + 텍스트, 오버레이 없음 */
.hero { background-image: url(...); color: white; }

/* CORRECT: 3-layer 분리 (bg / overlay / content) */
.heroSection { position: relative; }
.heroBg { background-image: url(...); position: absolute; inset: 0; z-index: 0; }
.heroBgOverlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); z-index: 1; }
.heroContent { position: relative; z-index: 2; color: white; }
```

```css
/* WRONG: 의미 없는 이름 */
.bg { }
.bgImg { }
.overlay { }

/* CORRECT: 섹션별 명시적 이름 */
.heroBg { }
.heroBgOverlay { }
.eventBg { }
.rewardsBg { }
```

### 6-3. Responsive Code Generation (responsive mode only)

When `responsive.json` exists, apply these rules on top of stack-specific rules:

#### Principle: Fluid First, Breakpoint Second

```
1. Typography & Spacing → clamp() fluid tokens (no breakpoints needed)
2. Layout direction changes → @media at project breakpoint (flex-direction, grid-template)
3. Visibility toggles → @media at project breakpoint (display: none/block)
4. Component swaps → conditional render with useMediaQuery or CSS
```

**Breakpoint selection**: Use `{breakpoints}` from Phase 3-3. Pick the breakpoint closest to where the layout structurally changes between Figma viewports. For example:
- Figma mobile=375px, desktop=1440px → use project's `md` (typically 768px) as primary breakpoint
- If project has `tablet: 1024px` → use that instead
- If 3 viewports (mobile/tablet/desktop) → use 2 breakpoints (e.g., `sm` and `lg`)

#### CSS Modules (responsive example)

```css
/* Component.module.css */
/* Breakpoints from project: {breakpoints} */

.container {
  display: flex;
  flex-direction: column;                          /* mobile-first */
  gap: var(--figma-space-content);                 /* fluid: clamp() */
  padding: var(--figma-space-section);             /* fluid: clamp() */
}

.title {
  font-size: var(--figma-text-h1);                 /* fluid: clamp() */
  line-height: 1.2;
}

.cardGrid {
  display: grid;
  grid-template-columns: 1fr;                      /* mobile: single column */
  gap: var(--figma-space-content);
}

/* Layout breakpoint — use project's breakpoint, NOT hardcoded */
@media (min-width: 1024px) {              /* {breakpoint}px from Phase 3-3 */           /* or project's md value */
  .container {
    flex-direction: row;
  }
  .cardGrid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
}

/* Visibility toggle — same breakpoint */
.mobileOnly { display: block; }
.desktopOnly { display: none; }

@media (min-width: 1024px) {              /* {breakpoint}px from Phase 3-3 */
  .mobileOnly { display: none; }
  .desktopOnly { display: block; }
}
```

#### Tailwind (responsive example)

Use project's Tailwind screen prefixes (e.g., `sm:`, `md:`, `lg:`) — NOT hardcoded pixel values.

```tsx
{/* Uses project's Tailwind breakpoints — md: maps to project's screens.md */}
<div className="flex flex-col md:flex-row gap-[--figma-space-content] p-[--figma-space-section]">
  <h1 className="text-[length:--figma-text-h1] leading-tight">Title</h1>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-[--figma-space-content]">
    {/* cards */}
  </div>
  <nav className="md:hidden">Mobile Nav</nav>
  <nav className="hidden md:flex">Desktop Nav</nav>
</div>
```

#### Anti-Patterns (NEVER do in responsive mode)

| Wrong | Right |
|-------|-------|
| Separate mobile/desktop component files | Single component with responsive CSS |
| `@media` for font-size/spacing | `clamp()` via fluid tokens |
| Hardcoded `@media (min-width: 768px)` | Use project breakpoint from Phase 3-3 or Tailwind prefix |
| Pixel values in responsive styles | Token variables everywhere |
| Duplicated markup for each viewport | Visibility toggles or conditional sections |
| `window.innerWidth` checks in JS | CSS-only responsive (`@media`, `clamp()`, `auto-fit`) |
| Inventing new breakpoints | Use project's existing breakpoint system |

---

## Phase 7: Token Mapping (default mode)

**Only in default (project integration) mode.** Map extracted Figma tokens to the project's existing token system.

### Token Source Priority

```
1. MASTER.md (.claude/vibe/design-system/{project}/MASTER.md)  ← 최우선
2. design-context.json (.claude/vibe/design-context.json)       ← 보조
3. Project theme files (tailwind.config, CSS variables, etc.)   ← 폴백
4. Generate new figma-tokens                                     ← 마지막 수단
```

### Mapping Rules

1. **MASTER.md exists** → authoritative token source
   - Figma color ≈ MASTER.md color (ΔE < 5) → use MASTER.md token name
   - Figma spacing ≈ MASTER.md spacing (±2px) → use MASTER.md token name
   - Figma font ≈ MASTER.md font → use MASTER.md token name
   - Unmatched Figma values → add to `figma-tokens.css` as supplementary tokens

2. **No MASTER.md, but design-context.json exists** →
   - Use `detectedStack` info for naming convention
   - Use `aesthetic.colorMood` to validate token naming (e.g., warm palette → warm- prefix)
   - Generate `figma-tokens.css` grouped by category

3. **No design system at all** →
   - Generate `figma-tokens.css` (or Tailwind extend)
   - Group tokens by category (color, typography, spacing, shadow)

### Output Mapping Comment

Always output token mapping as a comment block at the top of the token file:

```
/* Figma Token Mapping:
 * Figma "Primary/Default" → var(--figma-primary) = #3B82F6
 *   ✅ Matched: var(--color-blue-500) from MASTER.md
 * Figma "Text/Body" → var(--figma-text-base) = 1rem / 1.5
 *   ✅ Matched: var(--text-base) from MASTER.md
 * Figma "Accent/Glow" → var(--figma-accent-glow) = #7C3AED
 *   ⚠️ New token: no existing match
 */
```

---

## Phase 8: Correction Notes

After generating code, output a brief correction report:

```markdown
## Correction Notes

### Generation Mode
- Mode: default / --new / responsive
- Output directory: {path}
- Viewports: {list of viewport labels + widths, if responsive}

### Files Generated
| File | Type | Description |
|------|------|-------------|
| styles/tokens.css | Global tokens | {N} colors, {N} spacing, {N} typography |
| styles/global.css | Base styles | Reset + typography + layout |
| ComponentName/ComponentName.tsx | Component | Root component |
| ComponentName/ComponentName.module.css | Styles | Component-specific styles |

### Responsive Summary (responsive mode only)
| Token | Mobile | Desktop | Strategy |
|-------|--------|---------|----------|
| --figma-text-h1 | 24px | 48px | clamp() |
| --figma-space-section | 16px | 48px | clamp() |
| Card grid | 1col | 3col | @media grid |
| Sidebar | hidden | visible | @media display |

- Fluid tokens generated: {N}
- Layout breakpoints used: {list}
- Component swaps: {list or "none"}

### Layer Issues Found
- [Layer name] was ambiguous → interpreted as [component] based on image
- [Layer structure] didn't match visual → used image-based layout

### Markup Quality
- Semantic tags used: {list}
- Accessibility: {pass/fail items}

### Recommendations for Figma File
- Use Auto Layout for [specific frame] to improve extraction accuracy
- Name layers semantically (e.g., "login-form" not "Frame 47")
- Use consistent spacing tokens
- (responsive) Keep same component names across mobile/desktop frames for easier mapping
```

---

## Phase 9: Visual Verification Loop

코드 생성 완료 후, **Figma 원본 디자인과 생성된 UI를 비교**하여 완성도를 높이는 검증 루프.

### 9-1. 스크린샷 비교

```
1. Figma 원본 스크린샷: Phase 0에서 get_screenshot으로 획득한 이미지
2. 생성된 UI 스크린샷: /vibe.utils --preview 또는 브라우저 스크린샷
3. 두 이미지를 side-by-side로 비교
```

### 9-2. 차이점 검출

이미지를 비교하여 다음 항목 체크:

| 검증 항목 | 비교 방법 |
|----------|----------|
| **레이아웃** | 요소 배치, 정렬, 간격이 원본과 일치하는가 |
| **타이포그래피** | 폰트 크기, 굵기, 줄간격이 원본과 일치하는가 |
| **색상** | 배경, 텍스트, 버튼 색상이 원본과 일치하는가 |
| **이미지** | 배경 이미지, 에셋이 올바르게 표시되는가 |
| **간격/여백** | padding, margin, gap이 원본과 일치하는가 |
| **반응형** | (responsive mode) 모바일/데스크탑 각각 원본과 일치하는가 |
| **누락 요소** | 원본에 있는데 생성 코드에 없는 요소가 있는가 |

### 9-3. Diff Report 출력

```markdown
## Visual Diff Report

### Match Score: {N}% (목표: 95%+)

### 불일치 항목
| # | 섹션 | 항목 | Figma 원본 | 생성 코드 | 심각도 |
|---|------|------|-----------|----------|--------|
| 1 | Hero | 제목 font-size | 48px | 36px | P1 |
| 2 | Hero | 배경 이미지 | 표시됨 | 누락 | P1 |
| 3 | Card | border-radius | 12px | 8px | P2 |

### 수정 필요
- P1: {count}건 (반드시 수정)
- P2: {count}건 (권장 수정)
```

### 9-4. Auto-Fix Loop

```
P1 불일치가 있으면:
  1. 해당 컴포넌트/스타일 파일을 수정
  2. 다시 스크린샷 비교
  3. P1이 0이 될 때까지 반복 (횟수 제한 없음)

수렴 감지:
  - 이전 라운드와 동일한 P1 항목이 반복되면 → 접근 방식 변경
  - 같은 항목이 3회 연속 미해결 → 해당 항목만 사용자에게 확인 요청 후 계속
```

### 9-5. 검증 완료 조건

```
✅ Match Score 95% 이상
✅ P1 불일치 0건
✅ 모든 이미지 에셋 표시 확인
✅ (responsive) 모바일 + 데스크탑 각각 95% 이상
```

---

## Refine Mode (`--refine`)

이전 `/vibe.figma` 실행으로 생성된 코드의 완성도가 부족할 때 사용.
**새로 만들지 않고, 기존 코드를 Figma 원본과 재비교하여 수정만 한다.**

### Refine 플로우

```
Step 1: URL 재입력
  → 이전과 동일한 방식으로 스토리보드/디자인 URL 입력
  → 또는 "이전과 동일" 입력 시 이전 URL 재사용

Step 2: 기존 코드 스캔
  → 프로젝트에서 이전에 생성된 파일 탐색 (pages/, components/ 내 피처 폴더)
  → 생성된 컴포넌트 목록 파악

Step 3: Figma 원본 재추출
  → get_design_context + get_screenshot으로 최신 디자인 데이터 획득

Step 4: Side-by-side 비교
  → Figma 스크린샷 vs 기존 코드의 렌더링 결과
  → Phase 9 검증 루프와 동일한 비교 항목:
    레이아웃, 타이포, 색상, 이미지, 간격, 누락 요소

Step 5: Diff 기반 수정
  → 변경이 필요한 파일만 Edit
  → 새 파일 생성 최소화
  → 수정 사유를 주석으로 남기지 않음 (코드만 수정)

Step 6: 재검증
  → Phase 9 검증 루프 실행 (P1=0 될 때까지)
```

### Refine에서 수정하는 항목

| 카테고리 | 수정 내용 |
|----------|----------|
| **누락 에셋** | 다운로드 안 된 이미지 재다운로드 + 경로 설정 |
| **레이아웃 불일치** | flex/grid 방향, 정렬, 간격 보정 |
| **타이포 불일치** | font-size, weight, line-height, letter-spacing 보정 |
| **색상 불일치** | 배경, 텍스트, 보더 색상 보정 |
| **누락 컴포넌트** | Figma에 있는데 코드에 없는 섹션 추가 |
| **인터랙션 누락** | 호버/포커스/액티브 상태 추가 |
| **반응형 누락** | 브레이크포인트 대응 미흡한 부분 보정 |
| **이미지 경로** | 임시 URL → 로컬 경로 교체, 누락 이미지 다운로드 |

### Refine에서 하지 않는 것

```
❌ 파일 구조 변경 (이미 생성된 폴더/파일 구조 유지)
❌ 컴포넌트 분리/통합 (구조적 리팩토링은 수동으로)
❌ 토큰 파일 재생성 (기존 토큰에 누락분만 추가)
❌ 전체 재작성 (diff 기반 최소 수정만)
```

---

## Tool Usage Rules

| Tool | When |
|------|------|
| **MCP: get_design_context** | Figma 추출 — 코드 + 스크린샷 + 메타데이터 (토큰 불필요) |
| **MCP: get_metadata** | 레이어 구조 XML (노드 ID, 크기, 위치) |
| **MCP: get_screenshot** | 프레임 이미지 렌더링 |
| Read | Project config, existing components, design-context.json |
| Glob | Find existing components, theme files, design tokens |
| Grep | Search for existing color/spacing/typography definitions |
| Write | Create new component files and style files |
| Edit | Update existing theme/token files to add new tokens (default mode) |

## Important

- **Never guess colors** — extract from layers.json or image analysis
- **Never invent spacing** — use extracted values mapped to token scale
- **Never hardcode values** — all visual properties reference token variables
- **Preserve existing patterns** — match the project's existing component style (default mode)
- **Image is truth** — when layer structure is confusing, trust what the image shows
- **Ask before overwriting** — if a component file already exists, ask the user first
- **No console.log** — never include debug logging in generated code
- **No div soup** — every element uses the correct semantic tag
- **Component size limit** — split components exceeding 50 lines
- **Style separation** — global tokens file + per-component style files, always

## Next Steps: Design Quality Pipeline

After generating code, present the following pipeline to the user:

### Quick (default recommendation)
```
/design-normalize → /design-audit
```
- Normalize: 하드코딩 값 → MASTER.md 토큰으로 치환
- Audit: A11Y + 성능 + 반응형 + AI Slop 검출

### Thorough (recommended for production)
```
/design-normalize → /design-audit → /design-critique → /design-polish
```
- + Critique: Nielsen 10 휴리스틱 + 5 페르소나 분석
- + Polish: 인터랙션 상태 보완 (hover/focus/loading/error)

### Pre-requisite check
If `.claude/vibe/design-context.json` does NOT exist:
```
⚠️ 디자인 컨텍스트가 없습니다. /design-teach 를 먼저 실행하면
   브랜드, 접근성, 타겟 디바이스에 맞춘 더 정확한 코드를 생성할 수 있습니다.
```

### Output format
```
## 🎨 Design Quality Pipeline

생성된 파일: {file list}

추천 다음 단계:
  1. /design-normalize  — 토큰 정렬 (하드코딩 제거)
  2. /design-audit      — 기술 품질 검사
  3. /design-critique    — UX 휴리스틱 리뷰
  4. /design-polish      — 최종 인터랙션 보완

💡 /design-teach 가 아직 설정되지 않았다면 먼저 실행하세요.
```
