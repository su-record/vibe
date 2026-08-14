# Color & Contrast — Deep Reference Guide

A systematic reference for building accessible, perceptually consistent color systems in web UI. Covers the modern OKLCH color space, token architecture, dark mode strategy, and WCAG compliance patterns.

---

## OKLCH Color Space

### Why OKLCH Over HSL or HEX

The legacy HSL color space is perceptually non-uniform: a yellow at `hsl(60, 100%, 50%)` and a blue at `hsl(240, 100%, 50%)` have the same nominal lightness value, but the yellow reads dramatically brighter to the human eye. This creates real problems when you want consistent contrast across a palette.

OKLCH solves this. It maps color to how the human visual system actually perceives brightness, chroma, and hue. Two colors with the same `L` value in OKLCH will appear equally bright to a viewer, regardless of their hue. This makes predictable contrast possible without manual adjustments per hue.

### Syntax

```css
/* oklch(Lightness Chroma Hue) */
color: oklch(0.62 0.19 145);

/* With alpha */
color: oklch(0.62 0.19 145 / 0.8);
```

- **L** — Lightness, range `0` (black) to `1` (white)
- **C** — Chroma (saturation intensity), roughly `0` to `0.37` in displayable sRGB
- **H** — Hue angle in degrees, `0–360`

### Browser Support

OKLCH is supported in all modern browsers (Chrome 111+, Safari 15.4+, Firefox 113+). For older targets, provide an `@supports` fallback:

```css
:root {
  --color-primary: #2563eb; /* fallback */
}

@supports (color: oklch(0 0 0)) {
  :root {
    --color-primary: oklch(0.55 0.22 264);
  }
}
```

### Perceptual Uniformity in Practice

When generating a 9-step scale (see Palette Generation), OKLCH lets you space lightness values linearly and get visually even steps. With HSL you would need to hand-tune each step because yellow and purple consume lightness differently.

```ts
// Generate a 9-step lightness scale for a given hue/chroma
function generateScale(hue: number, chroma: number): string[] {
  const steps = [0.95, 0.88, 0.78, 0.66, 0.55, 0.44, 0.33, 0.22, 0.12];
  return steps.map((l) => `oklch(${l} ${chroma} ${hue})`);
}
```

---

## Tinted Neutrals

### The Problem with Pure Gray

Pure gray (`oklch(L 0 0)`) is chromatic dead weight. It has no relationship to your brand and often reads as clinical or cold, especially in large neutral areas like backgrounds, sidebars, and cards.

Tinted neutrals solve this by adding a tiny amount of chroma — just enough to feel cohesive with the brand, invisible to untrained eyes, but felt as warmth or coolness throughout the UI.

### How to Create Tinted Neutrals

Start from your primary brand hue. Drop the chroma to `0.01–0.04` (barely perceptible). Use the same hue angle as your primary color.

```css
:root {
  /* Brand primary: oklch(0.55 0.22 264) — blue-violet */
  /* Neutral scale with matching hue, near-zero chroma */
  --neutral-50:  oklch(0.97 0.01 264);
  --neutral-100: oklch(0.93 0.01 264);
  --neutral-200: oklch(0.86 0.02 264);
  --neutral-300: oklch(0.76 0.02 264);
  --neutral-400: oklch(0.62 0.02 264);
  --neutral-500: oklch(0.50 0.02 264);
  --neutral-600: oklch(0.40 0.02 264);
  --neutral-700: oklch(0.30 0.02 264);
  --neutral-800: oklch(0.20 0.02 264);
  --neutral-900: oklch(0.12 0.01 264);
}
```

### DO / DON'T — Tinted Neutrals

**DO** use the same hue angle as your primary for harmonious tinting.

**DON'T** use a complementary hue for neutrals — it creates subtle visual tension and makes the palette look unintentional.

**DO** keep chroma below `0.04` for backgrounds and surfaces. Higher values stop reading as neutrals.

**DON'T** use `oklch(L 0 0)` for any neutral in a branded UI — it feels detached and clinical.

