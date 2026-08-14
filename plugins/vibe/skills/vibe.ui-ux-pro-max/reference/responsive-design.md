# Responsive Design Reference

Deep reference for building layouts that adapt to any screen, input method, and environment. Covers mobile-first methodology, breakpoint strategy, input modality, safe areas, images, typography scaling, and container queries.

---

## Mobile-First Development

### The Core Principle

Write base styles for the smallest viewport first, then use `min-width` media queries to add complexity as space increases. This is progressive enhancement applied to layout.

The inverse approach — starting at desktop and overriding down — produces larger CSS, more specificity conflicts, and worse performance on mobile because the browser must parse and then undo rules.

```css
/* Wrong: desktop-first with max-width overrides */
.card {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 768px) {
  .card { display: block; } /* fighting the cascade */
}

/* Correct: mobile-first with min-width additions */
.card {
  display: block; /* single column by default */
}
@media (min-width: 768px) {
  .card {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
```

In Tailwind, unprefixed utilities are the mobile base. Prefixes add styles at and above a breakpoint.

```html
<!-- Single column on mobile, two columns from md (768px) up -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

### Progressive Enhancement in Practice

Start with the content working at any width, then layer layout, then layer decoration.

1. Content: readable text, visible images, working links — no CSS required
2. Layout: flexbox/grid for spatial organization
3. Enhancement: hover effects, transitions, complex grid areas

### DO / DON'T

- DO write all base styles without a media query — that is your mobile design.
- DO load critical CSS inline and defer large layout stylesheets where possible.
- DON'T use `max-width` media queries in a mobile-first system; they fight the cascade.
- DON'T assume "mobile" means "slow" — optimize for network conditions, not device class.

---

## Content-Driven Breakpoints

### Break Where Content Breaks

Breakpoints should be chosen by observing where the layout becomes uncomfortable, not by matching known device widths. Devices change; content layout patterns are more stable.

The practical test: drag your browser window smaller. The moment the content looks wrong — text becomes too long, an image becomes too narrow, a navigation link wraps — that is your breakpoint.

```css
/* Content-driven: this nav breaks at the point it wraps, not at 768px */
@media (min-width: 52rem) { /* ~832px at 16px base */
  .primary-nav {
    display: flex;
    gap: 1.5rem;
  }
}
```

### Naming Breakpoints Semantically

Avoid naming breakpoints after devices (`iphone`, `ipad`). Name them after layout roles.

```css
/* In a design token file */
:root {
  --bp-compact: 375px;
  --bp-medium: 768px;
  --bp-wide: 1024px;
  --bp-ultrawide: 1440px;
}
```

In Tailwind, extend the theme rather than using arbitrary values to maintain consistency.

```js
// tailwind.config.js
export default {
  theme: {
    screens: {
      sm: '375px',
      md: '768px',
      lg: '1024px',
      xl: '1440px',
    },
  },
};
```

### DO / DON'T

- DO add a breakpoint only when the content demands one.
- DO name breakpoints by their layout role, not by device names.
- DON'T add breakpoints at `320px`, `480px`, `768px`, `1024px` by habit — verify each one is needed.
- DON'T target a specific device's dimensions; target your content's natural limits.

---

## Reference Breakpoint Values

These four values cover the overwhelming majority of real-world layouts. They are starting points, not mandates.

| Name | Width | Typical use |
|------|-------|-------------|
| Mobile | 375px | Single-column, stacked navigation, full-width cards |
| Tablet | 768px | Two-column grid, side-by-side cards, visible sidebar |
| Desktop | 1024px | Three-column grid, persistent sidebar, expanded navigation |
| Wide | 1440px | Max-width container centered with side gutters |

### Max-Width Container Pattern

Prevent layouts from becoming too wide on large screens by constraining the content column.

```css
.container {
  width: 100%;
  max-width: 1440px;
  margin-inline: auto;
  padding-inline: clamp(1rem, 5vw, 4rem);
}
```

```html
<!-- Tailwind equivalent -->
<div class="w-full max-w-screen-xl mx-auto px-4 md:px-8 xl:px-16">
```

### DO / DON'T

- DO set a `max-width` on your primary content container — unconstrained line lengths harm readability.
- DO use `padding-inline` (logical properties) for horizontal rhythm.
- DON'T center content with `margin: 0 auto` without a `max-width` — it has no effect on full-width elements.

---

## Input Modality

### Detecting Touch vs. Mouse

The `pointer` and `hover` media features detect the primary input device's capabilities, not the device class. A tablet with a mouse attached is `pointer: fine`.

```css
/* Expand targets for coarse pointers (touch) */
@media (pointer: coarse) {
  .btn {
    min-height: 44px;
    padding-block: 0.75rem;
  }
}

