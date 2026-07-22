# Figma Property → CSS Mapping Reference

Properties automatically converted by `figma-extract.js` tree extraction (Extract Mode E1) and consumed by `figma-to-scss.js`. Phase 4 forbids hand-writing these values — this table is grounding for reviewing script output (and for modifying the scripts when output is unsatisfactory).

## Layout

| Figma Property | CSS | vw conversion |
|-----------|-----|---------|
| `layoutMode=VERTICAL` | `display:flex; flex-direction:column` | No |
| `layoutMode=HORIZONTAL` | `display:flex; flex-direction:row` | No |
| `primaryAxisAlignItems` | `justify-content` | No |
| `counterAxisAlignItems` | `align-items` | No |
| `itemSpacing` | `gap` | Yes |
| `layoutGrow=1` | `flex-grow: 1` | No |
| `padding*` | `padding` | Yes |
| `absoluteBoundingBox.width/height` | `width/height` | Yes |
| `layoutPositioning=ABSOLUTE` | `position: absolute` + `top/left` (relative to parent) | Yes |
| `layoutSizingHorizontal=HUG` | remove width (auto) | — |
| `layoutSizingHorizontal=FILL` | metadata `layoutSizingH` (converter decides flex:1/100%) | — |
| `layoutSizingVertical=HUG` | remove height (auto) | — |
| `layoutSizingVertical=FILL` | metadata `layoutSizingV` (converter decides) | — |
| `clipsContent` | `overflow: hidden` | No |

## Visual

| Figma Property | CSS | vw conversion |
|-----------|-----|---------|
| `fills[].SOLID` | `background-color` | No |
| `fills[].IMAGE` | `imageRef` + `imageScaleMode` (FILL/FIT/CROP/TILE) | — |
| `fills[].GRADIENT_LINEAR` | `background-image: linear-gradient(...)` | No |
| `fills[].GRADIENT_RADIAL` | `background-image: radial-gradient(...)` | No |
| `fills[] (2 or more)` | `fills` array (type, color, imageRef, gradient, blendMode, filters) | — |
| `fills[].blendMode` | `background-blend-mode` | No |
| `fills[].filters.saturation` | `filter: grayscale(X%)` / `saturate(X%)` | No |
| `fills[].color` (TEXT) | `color` | No |
| `strokes[] + strokeAlign=INSIDE` | `border` + `box-sizing: border-box` | Yes (width only) |
| `strokes[] + strokeAlign=OUTSIDE` | `outline` | Yes (width only) |
| `individualStrokeWeights` | `border-top/right/bottom/left` individually | Yes (width only) |
| `strokeDashes` | `border-style: dashed` | No |
| `effects[].DROP_SHADOW` | `box-shadow` | Yes (px only) |
| `effects[].INNER_SHADOW` | `box-shadow` (inset) | Yes (px only) |
| `effects[].LAYER_BLUR` | `filter: blur()` (accumulated) | Yes |
| `effects[].BACKGROUND_BLUR` | `backdrop-filter: blur()` | Yes |
| `cornerRadius` | `border-radius` | Yes |
| `opacity` | `opacity` | No |
| `rotation` | `transform: rotate(Xdeg)` | No |
| `blendMode` (node level) | `mix-blend-mode` | No |

## Text

| Figma Property | CSS | vw conversion |
|-----------|-----|---------|
| `style.fontFamily` | `font-family` | No |
| `style.fontSize` | `font-size` | Yes |
| `style.fontWeight` | `font-weight` | No |
| `style.lineHeightPx` | `line-height` | No |
| `style.letterSpacing` | `letter-spacing` | Yes |
| `style.textAlignHorizontal` | `text-align` | No |
| `style.textCase` | `text-transform` | No |
| `style.textTruncation` | `overflow: hidden; text-overflow: ellipsis` | No |
| `style.paragraphSpacing` | `margin-bottom` | Yes |
| `characters` | text content | — |

## SCSS Property Allowlist (per file group)

```
Layout (layout/ files):
  display, flex-direction, justify-content, align-items, gap,
  flex-grow, padding, width, height, overflow, position, top, left, transform

Visual (components/ files):
  background-color, background-image, background-blend-mode, color,
  font-family, font-size, font-weight, line-height, letter-spacing,
  text-align, text-transform, text-overflow,
  border-radius, border, outline, box-sizing, box-shadow,
  opacity, mix-blend-mode, filter, backdrop-filter

If a value is absent in the tree → omit that property (no guessing)

❌ Forbidden: aspect-ratio, container queries, custom @function/@mixin (wp-fluid() etc.),
   clamp() with guessed values — only 1:1 mapping from the tree is allowed.
```

## Responsive Unit Conversion (legacy vw workflow — Phase 4C reference)

> Current Phase 4 generates px as-is via figma-to-scss.js. These rules apply to the
> responsive-integration flow (Phase 4C) and to script maintenance.

```
vw conversion (mechanical formula only):
  width, height, padding, gap, border-radius, box-shadow, top, left, border-width
  vw value = (Figma px / designWidth) × 100
  ⛔ clamp, min(), max() etc. are allowed only for font-size

Font → clamp(min, vw, max):
  | Role    | Min   | Determination Basis         |
  |---------|-------|-----------------------------|
  | h1~h2   | 16px  | name contains "title"       |
  | h3~h4   | 14px  | medium size                 |
  | Body    | 12px  | long text                   |
  | Caption | 10px  | small fontSize              |
  | Button  | 12px  | name contains "btn"         |
  max value = original Figma px as-is

Properties never converted:
  color, opacity, font-weight, font-family, z-index, text-align,
  mix-blend-mode, transform(rotate), background-blend-mode,
  flex-grow, box-sizing, grayscale/saturate, background-image(gradient)

layoutSizing handling:
  HUG → omit width/height (auto)
  FILL → same direction as parent → flex: 1 0 0 · cross axis → align-self: stretch
  FIXED → vw conversion

imageScaleMode:
  FILL → background-size: cover · FIT → contain
  CROP → cover + background-position: center · TILE → auto + repeat

MO↔PC responsive (remapped.json pcDiff → @media overrides, MO base preserved):
  Same value → keep MO only
  Different px → @media { PC vw }
  Different layout → @media { flex-direction: row }
  Different image → @media { background-image: url(pc-xxx.webp) }
  layoutSizing diff → @media { flex/width change }
```
