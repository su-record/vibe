---
name: ui-ux-pro-max
tier: standard
description: "UI/UX design intelligence with bold aesthetic direction. Searchable database: 50+ styles, 97 color palettes, 57 font pairings, 99 UX guidelines, 25 chart types across 9 stacks (React, Vue, Svelte, Angular, Astro, Next.js, Flutter, Swift, Kotlin). Use when building any UI component, choosing color schemes, selecting typography, applying design patterns, or reviewing UX compliance. Must use this skill when user builds frontend — pages, components, dashboards, or landing pages — to ensure design quality beyond generic AI output."
---

# UI/UX Pro Max - Design Intelligence

Searchable database: 50+ styles, 97 color palettes, 57 font pairings, 99 UX guidelines, 25 chart types across 9 stacks.

## Pre-check (K1)

> Does this project need custom UI/UX design? If using a pre-built template or admin framework (e.g., Retool, Vercel templates), skip this skill.

## Rule Categories by Priority

| Priority | Category | Impact | Domain |
|----------|----------|--------|--------|
| 1 | Accessibility | CRITICAL | `ux` |
| 2 | Touch & Interaction | CRITICAL | `ux` |
| 3 | Performance | HIGH | `ux` |
| 4 | Layout & Responsive | HIGH | `ux` |
| 5 | Typography & Color | MEDIUM | `typography`, `color` |
| 6 | Animation | MEDIUM | `ux` |
| 7 | Style Selection | MEDIUM | `style`, `product` |
| 8 | Charts & Data | LOW | `chart` |

## Quick Reference

### 1. Accessibility (CRITICAL)

- `color-contrast` - Minimum 4.5:1 ratio for normal text
- `focus-states` - Visible focus rings on interactive elements
- `alt-text` - Descriptive alt text for meaningful images
- `aria-labels` - aria-label for icon-only buttons
- `keyboard-nav` - Tab order matches visual order
- `form-labels` - Use label with for attribute

### 2. Touch & Interaction (CRITICAL)

- `touch-target-size` - Minimum 44x44px touch targets
- `hover-vs-tap` - Use click/tap for primary interactions
- `loading-buttons` - Disable button during async operations
- `error-feedback` - Clear error messages near problem
- `cursor-pointer` - Add cursor-pointer to clickable elements

### 3. Performance (HIGH)

- `image-optimization` - Use WebP, srcset, lazy loading
- `reduced-motion` - Check prefers-reduced-motion
- `content-jumping` - Reserve space for async content

### 4. Layout & Responsive (HIGH)

- `viewport-meta` - width=device-width initial-scale=1
- `readable-font-size` - Minimum 16px body text on mobile
- `horizontal-scroll` - Ensure content fits viewport width
- `z-index-management` - Define z-index scale (10, 20, 30, 50)

### 5. Typography & Color (MEDIUM)

- `line-height` - Use 1.5-1.75 for body text
- `line-length` - Limit to 65-75 characters per line
- `font-pairing` - Match heading/body font personalities

### 6. Animation (MEDIUM)

- `duration-timing` - Use 150-300ms for micro-interactions
- `transform-performance` - Use transform/opacity, not width/height
- `loading-states` - Skeleton screens or spinners

### 7. Style Selection (MEDIUM)

- `style-match` - Match style to product type
- `consistency` - Use same style across all pages
- `no-emoji-icons` - Use SVG icons, not emojis

### 8. Charts & Data (LOW)

- `chart-type` - Match chart type to data type
- `color-guidance` - Use accessible color palettes
- `data-table` - Provide table alternative for accessibility

---

## How to Use

### Step 1: Analyze Requirements

Extract from user request: **product type**, **style keywords**, **industry**, **stack** (default: html-tailwind).

### Step 2: Generate Design System (REQUIRED)

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]
```

This searches 5 domains in parallel (product, style, color, landing, typography), applies reasoning rules, and returns complete design system.

**Persist for cross-session use:**
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```

Creates `design-system/MASTER.md` (global) + optional `design-system/pages/<page>.md` (overrides).

**With page-specific override:**
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Name" --page "dashboard"
```

**Hierarchical retrieval**: Page file overrides Master. No page file → Master exclusively.

### Step 3: Detailed Searches (as needed)

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

Domains: `product`, `style`, `typography`, `color`, `landing`, `chart`, `ux`, `react`, `web`, `prompt`

### Step 4: Stack Guidelines (default: html-tailwind)

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack html-tailwind
```

Stacks: `html-tailwind`, `react`, `nextjs`, `vue`, `svelte`, `swiftui`, `react-native`, `flutter`, `shadcn`, `jetpack-compose`