/* Rich hover effects only for devices that support hover */
@media (hover: hover) and (pointer: fine) {
  .card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-raised);
  }
}
```

In Tailwind, use arbitrary media query variants or custom plugins:

```html
<!-- Show only on hover-capable devices -->
<button class="[@media(hover:hover)]:hover:bg-blue-600">
```

### The `any-pointer` and `any-hover` Features

On hybrid devices (e.g., a Surface with both touch and stylus), `any-pointer: fine` is true even if `pointer: coarse` is the primary input. Use `any-pointer` to check whether any available input can be precise.

```css
/* Provide fine controls if any precision pointing device is available */
@media (any-pointer: fine) {
  .resize-handle { display: block; }
}
```

### DO / DON'T

- DO use `(hover: hover) and (pointer: fine)` together — hover alone matches touch on some platforms.
- DO test on real touch devices; DevTools device emulation does not always replicate touch behavior accurately.
- DON'T add hover effects that reveal critical information — they are inaccessible on touch devices.
- DON'T assume a narrow viewport means a touch device.

---

## Safe Areas

### Notches, Dynamic Island, and Home Indicators

Modern mobile devices cut into the viewport with sensors and virtual home indicators. Content placed at the screen edges without accounting for these insets will be obscured.

```css
/* Opt in to the full screen area first */
html {
  /* Without this, safe area insets are always 0 */
}
/* Must be set on viewport meta: content="viewport-fit=cover" */

.header {
  padding-top: env(safe-area-inset-top);
}

.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}

.sidebar {
  padding-left: env(safe-area-inset-left);
}
```

```html
<!-- Required meta tag in <head> -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### Combining with Existing Padding

Use `calc()` to add safe area insets on top of existing padding rather than replacing it.

```css
.bottom-sheet {
  padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
}
```

In Tailwind, use arbitrary values:

```html
<nav class="pb-[calc(1rem+env(safe-area-inset-bottom))]">
```

### DO / DON'T

- DO set `viewport-fit=cover` in the meta viewport tag to make `env()` values non-zero.
- DO add safe area insets to existing padding with `calc()`, not as replacements.
- DON'T apply safe area insets to every element — apply them only to edge-anchored containers.
- DON'T test only in DevTools — test on a physical device with a notch.

---

## Responsive Images

### `srcset` and `sizes`

The browser chooses the best image source; your job is to describe the candidates and the display size.

```html
<!-- Resolution switching: same image, different sizes -->
<img
  src="photo-800.jpg"
  srcset="
    photo-400.jpg  400w,
    photo-800.jpg  800w,
    photo-1600.jpg 1600w
  "
  sizes="
    (max-width: 767px) 100vw,
    (max-width: 1023px) 50vw,
    33vw
  "
  alt="Description of photo"
  loading="lazy"
  decoding="async"
/>
```

`sizes` tells the browser how wide the image will be rendered before it downloads any CSS. Match it to your actual layout.

### Art Direction with `<picture>`

When the composition must change at different sizes (e.g., a wide landscape crop on desktop, a tight portrait crop on mobile), use `<picture>`.

```html
<picture>
  <source
    media="(min-width: 1024px)"
    srcset="hero-landscape-1600.webp 1600w, hero-landscape-800.webp 800w"
    type="image/webp"
  />
  <source
    media="(min-width: 768px)"
    srcset="hero-square-800.webp"
    type="image/webp"
  />
  <img
    src="hero-portrait-400.jpg"
    srcset="hero-portrait-400.jpg 400w, hero-portrait-800.jpg 800w"
    alt="Hero image"
    loading="eager"
  />
</picture>
```

