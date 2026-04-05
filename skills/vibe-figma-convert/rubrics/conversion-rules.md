# React+Tailwind → Project Stack Conversion Rules

## Mode Selection (Do This First)

Classify each section before writing any code. Literal mode if ANY of:
- 15+ asset URLs in the section
- Fractional coordinates (`left-[117.13px]`)
- `mix-blend-*` on any layer
- `rotate-[Ndeg]` or `-scale-y-100`
- `mask-image` usage
- `blur-[Npx]` filter
- BG cropped from 2560px+ source

Normal mode only when ALL of:
- Flex/grid layout, no absolute coordinates (or integer-only)
- Fewer than 10 asset URLs
- No blend/rotate/mask/blur

## Normal Mode Rules

- Extract CSS values from Tailwind classes — never estimate
- Apply `scaleFactor` to all `px` values; never to colors, opacity, z-index, line-height (unitless)
- Put layout properties in `layout/_section.scss`, visual/text properties in `components/_section.scss`
- No `<style>` block in the component file
- No inline `style=""` attribute in the template

## Literal Mode Rules

- Preserve the full HTML nesting structure 1:1
- Keep all absolute coordinates, fractional px values (rounded after scaling)
- Keep all `mix-blend-mode`, `rotate`, `mask-image`, `blur` values unchanged
- Put all styles in `<style scoped>` inside the component
- Do not create external SCSS files for literal sections

## Tailwind Class Gotchas

| Tailwind | Correct CSS | Common Mistake |
|----------|------------|----------------|
| `size-full` | `width: 100%; height: 100%` | Only setting `width: 100%` |
| `inset-0` | `inset: 0` (shorthand) | Expanding to 4 properties |
| `inset-[-18.13%]` | `inset: -18.13%` | Scaling the % value |
| `overflow-clip` | `overflow: clip` | Using `overflow: hidden` |
| `leading-[1.4]` | `line-height: 1.4` | Applying scaleFactor |
| `max-w-none` | `max-width: none` | Omitting entirely |
| `object-cover` on `<img>` | `object-fit: cover` + parent `overflow: hidden` | Forgetting parent clip |
| `pointer-events-none` | `pointer-events: none` | Omitting for decorative layers |
| `text-white` | `color: #FFFFFF` | Using `color: white` |
| `font-black` | `font-weight: 900` | Using `font-weight: bold` |

## Scale Application

Apply `× scaleFactor` to:
- `px` sizes: font-size, padding, margin, gap, border-radius, width, height, top, left, bottom, right
- `px` in box-shadow, blur filter, letter-spacing

Do NOT scale:
- Color values
- Opacity values
- `%` values
- Unitless line-height
- z-index
- `mix-blend-mode` values
- `rotate` degree values

## Sprite / Overflow Image Pattern

When `left` is a large negative %, it is a sprite crop — do NOT scale:
```css
/* Correct */
left: -129.09%;
width: 229.09%;

/* Wrong — do not scale % values */
left: -86.09%; /* -129.09 × 0.667 — incorrect */
```

## Class Naming (Literal Mode)

Source priority: `data-name` attribute → `data-node-id`
- `data-name="BG"` → `.bg`
- `data-name="Light"` → `.light`
- No `data-name` → `.node-{nodeId}` (replace `:` with `-`)
- Conflicts: append parent name prefix (`.heroLight`, `.kidLight`)
