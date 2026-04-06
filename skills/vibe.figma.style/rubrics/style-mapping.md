# Figma Style → CSS/Tailwind Mapping Rules

> This skill is merged into vibe.figma.convert. This rubric is the definitive reference for converting Figma design values to output CSS.

## Scale Factor Application

```
scaledValue = Math.round(figmaValue × scaleFactor)
```

Apply to: `px` units only (font-size, padding, margin, gap, width, height, top, left, inset, border-radius, box-shadow offsets, letter-spacing, blur radius).

Never apply to: colors, opacity, unitless line-height, `%` values, z-index, degrees.

## Color Mapping

| Figma Token / Tailwind | CSS Output | Token Name |
|-----------------------|-----------|-----------|
| `text-[#1B3A1D]` | `color: #1B3A1D` | `$color-heading` |
| `text-white` | `color: #FFFFFF` | `$color-white` |
| `bg-[#0A1628]` | `background-color: #0A1628` | `$color-bg-dark` |
| `bg-[rgba(13,40,61,0.5)]` | `background: rgba(13,40,61,0.5)` | *(inline, no token)* |
| `var(--color/grayscale/950,#171716)` | `color: #171716` | Use fallback value |
| `border-[#E5E7EB]` | `border-color: #E5E7EB` | `$color-border` |

Create a `$color-*` token for any hex value that appears in 2+ selectors.

## Typography Mapping

| Figma / Tailwind | CSS Property | Scale? |
|-----------------|-------------|--------|
| `text-[48px]` | `font-size: 48px × SF` | Yes |
| `font-black` | `font-weight: 900` | No |
| `font-bold` | `font-weight: 700` | No |
| `font-semibold` | `font-weight: 600` | No |
| `font-medium` | `font-weight: 500` | No |
| `font-normal` | `font-weight: 400` | No |
| `leading-[1.4]` | `line-height: 1.4` | No (unitless) |
| `leading-[48px]` | `line-height: 48px × SF` | Yes (has unit) |
| `tracking-[-0.36px]` | `letter-spacing: -0.36px × SF` | Yes |
| `text-center` | `text-align: center` | No |
| `whitespace-nowrap` | `white-space: nowrap` | No |
| `font-[family-name:var(--font/family/pretendard,...)]` | `font-family: 'Pretendard', sans-serif` | No |

## Spacing Mapping

| Tailwind | CSS | Scale? |
|---------|-----|--------|
| `pt-[120px]` | `padding-top: 120px × SF` | Yes |
| `px-[24px]` | `padding-left: 24px × SF; padding-right: 24px × SF` | Yes |
| `gap-[24px]` | `gap: 24px × SF` | Yes |
| `mt-[16px]` | `margin-top: 16px × SF` | Yes |
| `rounded-[12px]` | `border-radius: 12px × SF` | Yes |
| `inset-0` | `inset: 0` | No |
| `inset-[-18.13%]` | `inset: -18.13%` | No (%) |

## Layout Mapping

| Tailwind | CSS |
|---------|-----|
| `flex` | `display: flex` |
| `flex-col` | `flex-direction: column` |
| `items-center` | `align-items: center` |
| `justify-center` | `justify-content: center` |
| `justify-between` | `justify-content: space-between` |
| `grid` | `display: grid` |
| `absolute` | `position: absolute` |
| `relative` | `position: relative` |
| `overflow-clip` | `overflow: clip` ← not `overflow: hidden` |
| `overflow-hidden` | `overflow: hidden` |
| `size-full` | `width: 100%; height: 100%` |
| `w-full` | `width: 100%` |
| `max-w-none` | `max-width: none` |
| `z-[10]` | `z-index: 10` |
| `pointer-events-none` | `pointer-events: none` |

## Visual Effects Mapping

| Tailwind | CSS | Scale? |
|---------|-----|--------|
| `opacity-40` | `opacity: 0.4` | No |
| `blur-[3.5px]` | `filter: blur(3.5px)` | Yes |
| `mix-blend-lighten` | `mix-blend-mode: lighten` | No |
| `mix-blend-multiply` | `mix-blend-mode: multiply` | No |
| `mix-blend-hue` | `mix-blend-mode: hue` | No |
| `rotate-[149.7deg]` | `transform: rotate(149.7deg)` | No |
| `-scale-y-100` | `transform: scaleY(-1)` | No |
| `shadow-[0_4px_24px_rgba(0,0,0,0.4)]` | `box-shadow: 0 4px × SF 24px × SF rgba(0,0,0,0.4)` | Partial (px only) |
| `object-cover` | `object-fit: cover` | No |
| `object-contain` | `object-fit: contain` | No |

## Token Promotion Rules

Promote a value to `_tokens.scss` when:
- A color appears in 2+ different selectors
- A font-size serves a named role (heading, body, caption)
- A spacing value appears in 3+ places
- A breakpoint threshold is used

Do not promote one-off values used in a single selector — write them inline.