### Tailwind Configuration

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      colors: {
        neutral: {
          50:  "oklch(0.97 0.01 264)",
          100: "oklch(0.93 0.01 264)",
          // ...
          900: "oklch(0.12 0.01 264)",
        },
      },
    },
  },
} satisfies Config;
```

---

## 60-30-10 Rule

### The Principle

The 60-30-10 rule is a composition framework borrowed from interior design and applied to UI color allocation:

- **60% — Dominant**: Backgrounds, surfaces, large containers. Usually neutrals.
- **30% — Secondary**: Text, borders, cards, secondary surfaces. Mid-range neutrals or a secondary brand color.
- **10% — Accent**: CTAs, active states, highlights, key icons. Your primary brand color.

This ratio creates visual hierarchy naturally. The accent color has impact precisely because it is rare.

### Applied to a React Layout

```tsx
// Tailwind + React example
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    // 60% — dominant neutral background
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* 30% — secondary surface */}
      <nav className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="text-neutral-900 dark:text-neutral-100 font-semibold">
            Brand
          </span>
          {/* 10% — accent CTA */}
          <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-1.5 rounded-md text-sm font-medium">
            Get Started
          </button>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
```

### DO / DON'T — 60-30-10

**DO** use the accent color only for the single most important interactive element per view. One primary CTA per screen is the ideal application of that 10%.

**DON'T** use your accent color for decorative elements, illustrations, or informational icons. It trains users to ignore it.

**DO** let the 30% tier handle text. Mid-neutral text on a neutral background is readable and calm.

**DON'T** fill large surfaces (60% territory) with a saturated color. This exhausts the eye and leaves nowhere for emphasis to land.

---

## Dark Mode

### Not an Inversion

The most common dark mode mistake is inverting the light palette. Inversion produces washed-out, oversaturated text and poor contrast because the perceptual math doesn't hold in reverse.

Dark mode requires a separate token set that is designed for dark surfaces, not derived from light surfaces.

### Surface Elevation with Lighter Shades

In dark mode, elevation is conveyed through progressively lighter surface colors, not shadows. This mirrors how light scatters in physical space.

```css
[data-theme="dark"] {
  /* Base surface — darkest */
  --surface-base:    oklch(0.12 0.01 264);

  /* Elevation 1 — cards, panels */
  --surface-raised:  oklch(0.16 0.01 264);

  /* Elevation 2 — modals, popovers */
  --surface-overlay: oklch(0.20 0.01 264);

  /* Elevation 3 — tooltips, dropdowns */
  --surface-float:   oklch(0.24 0.01 264);

  /* Text */
  --text-primary:    oklch(0.93 0.01 264);
  --text-secondary:  oklch(0.68 0.02 264);
  --text-disabled:   oklch(0.45 0.01 264);

  /* Accent — slightly desaturated for dark context */
  --color-primary:   oklch(0.65 0.18 264);
}
```

### Token-Based Dark Mode in React + Tailwind

```tsx
// Use CSS custom properties via Tailwind's `[var()]` escape hatch
// or configure Tailwind with semantic token names

// tailwind.config.ts (semantic tokens)
export default {
  theme: {
    extend: {
      colors: {
        surface: {
          base:    "var(--surface-base)",
          raised:  "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
        },
        text: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
        },
      },
    },
  },
};

// Component usage — zero dark: variants needed
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-raised rounded-xl p-6 text-text-primary">
      {children}
    </div>
  );
}
```

### DO / DON'T — Dark Mode

**DO** define a separate token layer for dark mode. Map the same semantic names (`--text-primary`, `--surface-base`) to different raw values.

**DON'T** rely on Tailwind's `dark:` utility for every color declaration. It creates a proliferation of `dark:` variants that are hard to audit. Use CSS custom properties with a `[data-theme]` attribute instead.

---

## Accessibility — WCAG 2.1 AA

### Contrast Ratios

WCAG 2.1 Level AA defines two thresholds:

| Target | Minimum Ratio |
|---|---|
| Normal text (< 18pt / < 14pt bold) | 4.5:1 |
| Large text (≥ 18pt / ≥ 14pt bold) | 3:1 |
| UI components (borders, icons, controls) | 3:1 |
| Decorative elements, disabled states | No requirement |

### Checking Contrast in OKLCH

OKLCH's lightness channel gives a rough guide, but actual contrast must be computed against WCAG's relative luminance formula. Use a tool like `culori` in your design token pipeline:

```ts
import { wcagContrast, oklch, formatHex } from "culori";