---

## Common Rules for Professional UI

### Icons & Visual Elements

| Rule | Do | Don't |
|------|----|----- |
| **No emoji icons** | Use SVG icons (Heroicons, Lucide, Simple Icons) | Use emojis as UI icons |
| **Stable hover states** | Use color/opacity transitions on hover | Use scale transforms that shift layout |
| **Correct brand logos** | Research official SVG from Simple Icons | Guess or use incorrect logo paths |
| **Consistent icon sizing** | Fixed viewBox (24x24) with w-6 h-6 | Mix different icon sizes |

### Interaction & Cursor

| Rule | Do | Don't |
|------|----|----- |
| **Cursor pointer** | `cursor-pointer` on all clickable elements | Default cursor on interactive elements |
| **Hover feedback** | Visual feedback (color, shadow, border) | No indication element is interactive |
| **Smooth transitions** | `transition-colors duration-200` | Instant changes or >500ms |

### Light/Dark Mode Contrast

| Rule | Do | Don't |
|------|----|----- |
| **Glass card light mode** | `bg-white/80` or higher opacity | `bg-white/10` (too transparent) |
| **Text contrast light** | `#0F172A` (slate-900) for text | `#94A3B8` (slate-400) for body |
| **Muted text light** | `#475569` (slate-600) minimum | gray-400 or lighter |
| **Border visibility** | `border-gray-200` in light mode | `border-white/10` (invisible) |

### Layout & Spacing

| Rule | Do | Don't |
|------|----|----- |
| **Floating navbar** | `top-4 left-4 right-4` spacing | Stick to `top-0 left-0 right-0` |
| **Content padding** | Account for fixed navbar height | Content hidden behind fixed elements |
| **Consistent max-width** | Same `max-w-6xl` or `max-w-7xl` | Mix different container widths |

---

## Pre-Delivery Checklist

### Visual Quality
- [ ] No emojis used as icons (SVG instead)
- [ ] All icons from consistent set (Heroicons/Lucide)
- [ ] Brand logos verified (Simple Icons)
- [ ] Hover states don't cause layout shift

### Interaction
- [ ] All clickable elements have `cursor-pointer`
- [ ] Hover states provide clear visual feedback
- [ ] Transitions are smooth (150-300ms)
- [ ] Focus states visible for keyboard navigation

### Light/Dark Mode
- [ ] Light mode text has sufficient contrast (4.5:1)
- [ ] Glass/transparent elements visible in light mode
- [ ] Borders visible in both modes
- [ ] Both modes tested before delivery

### Layout
- [ ] Floating elements have proper edge spacing
- [ ] No content hidden behind fixed navbars
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile

### Accessibility
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Color is not the only indicator
- [ ] `prefers-reduced-motion` respected

## Design Direction Anti-Patterns

Avoid these signs of generic, AI-generated UI:

| Anti-Pattern | Fix |
|---|---|
| Default Bootstrap/Tailwind without customization | Define design tokens first (colors, typography, spacing, motion) |
| Overused fonts (Inter, Roboto) without styling | Choose distinctive typefaces that set the tone |
| Predictable card-based layouts everywhere | Use asymmetry and unconventional layouts when appropriate |
| Stock photography without curation | Custom icons and illustrations |
| Safe, corporate color palettes | Develop unique color palettes beyond defaults |
| No micro-interactions | Add meaningful motion to guide user attention (150-300ms) |

## Deep Reference Guides

For detailed guidance on specific domains, see the reference files:

| Reference | Domain | Use When |
|-----------|--------|----------|
| [typography](reference/typography.md) | Type systems, font pairing, scales | Setting up type hierarchy |
| [color-and-contrast](reference/color-and-contrast.md) | OKLCH, tinted neutrals, dark mode | Choosing colors, dark mode |
| [spatial-design](reference/spatial-design.md) | Spacing systems, grids, hierarchy | Layout and spacing decisions |
| [motion-design](reference/motion-design.md) | Easing, staggering, reduced motion | Adding animations |
| [interaction-design](reference/interaction-design.md) | States, focus, forms, modals | Building interactive elements |
| [responsive-design](reference/responsive-design.md) | Mobile-first, fluid, containers | Responsive implementation |
| [ux-writing](reference/ux-writing.md) | Labels, errors, empty states | Writing UI copy |

## Done Criteria (K4)

- [ ] Design system generated before implementation
- [ ] All pre-delivery checklist items verified
- [ ] Both light and dark modes tested
- [ ] Responsive at all breakpoints
- [ ] No default/uncustomized framework styles remain
- [ ] All interactive states designed (hover, focus, active, disabled)
