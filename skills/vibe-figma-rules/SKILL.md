---
name: vibe-figma-rules
description: Figma to Code 분석 및 감지 규칙 — Model Routing, 디자인 분석, 레이어 추출, 스택 감지
triggers: []
tier: standard
---

# Skill: vibe-figma-rules — 분석 및 감지 규칙

항상 이 skill을 참조하여 코드를 생성한다.

---

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

---

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

---

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