function assertContrast(
  fg: string,
  bg: string,
  threshold: 4.5 | 3
): void {
  const ratio = wcagContrast(fg, bg);
  if (ratio < threshold) {
    throw new Error(
      `Contrast ${ratio.toFixed(2)}:1 fails WCAG AA (${threshold}:1) — ${fg} on ${bg}`
    );
  }
}

// Run in CI or during token generation
assertContrast("oklch(0.93 0.01 264)", "oklch(0.12 0.01 264)", 4.5);
```

### Designing for Contrast at Token Definition Time

Rather than checking contrast after the fact, build contrast in during palette generation. Steps 700–900 pass AA on white backgrounds; steps 50–300 pass AA on dark backgrounds. The mid-range (400–600) is unreliable — use with caution and always verify.

```css
/* Reliable pairings for AA compliance */
.text-on-light  { color: var(--primary-700); } /* ~7:1 on white */
.text-on-dark   { color: var(--primary-200); } /* ~8:1 on --neutral-900 */
.badge-accent   { color: var(--primary-800); background: var(--primary-100); }
```

### Non-Text Contrast (UI Components)

Focus rings, form borders, icon buttons, and toggle tracks must meet 3:1 against adjacent backgrounds. This is commonly missed.

```tsx
// Accessible focus ring — visible on both light and dark
function FocusableButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      className={[
        "px-4 py-2 rounded-md font-medium",
        "bg-primary-600 text-white",
        // Focus ring: 3px offset with neutral contrast to surface
        "focus-visible:outline focus-visible:outline-2",
        "focus-visible:outline-offset-2 focus-visible:outline-primary-500",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
```

---

## Palette Generation

### 9-Step Lightness Scale

A well-formed palette for any hue uses 9 steps (50–900 in Tailwind convention, or 1–9 in index convention). The scale follows a non-linear lightness curve to account for perceptual compression at the extremes.

```ts
// Recommended OKLCH lightness values per step
const LIGHTNESS_SCALE: Record<string, number> = {
  "50":  0.97,
  "100": 0.93,
  "200": 0.85,
  "300": 0.74,
  "400": 0.62,
  "500": 0.52,
  "600": 0.44,
  "700": 0.36,
  "800": 0.26,
  "900": 0.16,
};

function buildPalette(
  hue: number,
  chroma: number
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(LIGHTNESS_SCALE).map(([step, l]) => [
      step,
      `oklch(${l} ${chroma} ${hue})`,
    ])
  );
}

const blue = buildPalette(264, 0.20);
// { "50": "oklch(0.97 0.20 264)", "100": "oklch(0.93 0.20 264)", ... }
```

### Semantic Colors

Semantic colors communicate meaning independent of brand. They should be generated from dedicated hues, not borrowed from the brand palette:

| Semantic Role | Recommended Hue (OKLCH) | Rationale |
|---|---|---|
| Success | `145` (green) | Universal positive association |
| Error | `25` (red-orange) | High visibility, culturally universal |
| Warning | `85` (amber) | Distinct from success, readable |
| Info | `230` (cyan-blue) | Neutral, informational |

```css
:root {
  /* Success */
  --success-50:  oklch(0.97 0.05 145);
  --success-500: oklch(0.52 0.18 145);
  --success-700: oklch(0.36 0.16 145);

  /* Error */
  --error-50:  oklch(0.97 0.05 25);
  --error-500: oklch(0.52 0.21 25);
  --error-700: oklch(0.36 0.19 25);

  /* Warning */
  --warning-50:  oklch(0.97 0.06 85);
  --warning-500: oklch(0.72 0.17 85);
  --warning-700: oklch(0.50 0.14 85);

  /* Info */
  --info-50:  oklch(0.97 0.04 230);
  --info-500: oklch(0.55 0.17 230);
  --info-700: oklch(0.38 0.15 230);
}
```

### Chroma Guidance by Use Case

- **Brand accent**: `0.18–0.25` — vivid, intentional
- **Semantic colors**: `0.14–0.22` — communicative but not alarming
- **Tinted neutrals**: `0.01–0.04` — imperceptible tinting
- **Disabled states**: `0.01–0.02` — visually receded

---

## Color Tokens

### The Token Hierarchy

A robust token system has three layers:

1. **Primitive tokens** — Raw palette values. Named by position, not role.
2. **Semantic tokens** — Role-based references to primitives. Context-aware.
3. **Component tokens** — Component-specific overrides of semantic tokens. Optional.

```css
/* Layer 1: Primitives */
:root {
  --primitive-blue-500: oklch(0.52 0.20 264);
  --primitive-blue-700: oklch(0.36 0.19 264);
  --primitive-neutral-50: oklch(0.97 0.01 264);
  --primitive-neutral-900: oklch(0.12 0.01 264);
}

/* Layer 2: Semantic tokens (light mode default) */
:root {
  --color-primary:        var(--primitive-blue-600);
  --color-primary-hover:  var(--primitive-blue-700);
  --surface-page:         var(--primitive-neutral-50);
  --text-body:            var(--primitive-neutral-900);
  --text-muted:           var(--primitive-neutral-500);
  --border-default:       var(--primitive-neutral-200);
}

/* Layer 2: Semantic tokens (dark mode) */
[data-theme="dark"] {
  --color-primary:       var(--primitive-blue-400);
  --color-primary-hover: var(--primitive-blue-300);
  --surface-page:        var(--primitive-neutral-950);
  --text-body:           var(--primitive-neutral-50);
  --text-muted:          var(--primitive-neutral-400);
  --border-default:      var(--primitive-neutral-800);
}
```

### Systematic Naming Convention

Use a `[category]-[variant]-[state]` structure:

```
--color-primary          → base primary
--color-primary-hover    → interactive state
--color-primary-active   → pressed state
--color-primary-disabled → disabled state
--surface-page           → page background
--surface-raised         → card/panel
--text-body              → default body text
--text-heading           → heading text
--text-muted             → secondary/helper text
--border-default         → standard border
--border-focus           → focus ring
```

### Wiring Tokens into Tailwind

```ts
// tailwind.config.ts — wire semantic tokens to Tailwind utilities
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          hover:   "var(--color-primary-hover)",
        },
        surface: {
          page:   "var(--surface-page)",
          raised: "var(--surface-raised)",
        },
        text: {
          body:    "var(--text-body)",
          muted:   "var(--text-muted)",
          heading: "var(--text-heading)",
        },
        border: {
          DEFAULT: "var(--border-default)",
          focus:   "var(--border-focus)",
        },
      },
    },
  },
};
```

This setup means components never reference primitive tokens directly. A design decision like "make the brand warmer" changes one variable in the primitive layer and propagates everywhere.

### DO / DON'T — Color Tokens

**DO** reference semantic tokens in components, never primitives. `bg-surface-raised` is correct; `bg-neutral-100` in a component is a smell.

**DON'T** create tokens for every one-off use. If a color is used fewer than three times, it doesn't need a token — use an inline value or compose from existing tokens.

**DO** version your token file if it is shared across multiple projects or exported as a package. Breaking token renames are a semver concern.

---

## Quick Reference Checklist

Before shipping any new UI surface, verify:

- [ ] All text passes WCAG AA contrast (4.5:1 normal, 3:1 large)
- [ ] All interactive UI elements (borders, icons) pass 3:1 non-text contrast
- [ ] Focus rings are visible on both light and dark backgrounds
- [ ] Dark mode uses a separate token set, not CSS filter inversion
- [ ] Accent color accounts for no more than ~10% of visible surface area
- [ ] Semantic color tokens are used in components (not primitives)
- [ ] Color palette was generated in OKLCH for perceptual uniformity
- [ ] Tinted neutrals share hue angle with primary brand color
