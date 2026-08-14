# Typography Systems for Web UI

A deep reference for building consistent, accessible, and visually compelling typography in production web interfaces.

---

## Modular Scale

A modular scale establishes a mathematical relationship between type sizes, making every heading and body size feel intentional rather than arbitrary. The scale is driven by a **base size** (typically 16px) and a **ratio** that multiplies or divides to produce each step.

Common ratios:
- **1.25** (Major Third) — subtle, compact; good for dense UIs and dashboards
- **1.333** (Perfect Fourth) — balanced; versatile across marketing and application UIs
- **1.414** (Augmented Fourth / √2) — noticeable contrast; suits editorial layouts
- **1.5** (Perfect Fifth) — dramatic; use for landing pages, not data-heavy apps

**Limit yourself to five sizes or fewer.** Each size must serve a clear semantic role:

| Token       | Role              | 1.25 ratio | 1.333 ratio |
|-------------|-------------------|------------|-------------|
| `display`   | Hero headlines    | ~39px      | ~48px       |
| `h1`        | Page title        | ~31px      | ~36px       |
| `h2`        | Section heading   | ~25px      | ~27px       |
| `body`      | Reading text      | 16px       | 16px        |
| `small`     | Captions, labels  | ~13px      | ~12px       |

**Tailwind CSS approach** using CSS custom properties:

```css
/* globals.css */
:root {
  --text-display: clamp(2rem, 5vw, 2.441rem);
  --text-h1:      clamp(1.75rem, 4vw, 1.953rem);
  --text-h2:      clamp(1.375rem, 3vw, 1.563rem);
  --text-body:    1rem;
  --text-small:   0.8rem;
}
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontSize: {
        display: 'var(--text-display)',
        h1:      'var(--text-h1)',
        h2:      'var(--text-h2)',
        body:    'var(--text-body)',
        small:   'var(--text-small)',
      },
    },
  },
}
```

**DO:** Pick one ratio and apply it globally. Consistency builds visual rhythm.

**DON'T:** Mix ratios or hand-pick arbitrary pixel values (e.g., 14, 17, 22, 28, 38). This creates visual noise that readers feel even when they cannot name it.

---

## Line Height

Line height (leading) controls the breathing room between lines of text. Too tight and lines collide; too loose and the text reads as disconnected fragments.

**Recommended values:**

| Context         | Line Height Range | Reasoning                                          |
|-----------------|-------------------|----------------------------------------------------|
| Body text       | 1.5 – 1.75        | Sustained reading needs air; 1.6 is a safe default |
| Headings        | 1.1 – 1.3         | Short lines at large sizes; tighter leading feels intentional |
| Captions/labels | 1.3 – 1.5         | Short, single-line; slightly relaxed helps scanning |

The reason headings use tighter leading: at large sizes the optical gap between lines grows significantly. A display heading at 40px with `line-height: 1.5` produces 20px of space — far too much for two or three words.

**React + Tailwind implementation:**

```tsx
// Typography.tsx
const styles = {
  display: 'text-display leading-[1.1] font-bold',
  h1:      'text-h1 leading-[1.2] font-semibold',
  h2:      'text-h2 leading-[1.3] font-semibold',
  body:    'text-body leading-relaxed',   // Tailwind: 1.625
  small:   'text-small leading-snug',     // Tailwind: 1.375
} as const

type TypographyVariant = keyof typeof styles

interface Props {
  as?: React.ElementType
  variant: TypographyVariant
  children: React.ReactNode
  className?: string
}

export function Text({ as: Tag = 'p', variant, children, className }: Props): React.ReactElement {
  return <Tag className={`${styles[variant]} ${className ?? ''}`}>{children}</Tag>
}
```

**DO:** Set heading line height in unitless values (e.g., `1.2`) so it scales proportionally with font size.

**DON'T:** Use fixed pixel line heights (e.g., `line-height: 24px`) on headings — they break when font size changes.

---

## Line Length

The measure (line length) is the single most impactful readability setting that developers routinely ignore. The optimal range for sustained reading is **45 to 75 characters**, with **65ch** as the recommended default.

Why this range? The eye must travel back to find the next line. Too short (under 45ch) causes excessive eye movement; too long (over 90ch) makes it easy to lose the current line.

**Framework-agnostic CSS:**

```css
.prose {
  max-width: 65ch;
}
```

**Important:** `ch` is the width of the "0" character in the current font. At 16px in most system fonts this approximates 8–9px per character, making `65ch` roughly 520–585px — which aligns with most article layouts.

**Tailwind utility:**

```tsx
<article className="max-w-prose mx-auto px-4">
  {/* Tailwind's max-w-prose = 65ch */}
  <p className="text-body leading-relaxed">{content}</p>
</article>
```

Tailwind's built-in `max-w-prose` is exactly `65ch`. Use it for all long-form text containers.

**Special cases:**
- **Navigation and UI labels:** No line-length constraint; they are not reading contexts.
- **Captions under images:** Allow the caption to match the image width, which may exceed 65ch. This is intentional — captions are scanned, not read.
- **Data tables:** Disable max-width on table cells; column widths are data-driven.

