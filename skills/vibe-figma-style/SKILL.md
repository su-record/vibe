---
name: vibe-figma-style
description: Style architecture — tokens, SCSS, class naming, responsive tokens
triggers: []
tier: standard
---

# Skill: vibe-figma-style — 스타일 아키텍처

토큰 포맷, SCSS 규칙, 클래스 네이밍, 반응형 토큰 계산.

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

**Step 2: 스타일 구조 — 모드별 분리**

Figma 파일명에서 피처명 자동 추출 → kebab-case 변환.

### 기본 모드 (기존 프로젝트에 추가)

```
⚠️ 기존 스타일 구조를 먼저 분석하고 그대로 따른다.
  1. Glob/Grep으로 기존 스타일 파일 패턴 탐색:
     - 디렉토리 구조 (styles/, scss/, css/)
     - 파일 네이밍 (BEM, camelCase, kebab-case)
     - import 방식 (@use, @import, CSS Modules)
     - 기존 변수/mixin 파일 위치
  2. 기존 토큰/변수/mixin을 최대한 재사용
  3. 새 컴포넌트 스타일만 기존 패턴대로 추가
  4. 기존 스타일 파일을 수정하지 않음 (사이드이펙트 방지)

예: 기존 프로젝트가 assets/scss/ 구조를 쓰면:
  assets/scss/_variables.scss          ← 기존 (수정 안 함)
  assets/scss/_mixins.scss             ← 기존 (재사용)
  assets/scss/pages/
    _winter-pcbang.scss                ← 새 피처 스타일 (기존 패턴 따름)

예: 기존 프로젝트가 CSS Modules를 쓰면:
  components/winter-pcbang/
    HeroSection.module.scss            ← 기존 패턴대로
    DailyCheckIn.module.scss
```

### --new 모드 (새 피처, 자체 완결)

```
피처 전용 스타일 폴더를 생성하고, 글로벌 + 컴포넌트별 2-tier 구조:

styles/{feature-name}/
  index.scss                  ← 진입점 (아래 파일 전부 import)
  _tokens.scss                ← 피처 전용 토큰 (색상, 타이포, 간격)
  _mixins.scss                ← 피처 전용 mixin (breakpoint, fluid)
  _base.scss                  ← 피처 공통 (reset, 폰트, 기본 레이아웃)

  // 섹션별 스타일
  _hero.scss                  ← HeroSection 전용
  _daily-checkin.scss         ← DailyCheckInSection 전용
  _play-time-mission.scss     ← PlayTimeMissionSection 전용
  _token-exchange.scss        ← TokenExchangeSection 전용
  _token-raffle.scss          ← TokenRaffleSection 전용
  _caution.scss               ← CautionSection 전용

  // 재사용 컴포넌트별 스타일
  _card.scss                  ← 보상 카드, 상품 카드 등 공통 카드
  _button.scss                ← CTA 버튼, 출석 버튼, 교환 버튼
  _badge.scss                 ← 상태 배지 (완료, 진행중, 잠금)
  _progress.scss              ← 프로그레스 바, 타임 게이지
  _popups.scss                ← 팝업/모달 공통 (오버레이, 컨텐츠)
  _tooltip.scss               ← 툴팁, 안내 말풍선

index.scss 내용:
  // 기반
  @use 'tokens';
  @use 'mixins';
  @use 'base';

  // 재사용 컴포넌트
  @use 'card';
  @use 'button';
  @use 'badge';
  @use 'progress';
  @use 'popups';
  @use 'tooltip';

  // 섹션
  @use 'hero';
  @use 'daily-checkin';
  @use 'play-time-mission';
  @use 'token-exchange';
  @use 'token-raffle';
  @use 'caution';

각 컴포넌트 스타일 파일 규칙:
  - @use '../tokens' as t; 로 토큰 참조
  - @use '../mixins' as m; 로 mixin 참조
  - 해당 섹션의 클래스만 정의 (다른 섹션 스타일 금지)
  - 역할 기반 클래스 네이밍 (Phase 4-4 규칙 적용)
  - 배경 이미지는 별도 클래스 (Multi-Layer 패턴)

_tokens.scss 내용:
  $feature-primary: #xxx;
  $feature-text: #xxx;
  $feature-bp: 1024px;
  @function fluid($min, $max) { ... }
  // 자체 완결 — 외부 의존 없음

이 폴더째 다른 프로젝트에 복사 가능.
```

### 컴포넌트 ↔ 스타일 파일 매핑 규칙

```
두 종류의 스타일 파일이 필요:

1. 섹션 스타일 — 페이지의 각 영역
   | 컴포넌트 | --new 모드 | 기본 모드 |
   |---------|-----------|---------|
   | HeroSection.vue | _hero.scss | 기존 패턴 따름 |
   | DailyCheckIn.vue | _daily-checkin.scss | 기존 패턴 따름 |
   | CautionSection.vue | _caution.scss | 기존 패턴 따름 |

2. 재사용 컴포넌트 스타일 — 여러 섹션에서 공통 사용
   | 패턴 | --new 모드 | 용도 |
   |------|-----------|------|
   | 카드 (보상, 상품, 아이템) | _card.scss | 그리드 아이템, 리스트 아이템 |
   | 버튼 (CTA, 출석, 교환) | _button.scss | 액션 트리거 |
   | 배지 (상태 표시) | _badge.scss | 완료/진행중/잠금 표시 |
   | 프로그레스 | _progress.scss | 게이지, 달성도 |
   | 팝업/모달 | _popups.scss | 확인, 상세, 입력 |

재사용 컴포넌트 감지 방법:
  → 디자인 프레임에서 2회 이상 반복되는 시각 패턴
  → 같은 구조 + 다른 데이터 → 하나의 스타일 파일 + variant

vibe-figma-frame에서 프레임별 추출 시:
  → 섹션 스타일 파일에 해당 섹션 스타일 작성
  → 반복 패턴 발견 시 재사용 컴포넌트 스타일 파일로 분리
  → 토큰에 새 값 추가 (중복 시 기존 토큰 재사용)
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
