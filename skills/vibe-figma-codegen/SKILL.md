---
name: vibe-figma-codegen
description: Code generation — markup, stack rules, image patterns, responsive, verification
triggers: []
tier: standard
---

# Skill: vibe-figma-codegen — 코드 생성 규칙

마크업 품질, 스택별 코드 생성, 이미지 패턴, 반응형, 검증 루프.

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
@media (min-width: 1024px) {              /* {breakpoint}px from Phase 3-3 */
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
