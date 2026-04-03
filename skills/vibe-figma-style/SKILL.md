---
name: vibe-figma-style
description: Style architecture — tokens, SCSS, class naming, responsive tokens
triggers: []
tier: standard
---

# Skill: vibe-figma-style — 스타일 아키텍처

토큰 포맷, SCSS 규칙, 클래스 네이밍, 반응형 토큰 계산.
디렉토리 감지는 **vibe-figma-rules R-2.2** 참조.

---

## S-1. 토큰 Resolution Priority

**기본 모드 (프로젝트 통합):**

1. **MASTER.md** (`.claude/vibe/design-system/{project}/MASTER.md`) — 최우선
2. **design-context.json** (`.claude/vibe/design-context.json`) — 보조
3. **프로젝트 테마 파일** (tailwind.config, CSS variables 등) — 폴백
4. **새 figma-tokens 생성** — 마지막 수단

**--new 모드:** 자체 완결 토큰 파일 생성 (MASTER.md 의존 없음).

### Mapping Rules

- Figma color ≈ 기존 토큰 (ΔE < 5) → 기존 토큰명 사용
- Figma spacing ≈ 기존 토큰 (±2px) → 기존 토큰명 사용
- 매칭 없는 값 → `figma-tokens` 보충 토큰으로 추가

---

## S-2. 토큰 파일 포맷

### CSS Custom Properties (기본)

```css
:root {
  /* Colors */
  --figma-primary: #3B82F6;
  --figma-surface: #FFFFFF;
  --figma-text-primary: #111827;
  --figma-border: #E5E7EB;

  /* Typography */
  --figma-font-family: 'Inter', system-ui, sans-serif;
  --figma-text-sm: 0.875rem;
  --figma-text-base: 1rem;
  --figma-text-xl: 1.25rem;

  /* Spacing */
  --figma-space-2: 0.5rem;
  --figma-space-4: 1rem;
  --figma-space-8: 2rem;

  /* Shadows, Radius */
  --figma-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --figma-radius-md: 0.5rem;
}
```

### SCSS (SCSS 감지 시)

```scss
// _figma-tokens.scss
@use 'sass:math';

$figma-primary: #3B82F6;
$figma-text-primary: #111827;
$figma-font-family: 'Inter', system-ui, sans-serif;
$figma-text-base: 1rem;
$figma-space-4: 1rem;
$figma-radius-md: 0.5rem;

// Breakpoints
$figma-bp: 1024px;
$figma-bp-mobile-min: 360px;
$figma-bp-pc-target: 1920px;

// Mixins
@mixin figma-pc { @media (min-width: $figma-bp) { @content; } }
@mixin figma-mobile-only { @media (max-width: $figma-bp - 1px) { @content; } }

// Fluid function (clamp 자동화)
@function figma-fluid($mobile, $desktop, $min-vw: $figma-bp-mobile-min, $max-vw: $figma-bp-pc-target) {
  $slope: math.div($desktop - $mobile, $max-vw - $min-vw);
  $intercept: $mobile - $slope * $min-vw;
  @return clamp(#{$mobile}, #{$intercept} + #{$slope * 100}vw, #{$desktop});
}
```

**SCSS 사용 시 필수 규칙:**
- `@use 'figma-tokens' as figma;` 네임스페이스 import
- `@include figma.figma-pc { }` — `@media` 직접 사용 금지
- `figma-fluid($mobile, $desktop)` — 수동 clamp() 금지

### Tailwind (Tailwind 감지 시)

```js
export const figmaTokens = {
  colors: { figma: { primary: '#3B82F6' } },
  spacing: { /* ... */ },
  borderRadius: { /* ... */ },
};
```

---

## S-3. 반응형 토큰 (responsive mode)

뷰포트 간 값이 다른 토큰은 `clamp()`로 fluid 스케일링.
동일한 값은 static 유지. 계산 공식은 **vibe-figma-rules R-3** 참조.

```css
:root {
  /* Shared (뷰포트 간 동일) */
  --figma-primary: #3B82F6;
  --figma-radius-md: 0.5rem;

  /* Fluid (뷰포트 간 다름) */
  --figma-text-h1: clamp(2rem, 1.423rem + 2.564vw, 4.5rem);
  --figma-space-section: clamp(1rem, 0.248rem + 3.286vw, 3rem);
}
```

```scss
// SCSS — figma-fluid() 사용
$figma-text-h1: figma-fluid(2rem, 4.5rem);
$figma-space-section: figma-fluid(1rem, 3rem);
```

---

## S-4. 스타일 파일 구조

### --new 모드 (자체 완결)

```
styles/{feature-name}/
  index.scss              ← 진입점
  _tokens.scss            ← 피처 전용 토큰
  _mixins.scss            ← 피처 전용 mixin
  _base.scss              ← 피처 공통 reset/폰트
  layout/                 ← 섹션 배치/구조 (position, flex/grid, padding, background)
    _page.scss
    _hero.scss
    _feature-a.scss
  components/             ← UI 요소 모양 (color, font, border, shadow, hover)
    _card.scss
    _button.scss
    _popups.scss
```

**layout vs components 구분:**
- `layout/` → 섹션의 위치, 크기, 배치, 간격, 배경
- `components/` → UI 요소의 모양, 색상, 타이포, 인터랙션 상태

### 기본 모드 (기존 프로젝트 추가)

```
기존 스타일 구조를 분석하고 그대로 따른다:
  1. Glob/Grep으로 기존 패턴 탐색 (디렉토리, 네이밍, import 방식)
  2. 기존 토큰/변수/mixin 재사용
  3. 새 컴포넌트 스타일만 기존 패턴대로 추가
  4. 기존 스타일 파일은 수정하지 않음
```

---

## S-5. 클래스 네이밍 규칙

클래스 이름은 **역할(role)**을 드러내야 하며, 구조나 스타일 속성을 이름에 넣지 않는다.

| 원칙 | 좋은 예 | 나쁜 예 |
|------|--------|--------|
| 역할 기반 | `.heroSection`, `.productCard` | `.section1`, `.card` |
| 용도 명시 | `.heroBg`, `.cardThumbnail` | `.bg`, `.img` |
| 관계 표현 | `.heroTitle`, `.heroDescription` | `.title`, `.text` |
| 축약 금지 | `.navigationMenu` | `.navMnu` |

### 구체적 규칙

```
1. 컴포넌트 루트: 섹션/컴포넌트 이름 → .loginForm, .heroSection
2. 자식 요소: 부모이름 + 역할 → .heroTitle, .heroCta
3. 이미지 클래스: 용도 명시 → .heroBg, .productPhoto, .brandLogo
4. 상태 변형: variant/state 접미사 → .buttonPrimary, .cardHighlight
```

### Anti-Patterns

```css
/* WRONG */
.wrapper { } .inner { } .box { } .item { } .text1 { }

/* CORRECT */
.eventSection { } .eventContent { } .rewardCard { } .eventDescription { }
```

---

## S-6. 토큰 매핑 코멘트 (기본 모드)

토큰 파일 상단에 매핑 결과를 코멘트로 출력:

```
/* Figma Token Mapping:
 * Figma "Primary" → var(--figma-primary) = #3B82F6
 *   ✅ Matched: var(--color-blue-500) from MASTER.md
 * Figma "Accent" → var(--figma-accent) = #7C3AED
 *   New token: no existing match
 */
```
