---
name: vibe.figma.convert
description: Figma tree → structured code generation + screenshot validation
triggers: []
tier: standard
---

# vibe.figma.convert — Tree-Based Structured Code Generation

**Mechanically map tree.json to HTML+CSS. Do not guess.**
**Claude handles only semantic decisions (tag selection, component separation, interactions).**

---

## 0. Reuse Check (Before Writing Code)

```
If there is a matching component in component-index.json:
  ✅ Import and use it (do not create a new one)
  ✅ Customize via props
  ❌ Modify the internals of an existing component
  ❌ Create a new one when 90% similar already exists
```

---

## 1. Image vs HTML Determination (BLOCKING)

```
⛔ Before writing code: write the determination table first.

Determination rules (YES on any one → HTML):
  Q1. Does it have TEXT children? → HTML
  Q2. Is it a repeating INSTANCE pattern? → HTML v-for (inner assets only as <img>)
  Q3. Is it an interactive element? (btn, CTA) → HTML <button>
  Q4. Is it dynamic data? (price, quantity, duration) → HTML text
  All NO → image rendering is acceptable

⛔ Design text determination (Q1 exception — text that must be rendered as image):
  If any of the following conditions are met → image rendering (HTML text forbidden):
  D1. TEXT node has 2 or more fills (gradient + solid overlap)
  D2. TEXT node has effects (DROP_SHADOW, stroke, etc.)
  D3. TEXT node fills contain a GRADIENT type
  D4. Parent GROUP/FRAME has 3 or more VECTORs (vector text)
  D5. TEXT node fontFamily is not in the project's web fonts

  → Render node as content/{section}-{name}.webp
  → Place in HTML as <img src="..." alt="text content">
  → Do not attempt CSS text implementation (visual quality cannot be guaranteed)

BG frames:
  ❌ No <img> tags
  ✅ Parent SCSS background-image only:
     .section { background-image: url('bg.webp'); background-size: cover; }
```

---

## 2. Node → HTML Mapping (Mechanical)

```
FRAME + Auto Layout → <div> + flex (direction/gap/padding directly mapped)
FRAME + no Auto Layout → <div> + position:relative (children absolute)
TEXT → <span> (Claude promotes to h2/p/button)
IMAGE fill (passed determination) → <img>
VECTOR/GROUP ≤64px → icon <img>
INSTANCE repeated 2+ → v-for / .map()
Size 0px, VECTOR ≤2px → skip
```

---

## 3. CSS Property Direct Mapping

```
⛔ Immutable rule: do not create CSS properties not present in tree.json.
⛔ No custom functions/mixins: no self-defined abstractions like wp-fluid(), wp-bg-layer, etc.
⛔ No CSS properties not in tree.json such as aspect-ratio, container query, etc.
✅ Only direct 1:1 mapping from tree.json css object → SCSS is allowed.
✅ The only transformation: px → vw (mechanically, using the formula).

Layout (layout/ files):
  display, flex-direction, justify-content, align-items, gap,
  flex-grow, padding, width, height, overflow, position, top, left, transform

Visual (components/ files):
  background-color, background-image, background-blend-mode, color,
  font-family, font-size, font-weight, line-height, letter-spacing,
  text-align, text-transform, text-overflow,
  border-radius, border, outline, box-sizing, box-shadow,
  opacity, mix-blend-mode, filter, backdrop-filter

If a value is absent → omit that property (no guessing)

❌ Forbidden patterns:
  aspect-ratio: 720 / 1280;          → ❌ (tree.json has width+height)
  @function wp-fluid(...) { ... }    → ❌ (custom function)
  @include wp-bg-layer;              → ❌ (custom mixin)
  clamp(12px, 2.5vw, 18px);          → ❌ (guessing values not in tree.json)

✅ Correct patterns:
  width: 100vw; height: 177.78vw;    → ✅ (720px/720×100, 1280px/720×100)
  background-image: url('hero-bg.webp'); background-size: cover;  → ✅
  font-size: 5.56vw;                 → ✅ (40px/720×100)
```

### Responsive Unit Conversion

```
vw conversion (use only the mechanical formula):
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

Properties not converted:
  color, opacity, font-weight, font-family, z-index, text-align,
  mix-blend-mode, transform(rotate), background-blend-mode,
  flex-grow, box-sizing, grayscale/saturate, background-image(gradient)

layoutSizing handling:
  HUG → omit width/height (auto)
  FILL → check parent direction:
    FILL in same direction → flex: 1 0 0
    FILL on cross axis → align-self: stretch
  FIXED → vw conversion

imageScaleMode:
  FILL → background-size: cover
  FIT  → background-size: contain
  CROP → background-size: cover; background-position: center
  TILE → background-size: auto; background-repeat: repeat
```

---

## 4. Claude Semantic Decisions (The Only Inference Area)

```
1. HTML tag promotion:
   <span> → <h2> (section title), <p> (description), <button> (clickable)

2. Component separation:
   1st-depth children = section components, INSTANCE repetition = shared components

3. Interactions: @click handlers, state variables, conditional rendering

4. Accessibility:
   Background/decorative → alt="" aria-hidden="true"
   Content → alt="description"
   Interactive → role, aria-label

5. Semantic HTML:
   Top-level <section>, heading order h1~h6, lists <ul>/<ol>
```

---

## 5. SCSS File Structure

```
layout/     → position, display, flex, width, height, padding, gap, overflow, z-index
components/ → font, color, border, shadow, opacity, background

_base.scss:
  .{feature} { width: 100%; max-width: 720px; margin: 0 auto; overflow-x: hidden; }

_tokens.scss:
  Reference existing tokens (@use) → if no mapping, create a new token
  Feature-scoped naming ($feature-color-xxx)
```

---

## 6. Responsive (MO↔PC)

```
Use remapped.json's pcDiff to add @media overrides.
Do not delete the base MO code.

.section {
  // MO base (vw = px / 720 × 100)
  height: 177.78vw;

  @media (min-width: #{$bp-desktop}) {
    // PC diff only (vw = px / 2560 × 100)
    height: 32.66vw;
  }
}

diff handling:
  Same value → keep MO only
  Different px → @media { PC vw }
  Different layout → @media { flex-direction: row }
  Different image → @media { background-image: url(pc-xxx.webp) }
  layoutSizing diff → @media { flex/width change }
```

---

## 7. Self-Validation

```
⛔ Any failure → rewrite that section's code (do not proceed to the next section)

1. Class names: all classes in template are defined in SCSS → OK
2. Image paths: src file actually exists → OK
3. Tree mapping: Auto Layout node → flex present in SCSS → OK
4. ⛔ No abstractions: no @function or @mixin defined in SCSS → OK
   (project existing token @use is allowed; creating new functions/mixins is forbidden)
5. ⛔ Property mapping: all SCSS properties are grounded in tree.json css object → OK
   (aspect-ratio, container, custom properties etc. not in tree.json → FAIL)
6. ⛔ Image filenames: kebab-case naming → OK
   (hash filenames like 68ad470b.webp etc. → FAIL)
```