### Modern Formats

Serve WebP or AVIF with JPEG/PNG fallback. AVIF is ~50% smaller than JPEG at equivalent quality. Use `<picture>` type switching to serve the best format the browser supports.

### DO / DON'T

- DO always write `alt` text on `<img>` — empty string is correct for decorative images.
- DO use `loading="lazy"` for below-the-fold images and `loading="eager"` for above-the-fold.
- DON'T set `sizes="100vw"` for every image — calculate the actual rendered width.
- DON'T use `<picture>` for resolution switching when `srcset` + `sizes` is sufficient.

---

## Fluid Typography

### The `clamp()` Function

`clamp(min, preferred, max)` produces a value that scales smoothly between a minimum and maximum based on the viewport width. This eliminates the need for multiple typography breakpoints.

```css
/* Font size scales from 1rem at 375px to 1.5rem at 1440px */
:root {
  --font-size-body: clamp(1rem, 0.75rem + 0.67vw, 1.5rem);
  --font-size-h1: clamp(1.75rem, 1.25rem + 2.13vw, 3.5rem);
  --font-size-h2: clamp(1.375rem, 1rem + 1.6vw, 2.5rem);
}

body { font-size: var(--font-size-body); }
h1   { font-size: var(--font-size-h1); }
h2   { font-size: var(--font-size-h2); }
```

### Calculating the Preferred Value

The linear interpolation formula for `clamp()`:

```
preferred = minSize + (maxSize - minSize) * (100vw - minVp) / (maxVp - minVp)
```

Simplified as a CSS calc (using unitless vw slope):

```css
/* Scales from 16px at 375px viewport to 20px at 1440px */
font-size: clamp(1rem, calc(0.75rem + 1.07vw), 1.25rem);
```

### Line Length Control

Fluid font sizes work best when paired with a constrained line length (`ch` units are ideal for this).

```css
.prose {
  max-width: 70ch;
  font-size: clamp(1rem, 1.5vw, 1.125rem);
  line-height: 1.6;
}
```

### DO / DON'T

- DO set both a `min` and `max` in every `clamp()` to prevent runaway scaling.
- DO pair fluid type with fluid spacing — use `clamp()` for padding and gaps too.
- DON'T use viewport units alone (`font-size: 2vw`) without min/max constraints.
- DON'T fluid-scale every text element — establish a base scale, then derive headings from it.

---

## Container Queries

### Why Container Queries

Media queries respond to the viewport. Container queries respond to the size of a parent element. This makes components truly reusable: a card in a wide sidebar behaves differently from the same card in a narrow main column without any global media queries.

```css
/* Declare the containment context on the parent */
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

/* Style the card based on its container's width */
.card {
  display: block;
}

@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 1rem;
  }
}
```

### Container Query Units

Container queries introduce new viewport-relative units scoped to the container: `cqi` (1% of container inline size), `cqb` (1% of container block size), `cqw`, `cqh`, `cqmin`, `cqmax`.

```css
@container (min-width: 400px) {
  .card__title {
    font-size: clamp(1rem, 4cqi, 1.5rem);
  }
}
```

### Nesting and Named Containers

Name containers to target specific ancestors when containers are nested.

```css
.layout { container-type: inline-size; container-name: layout; }
.sidebar { container-type: inline-size; container-name: sidebar; }

/* Target layout, not the nearest ancestor */
@container layout (min-width: 1024px) {
  .article { padding-inline: 2rem; }
}
```

### React Integration Pattern

Pair container queries with a wrapper component to keep the containment declaration co-located with the component.

```tsx
export function CardContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="card-container">
      {children}
    </div>
  );
}
```

```css
.card-container {
  container-type: inline-size;
  container-name: card;
}
```

### DO / DON'T

- DO use container queries for component-level responsiveness and media queries for page-level layout.
- DO name containers when nesting container query contexts.
- DON'T use `container-type: size` unless you need to query block size — `inline-size` is sufficient for most layouts and has less layout impact.
- DON'T apply `container-type` directly to elements that participate in flex or grid layout — wrap them in a container element.
- DON'T replace all media queries with container queries; page-level layout (header, sidebar, footer) still belongs in media queries.
