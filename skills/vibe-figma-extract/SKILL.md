---
name: vibe-figma-extract
description: Acquire code generation data via Figma REST API — tree (primary), images, screenshots (for validation)
triggers: []
tier: standard
---

# vibe.figma.extract — Acquire Code Generation Data

Uses the Figma REST API (`src/infra/lib/figma/`) to extract **all data needed for structural code generation**.

```
Extraction priority:
  1st: Node tree + CSS (PRIMARY source for code generation)
  2nd: Image assets (fill images + item node rendering)
  3rd: Screenshots (for Phase 6 visual validation — not used for code generation)
```

---

## 1. Node Tree + CSS — Source of Truth for Code Generation

```
Bash:
  node "{{VIBE_PATH}}/hooks/scripts/figma-extract.js" tree {fileKey} {nodeId}

Returns (FigmaNode JSON):
  {
    nodeId, name, type, size: { width, height },
    css: { display, flexDirection, gap, ... },
    text: "text content" (TEXT nodes only),
    imageRef: "abc123" (image fill),
    imageScaleMode: "FILL" (FILL/FIT/CROP/TILE),
    layoutSizingH: "HUG" (FIXED/HUG/FILL),
    layoutSizingV: "FILL",
    fills: [...] (only when 2 or more),
    isMask: true (mask nodes only),
    children: [...]
  }

→ Save to /tmp/{feature}/tree.json
```

### Figma Property → CSS Direct Mapping Table

Properties automatically converted by the tree extraction tool. **These values map directly to SCSS:**

**Layout:**

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

**Visual:**

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

**Text:**

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

---

## 2. Image Assets — Node Rendering Based

```
Do NOT download imageRef individually
   → If a texture fill is shared, the original texture (22.7MB) will be downloaded
   → Rendering the node produces the final result as applied to that node (364KB)

All images must be rendered as nodes via the Figma screenshot API
```

### 2-1. BG Frame Rendering

```
BG frame identification criteria:
  - name contains "BG" or "bg"
  - OR same size as parent (±10%) + 3 or more child images

Rendering:
  node "{{VIBE_PATH}}/hooks/scripts/figma-extract.js" screenshot {fileKey} {bg.nodeId} --out=/tmp/{feature}/bg/{section}-bg.webp
```

### 2-2. Content Node Rendering

```
Targets (identified from tree.json):
  - Icons (VECTOR/GROUP size ≤ 64px)
  - Item/reward thumbnails (name contains "item", "reward", "token", "coin")
  - Vector text GROUPs (3 or more VECTORs under parent, each <60px)
  - Design text (any of the following):
    · TEXT node with 2 or more fills (gradient + solid overlap)
    · TEXT node has effects (DROP_SHADOW, stroke)
    · TEXT node fills contain GRADIENT type
    · fontFamily not in project web fonts
    → Must be included in rendering targets
  - Decorative panels (wooden signs, metal plates, and other textured backgrounds)
    → Render the same way as BG frames

Rendering:
  node "{{VIBE_PATH}}/hooks/scripts/figma-extract.js" screenshot {fileKey} {node.nodeId} --out=/tmp/{feature}/content/{name}.webp
```

### 2-3. imageRef Download (Fallback)

```
Only when node rendering is not possible (API failure, DOCUMENT level):
  File size exceeds 5MB → texture fill warning
```

---

## 3. Screenshots — Reference for Phase 6 Validation

```
Not used for code generation.

Full: screenshot → /tmp/{feature}/full-screenshot.webp
Per section: each 1-depth child → /tmp/{feature}/sections/{name}.webp
```

---

## 4. Extracted Data Summary

```
/tmp/{feature}/
├── tree.json                    ← PRIMARY source
├── bg/                          ← BG frame rendering
├── content/                     ← Content node rendering
├── full-screenshot.webp          ← For validation
└── sections/                    ← Per-section validation

Image classification summary:
  | Category | Handling |
  |------|------|
  | BG frames | Frame rendering → bg/ |
  | Design text | Node rendering → content/ |
  | Vector text | GROUP rendering → content/ |
  | Content | Node rendering → content/ |
  | Decorative panels | Frame rendering → content/ |
  | Decorations | Included in BG rendering |
```

---

## 5. Extraction Completion Validation (Required Before Entering Phase 3)

```
If any item is missing → re-extract (do NOT proceed to Phase 3)

1. tree.json exists + root node children > 0
2. BG for each section → file exists in bg/
3. Design text check:
   Traverse tree.json → generate list of TEXT nodes with 2 or more fills or effects
   → All such nodes must have rendering files in content/
4. Vector text check:
   GROUP with 3 or more VECTORs → rendering file exists in content/
5. Per-section validation screenshots → files exist in sections/
6. File naming convention: all kebab-case (no hash filenames)
```

---

## Error Recovery

| Failure | Recovery |
|---------|----------|
| Figma API 401 (unauthorized) | Prompt user to set FIGMA_ACCESS_TOKEN in environment or ~/.vibe/config.json |
| Figma API 404 (file not found) | Verify fileKey extracted from URL. Check if file is shared/accessible. |
| Figma API 429 (rate limit) | Wait 60s, retry with reduced node scope (single page instead of full file) |
| API timeout on large file | Split request by page — fetch one page at a time via nodeId parameter |
| Screenshot download failure | Skip screenshot, proceed with tree.json only (mark visual verification as manual) |