**DO:** Apply `max-width: 65ch` to every article, blog post, and form description paragraph.

**DON'T:** Constrain the entire page layout to 65ch — constrain only the text container within it.

---

## Font Pairing

Pairing two typefaces creates typographic contrast that signals hierarchy without relying on size alone. The guiding principle is **contrast through difference, harmony through relationship**.

**Contrast principle:** Pair a serif with a sans-serif. Their structural difference is immediately legible, signaling "this is a heading" versus "this is body text" even before the reader processes the size difference.

**X-height matching:** When two typefaces share a similar x-height (the height of lowercase letters relative to the cap height), they feel proportionally balanced when placed side by side. Mismatched x-heights make one font look shrunken next to the other even at identical `font-size`.

**Reliable pairing patterns:**

| Heading (serif)         | Body (sans-serif)       | Character                        |
|-------------------------|-------------------------|----------------------------------|
| Playfair Display        | Source Sans Pro         | Editorial, editorial-minimal     |
| Merriweather            | Inter                   | Legible, neutral, very readable  |
| Georgia (system)        | -apple-system stack     | Zero-load, high compatibility    |

**Inverse approach — sans heading + body serif:**

| Heading (sans-serif)    | Body (serif)            | Character                        |
|-------------------------|-------------------------|----------------------------------|
| Inter                   | Georgia                 | Modern with warmth               |
| DM Sans                 | Lora                    | Friendly + literary              |

**Tailwind implementation:**

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500&display=swap');

:root {
  --font-heading: 'Playfair Display', Georgia, serif;
  --font-body:    'Inter', system-ui, -apple-system, sans-serif;
}
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        heading: 'var(--font-heading)',
        body:    'var(--font-body)',
      },
    },
  },
}
```

**DO:** Test the pairing at actual content — not just "Aa". Real words reveal whether x-heights are compatible.

**DON'T:** Pair two decorative or expressive typefaces. One of the pair must be neutral.

---

## Font Loading

How fonts load directly affects Cumulative Layout Shift (CLS) and First Contentful Paint (FCP). Poor loading causes text to flash invisible or reflow the layout.

**WOFF2 first:** WOFF2 provides 30% better compression than WOFF and is supported by all modern browsers. Always list WOFF2 as the first format source.

```css
@font-face {
  font-family: 'Inter';
  src:
    url('/fonts/inter-v13-latin-regular.woff2') format('woff2'),
    url('/fonts/inter-v13-latin-regular.woff')  format('woff');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

**`font-display: swap`:** Immediately renders fallback text using the system font, then swaps to the web font once it loads. This eliminates the invisible text flash (FOIT) at the cost of a brief layout shift (FOTS). For most interfaces, this trade-off favors readability.

`font-display` options:
- `swap` — show fallback immediately, swap when ready (recommended for body text)
- `optional` — browser may not load if connection is slow (good for decorative fonts)
- `block` — brief invisible period (avoid; harms perceived performance)

**Subsetting:** Google Fonts and custom font files include glyphs for dozens of languages you may not need. Use `unicode-range` or a subsetting tool (e.g., `pyftsubset`, Fonttools) to ship only the characters your UI uses.

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin.woff2') format('woff2');
  unicode-range: U+0020-007F, U+00A0-00FF; /* Basic Latin + Latin-1 */
  font-display: swap;
}
```

**Preloading critical fonts:**

```html
<link
  rel="preload"
  href="/fonts/inter-latin.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
```

Preload only 1–2 fonts (the ones used above the fold). Preloading everything defeats the purpose.

**Next.js / React approach using `next/font`:**

```tsx
// app/layout.tsx
import { Inter, Playfair_Display } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['700'],
})

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

**DO:** Self-host fonts or use `next/font` (which inlines critical CSS and serves from the same origin). Both eliminate cross-origin DNS lookup latency.

**DON'T:** Load four weights of a font when you use two. Each weight is a separate network request.

---

## OpenType Features

OpenType features are typographic refinements baked into font files but disabled by default. Enabling them selectively improves quality without adding weight.

**CSS property:** `font-feature-settings`

Syntax uses four-letter feature tags as strings:

```css
.prose {
  font-feature-settings:
    "kern" 1,   /* Kerning — always enable */
    "liga" 1,   /* Standard ligatures (fi, fl, ff) */
    "calt" 1;   /* Contextual alternates */
}
```

**Key features for UI work:**

| Feature tag | Name                  | Use case                                         |
|-------------|----------------------|--------------------------------------------------|
| `kern`      | Kerning               | Always on; adjusts letter spacing between pairs  |
| `liga`      | Standard ligatures    | Body text; replaces fi, fl, ff with single glyphs|
| `tnum`      | Tabular numbers       | Data tables, pricing, financial figures           |
| `onum`      | Oldstyle numbers      | Body text; numbers that sit within lowercase flow|
| `lnum`      | Lining numbers        | Headings; all-caps contexts                      |
| `frac`      | Fractions             | Recipe text, measurements                        |
| `smcp`      | Small caps            | Acronyms in body text (CIA, NASA)                |

**Tabular numbers are critical for tables:**

```tsx
// PriceCell.tsx
interface PriceCellProps {
  amount: number
  currency?: string
}

export function PriceCell({ amount, currency = 'USD' }: PriceCellProps): React.ReactElement {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)

  return (
    <td
      className="text-right tabular-nums font-mono"
      style={{ fontFeatureSettings: '"tnum" 1, "lnum" 1' }}
    >
      {formatted}
    </td>
  )
}
```

Tailwind includes `tabular-nums` as a utility class (`font-variant-numeric: tabular-nums`), which is preferable to raw `font-feature-settings` when available.

**DO:** Enable `tnum` on every number column in tables and dashboards. Proportional numbers in columns produce ragged alignment that erodes trust in data.

**DON'T:** Enable `liga` on user-generated content or code blocks — ligatures can change the apparent character sequence.

---

## Accessibility

Typography accessibility is not an afterthought — it is a precondition. WCAG 2.1 AA defines minimum standards that protect users with low vision, cognitive differences, and situational impairments (bright sunlight, small screens).

**Minimum body font size: 16px (1rem)**

The browser default is 16px. Never override it downward with `html { font-size: 14px }` or similar. Many users set their browser base size larger for accessibility reasons — overriding it with a fixed pixel value breaks that accommodation.

```css
/* Correct: relative scaling respects user preferences */
html {
  font-size: 100%; /* = user's browser setting, typically 16px */
}

body {
  font-size: 1rem; /* scales with html */
}

/* Wrong: locks out users who have set a larger base */
html {
  font-size: 14px;
}
```

**Use `rem` for font sizes, `em` for component-local spacing:**

```css
/* rem: relative to root — good for font sizes, global spacing */
h1 { font-size: 1.953rem; }

/* em: relative to current font size — good for padding around text */
button { padding: 0.5em 1em; }
```

**200% zoom support (WCAG 1.4.4 — Resize Text, Level AA):**

Content must be readable and functional when the browser is zoomed to 200%. This requirement fails when:
- Fixed-width containers clip text
- Absolute-positioned overlays cover content
- `overflow: hidden` truncates zoomed text

Test by pressing `Cmd+` (Mac) or `Ctrl+` (Windows) five times and verifying no content is cut off.

**Color contrast for text (WCAG 1.4.3 — Level AA):**

| Text size           | Minimum contrast ratio |
|--------------------|------------------------|
| Normal text (<18pt) | 4.5:1                  |
| Large text (≥18pt, or ≥14pt bold) | 3:1      |

Common failure: light gray text on white for placeholder, caption, or disabled states.

```tsx
// Accessible caption: contrast ≥ 4.5:1 against white background
// text-gray-500 (#6B7280) on white = 4.61:1 — passes AA
// text-gray-400 (#9CA3AF) on white = 2.85:1 — fails AA

<figcaption className="text-sm text-gray-500 mt-2">
  Figure 1: Monthly active users by region
</figcaption>
```

**Focus visibility for text links:** Links must have a visible focus indicator that does not rely on color alone. Do not remove `outline` without providing an equivalent visual replacement.

**Letter spacing and `not-italic`:** Users with dyslexia benefit from increased letter spacing. Avoid reducing letter spacing below the font's default. The `prefers-reduced-motion` media query is unrelated to typography but lives in the same accessibility layer — be aware of it when using animated text effects.

**Tailwind accessibility checklist for text:**

```tsx
// Accessible article layout
<article className="
  max-w-prose          /* 65ch line length */
  mx-auto
  px-4
  text-base            /* 1rem = 16px */
  leading-relaxed      /* 1.625 line height */
  text-gray-900        /* high contrast on white */
">
  <h1 className="text-h1 leading-tight font-bold text-gray-950 mb-4">
    {title}
  </h1>
  <p className="mb-4">{body}</p>
  <small className="text-sm text-gray-500">{caption}</small>
</article>
```

**DO:** Test your type scale with real browser zoom (200%), a screen reader, and a contrast checker on every text color in your design system.

**DON'T:** Use `font-size` in `px` for body text. It severs the connection to the user's preferred base size and is a WCAG failure under 1.4.4.

---

## Quick Reference

| Setting         | Recommended Value     | WCAG Relevance         |
|-----------------|-----------------------|------------------------|
| Body font size  | ≥ 1rem (≥ 16px)       | 1.4.4 Resize Text      |
| Body line height| 1.5 – 1.75            | Readability (AAA: 1.5) |
| Heading leading | 1.1 – 1.3             | —                      |
| Line length     | 45–75ch, default 65ch | Readability (AAA: 80ch max) |
| Scale sizes     | ≤ 5 steps             | —                      |
| Font units      | `rem` for size        | 1.4.4 Resize Text      |
| Normal text contrast | ≥ 4.5:1          | 1.4.3 Contrast (AA)    |
| Large text contrast  | ≥ 3:1            | 1.4.3 Contrast (AA)    |
| Font format     | WOFF2 first           | Performance            |
| Font display    | `swap`                | Performance / CLS      |
