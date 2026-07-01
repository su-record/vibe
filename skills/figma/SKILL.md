---
name: figma
description: Figma → 코드 본체 — tree 기반 구조적 코드 생성 (extract/convert 모드 통합).
when_to_use: /vibe.figma 진입점에서 체인 호출. 직접 호출 금지.
user-invocable: false
tier: standard
---

# vibe.figma — Structural Code Generation

## Core Principles

```
The Figma tree is the source of truth for code. Screenshots are for verification only.

✅ Figma Auto Layout → CSS Flexbox 1:1 mechanical mapping
✅ Figma CSS properties → SCSS direct conversion (no guessing)
✅ Claude handles semantic decisions only: tag selection, component splitting, interactions
```

## Immutable Rules

```
1. Do NOT render content as images (frames with TEXT children, INSTANCEs, buttons/prices,
   whole sections). Image rendering only for BG, vector-text GROUPs, verification screenshots.
2. BG must use CSS background-image only. <img> tag is forbidden.
3. No new screenshot calls during Phase 4. Use only Phase 2 materials —
   no matter how complex, implement with HTML+CSS.
```

## Full Flow

```
Input: receive all URLs at once
  Storyboard: figma.com/...?node-id=aaa (if present)
  MO Design:  figma.com/...?node-id=xxx
  PC Design:  figma.com/...?node-id=yyy (if present)

→ Phase 0: Setup
→ Phase 1: Storyboard analysis → functional spec document
→ Phase 2: Gather materials (→ Extract Mode section below)
→ Phase 3: Remapping (MO↔PC matching → remapped.json)
→ Phase 4: Sequential code generation (→ Convert Mode section below)
→ Phase 5: Compile gate
→ Phase 6: Visual verification loop

Working directory: /tmp/{feature}/{mo,pc}-main/{tree.json, bg/, content/, sections/}
  + remapped.json ← sole input for Phase 4
Code output: directly in the project — components/{feature}/, styles/{feature}/
```

---

## Phase 0: Setup

```
1. Stack detection: package.json → react/vue/svelte, next/nuxt, scss/tailwind
2. Feature name: Figma filename → kebab-case
3. Directories: components/{feature}/, public/images/{feature}/, styles/{feature}/
4. Component indexing → component-index.json (≤50 components, props/slots/classes, ≤2 min)
5. Hooks/Types/Constants → context-index.json
6. Design token scan → project-tokens.json (SCSS > CSS Variables > Tailwind > CSS-in-JS)
   (all indexes under /tmp/{feature}/)
```

---

## Phase 1: Storyboard Analysis

```
User input: URLs or PDF/images separated by newlines
URL classification (automatic): different fileKey → storyboard vs design;
  ROOT name contains "MO" → mobile, "PC" → desktop

Storyboard analysis: collect frames at depth=3 → classify by name pattern
  SPEC (functional definition) → CONFIG (resolution) → PAGE (main sections) → SHARED (common)
  PDF/images follow the same structural extraction

❌ No code file creation during Phase 1

Output (text only): section list table · per-section functional definition
  ([Function] + [Interaction] + [State]) · common component list · TS interface draft
```

---

## Phase 2: Gather Materials ← Research (parallel)

**→ Follow the Extract Mode rules below.**
**Coordinator pattern: run MO/PC extraction as parallel workers.**

```
# [FIGMA_SCRIPT] = {{VIBE_PATH}}/hooks/scripts/figma-extract.js

Simultaneous MO/PC extraction — each worker: screenshot → tree → images →
  asset rendering → sections/. Proceed to Phase 3 only after both complete.
Single BP: run sequentially with 1 worker
Multi-frame (same BP, different pages): sequential (500ms interval), partial failure allowed
```

---

## Phase 3: Data Refinement ← Synthesis (independent per BP)

**Split and refine each BP's tree.json by section. MO↔PC matching is NOT done here.**

### BLOCKING Command — Writing custom refine scripts is strictly forbidden

```bash
# MO
node {{VIBE_PATH}}/hooks/scripts/figma-refine.js \
  /tmp/{feature}/mo-main/tree.json \
  --out=/tmp/{feature}/mo-main/sections.json \
  --design-width=720 \
  --bp=mo

# PC
node {{VIBE_PATH}}/hooks/scripts/figma-refine.js \
  /tmp/{feature}/pc-main/tree.json \
  --out=/tmp/{feature}/pc-main/sections.json \
  --design-width=2560 \
  --bp=pc
```

⛔ **Phase 4 is blocked until these commands are executed.**
⛔ **No custom refine scripts, no parsing tree.json directly to produce sections.json.**
✅ Use only figma-refine.js output. If unsatisfactory, modify figma-refine.js.

```
⛔ Refine each BP independently — do NOT mix MO and PC.
⛔ The refined JSON (full recursive subtree per section) is the sole input for Phase 4.
```

### Output

```
/tmp/{feature}/{mo,pc}-main/sections.json    ← per-BP refinement result

sections.json structure:
  {
    meta: { feature, designWidth, bp },
    sections: [{
      name: "Hero", nodeId, type, size, css,
      text, imageRef, fills, layoutSizingH, layoutSizingV,
      children: [ ... ],   // ⛔ full recursive subtree — down to leaf nodes
      images: { bg: "bg/hero-bg.webp", content: ["content/hero-title.webp"] }
    }]
  }
```

### Node Refinement Rules (tree.json → sections.json)

```
1. size-0px nodes, VECTOR decorative lines (w/h ≤ 2px), isMask nodes → remove
2. BG frames → separate from children, move to images.bg
3. Vector-text GROUPs + design text (TEXT with multiple/gradient fills or effects)
   → separate from children, add to images.content
4. Remaining nodes → keep in children (with CSS, recursive)

Multi-frame (same BP, different pages): identify common elements → shared components;
  union of common tokens → shared _tokens.scss
```

---

## Phase 4: Per-BP Static Implementation ← Implement (sequential per BP)

**→ Follow the Convert Mode rules below.**
**⛔ Implement MO fully first → pass verification → then implement PC. No responsive conversion.**
**⛔ CSS values must use Figma original px as-is. vw conversion, clamp, @media are forbidden.**

### BLOCKING Command — SCSS must only use script output

```bash
# Step A: Auto-generate SCSS skeleton (run once per BP)
node {{VIBE_PATH}}/hooks/scripts/figma-to-scss.js \
  /tmp/{feature}/{bp}-main/sections.json \
  --out=/path/to/project/assets/scss/{feature}/

# Step B: Per-section validation (after writing each section's code)
node {{VIBE_PATH}}/hooks/scripts/figma-validate.js \
  /path/to/project/assets/scss/{feature}/ \
  /tmp/{feature}/{bp}-main/sections.json \
  --section={SectionName}
```

⛔ **Writing SCSS directly (or via custom generation scripts) invalidates Phase 4.**
⛔ **Do NOT proceed to the next section without a figma-validate.js PASS.**
⛔ **No CSS values inside scoped style blocks** — only @import/@use of external SCSS files.
✅ Use figma-to-scss.js output as-is. If unsatisfactory, modify figma-to-scss.js.

```
Phase 4A: MO Static Implementation (input: mo-main/sections.json)
  ⛔ No parallelism. Process one section at a time:
    1. Read the target section from sections.json
    2. Write an image vs HTML classification table (BLOCKING — see Convert Mode §C1)
    3. figma-to-scss.js → auto-generate SCSS skeleton (px as-is) — Step A once
    4. Claude: HTML structure + semantic tags + layout + interactions (Vue/React files only)
    5. figma-validate.js — Step B: PASS → next section │ FAIL → fix → re-run
       (repeat until P1=0, no round cap)
  → Phase 5 (MO compile) → Phase 6 (MO visual verification)

Phase 4B: PC Static Implementation (input: pc-main/sections.json)
  Same process as MO → Phase 5 (PC compile) → Phase 6 (PC visual verification)

Phase 4C: Responsive Integration (after both MO+PC pass verification)
  → Separate flow to be established (TODO)

Claude's role (restricted): semantic decisions only (Convert Mode §C3) + image classification
  + executing figma-to-scss.js / figma-validate.js.
  ❌ No modifying SCSS values, no CSS in <style> blocks, no vw/clamp/@media,
     no custom functions/mixins, no custom refine/generate scripts.

SCSS Setup (before the first section):
  index.scss, _tokens.scss, _base.scss
  Token mapping: reference existing tokens from project-tokens.json → create new ones if no match

Component matching (before each section):
  Compare against component-index.json → import if matched, create new if not

Multi-frame:
  Step 1: shared components first → components/shared/
  Step 2: unique sections per frame
```

---

## Phase 5: Compile Gate

```
No round cap. Loop until compile succeeds (or stuck → ask user).

0. Capture baseline (before Phase 4): record existing tsc + build errors → fix NEW errors only
1. TypeScript: vue-tsc/svelte-check/tsc --noEmit
2. Build: npm run build (120s timeout)
3. Dev server: npm run dev → detect port → polling

On error: parse → auto-fix → re-check
Termination:
  ✅ Success: all checks pass → enter Phase 6
  ⚠️ Stuck (same errors as previous round) → ask user: fix instructions │ "proceed"
     (record TODO, go to Phase 6) │ "abort". ultrawork: record TODO + proceed silently.

On completion: preserve dev server PID → used in Phase 6

⛔ After Phase 5 passes (or user proceeds), must enter Phase 6.
   Do NOT output a "completion summary" or declare work complete without Phase 6.
```

---

## Phase 6: Visual Verification Loop ← Verify (parallel) MANDATORY

**⛔ Mandatory — enter automatically upon Phase 5 completion; skipping = task "incomplete".**
**Coordinator pattern: independent per-section verification can run as parallel workers.**

```
No round cap. Loop until P1=0 (or stuck → ask user).
Infrastructure: src/infra/lib/browser/ (Puppeteer + CDP)

1. Capture rendered screenshot → pixelmatch comparison against Figma screenshot
   diffRatio > 0.1 → P1
2. CSS value comparison: computed CSS vs tree.json expected values
   delta > 4px → P1, ≤ 4px → P2
3. Check for missing images and text
4. Fix P1 issues first (refer to tree.json, no guessing) → revalidate compile → reload

Narrowing scope: Round 1 P1+P2+P3 → Round 2 P1+P2 → Round 3+ P1 only (until P1=0)

Termination:
  ✅ Success: P1 = 0 AND no new findings → complete
  ⚠️ Stuck (same findings as previous round) → ask user: direct resolution │ "proceed"
     (record TODO, complete) │ "abort". ultrawork: record TODO + complete silently.

Responsive: after MO verification, change viewport → same loop against PC screenshots
Cleanup: shut down browser + dev server

⛔ "Completion summary" output is only allowed after Phase 6 is complete (or user proceeds).
```

---

## Extract Mode (Phase 2 body) — Acquire Code Generation Data

Uses the Figma REST API (`src/infra/lib/figma/`) to extract **all data needed for structural code generation**. Priority: 1st node tree + CSS (PRIMARY source) → 2nd image assets → 3rd screenshots (Phase 6 validation only, never for generation).

### E1. Node Tree + CSS — Source of Truth

```
Bash:
  node "{{VIBE_PATH}}/hooks/scripts/figma-extract.js" tree {fileKey} {nodeId}

Returns (FigmaNode JSON):
  { nodeId, name, type, size, css: { display, flexDirection, gap, ... },
    text (TEXT only), imageRef, imageScaleMode (FILL/FIT/CROP/TILE),
    layoutSizingH/V (FIXED/HUG/FILL), fills (only when 2+), isMask,
    raw: { itemSpacing, padding*, cornerRadius, strokeWeight, strokeAlign, blendMode,
           opacity, fontSize, lineHeightPx, letterSpacing, fontWeight, leadingTrim,
           textBoxTrim },   ← Figma numbers for Phase 6 raw-vs-computed reconciliation
    warnings: [{ property, value, severity: "P1"|"P2", reason }],  ← translation-loss only
    children: [...] }

Root node also carries:
  auditSummary: { total, p1, p2, items: [{ nodeId, name, property, value, severity, reason }] }

→ Save to /tmp/{feature}/tree.json

Figma property → CSS mapping (what the extractor auto-converts): rubrics/css-mapping.md
```

### E2. Translation-loss Audit (Figma → CSS Incompatibilities)

The extractor flags properties CSS cannot reproduce cleanly (per-node `warnings[]`, rolled up as root `auditSummary`).

**P1 (block Phase 3 until resolved or waived):** `strokeAlign` ≠ `CENTER` (CSS border only renders centered strokes) · `blendMode` ∈ { `LINEAR_BURN`, `LINEAR_DODGE`, `PLUS_DARKER`, `PLUS_LIGHTER` } (no CSS equivalent).

**P2 (record + proceed):** `leadingTrim`/`textBoxTrim` ≠ `NONE` (limited `text-box-trim` support) · `constraints` ∈ { `SCALE`, `CENTER` } (no direct CSS layout mapping) · `individualStrokeWeights` with `strokeAlign` ≠ `CENTER`.

**Gate rule:** if `auditSummary.p1 > 0`, resolve each item (replace layer in Figma, accept approximation with user sign-off, or mark as known deviation) before Phase 3. Log P2 items into feature notes for Phase 6 reviewer attention.

### E3. Image Assets — Node Rendering Based

Full determination rules and real-world failure cases: `rubrics/image-rules.md`.

```
Do NOT download imageRef individually (shared texture fill → multi-MB originals).
All images are rendered as nodes:
  node "{{VIBE_PATH}}/hooks/scripts/figma-extract.js" screenshot {fileKey} {nodeId} --out=...

BG frames → bg/{section}-bg.webp
  Identification: name contains "BG"/"bg", OR same size as parent (±10%) + 3+ child images
Content nodes → content/{name}.webp
  Icons (VECTOR/GROUP ≤ 64px) · item/reward/token/coin thumbnails
  · vector-text GROUPs (3+ VECTORs, each <60px)
  · design text (TEXT with 2+ fills, effects, GRADIENT fill, or non-web-font fontFamily)
    → must be rendered; placed as <img alt="text content">, never CSS text
  · decorative panels (textured backgrounds) → render like BG frames

imageRef download is a fallback only (API failure, DOCUMENT level); >5MB → texture-fill warning.
Screenshots (validation only): full-screenshot.webp + per 1-depth child → sections/{name}.webp
```

### E4. Extraction Completion Validation (Required Before Phase 3)

```
If any item is missing → re-extract (do NOT proceed to Phase 3)

1. tree.json exists + root children > 0 · 2. BG per section exists in bg/
3. Every design-text TEXT node (2+ fills or effects) rendered in content/
4. Every vector-text GROUP (3+ VECTORs) rendered in content/
5. Per-section validation screenshots exist in sections/ · 6. All filenames kebab-case
```

---

## Convert Mode (Phase 4 body) — Tree-Based Structured Code Generation

**Mechanically map sections.json to HTML. Do not guess.**
**Claude handles only semantic decisions (tag selection, component separation, interactions). SCSS comes from figma-to-scss.js (Phase 4 blocking commands).**

### C0. Reuse Check (Before Writing Code)

```
Matching component in component-index.json?
  ✅ Import and customize via props — do not create a new one
  ❌ Never modify an existing component's internals or duplicate a 90%-similar one
```

### C1. Image vs HTML Determination (BLOCKING)

```
⛔ Before writing code: write the determination table first.

YES on any one → HTML:
  Q1. TEXT children? · Q2. repeating INSTANCE? (→ v-for, inner assets only as <img>)
  Q3. interactive? (btn, CTA → <button>) · Q4. dynamic data? (price, quantity, duration)
  All NO → image rendering is acceptable

⛔ Design text (Q1 exception — must be image; D1–D5, same as Extract Mode E3):
  D1. 2+ fills · D2. effects (DROP_SHADOW, stroke) · D3. GRADIENT fill
  D4. parent GROUP/FRAME has 3+ VECTORs · D5. fontFamily not in project web fonts
  → <img src="content/{section}-{name}.webp" alt="text content"> — no CSS text attempt

BG frames: ❌ no <img> tags — parent SCSS background-image only
  .section { background-image: url('bg.webp'); background-size: cover; }
```

### C2. Node → HTML Mapping (Mechanical)

```
FRAME + Auto Layout → <div> + flex (direction/gap/padding directly mapped)
FRAME + no Auto Layout → <div> + position:relative (children absolute)
TEXT → <span> (Claude promotes to h2/p/button)
IMAGE fill (passed determination) → <img>
VECTOR/GROUP ≤64px → icon <img>
INSTANCE repeated 2+ → v-for / .map()
Size 0px, VECTOR ≤2px → skip
```

CSS property mapping reference (grounding for figma-to-scss.js output review, plus legacy vw/responsive rules): `rubrics/css-mapping.md` — Phase 4 forbids hand-writing these values.

### C3. Claude Semantic Decisions (The Only Inference Area)

```
1. Tag promotion: <span> → <h2> (section title) / <p> (description) / <button> (clickable)
2. Component separation: 1st-depth children = sections, INSTANCE repetition = shared
3. Interactions: @click handlers, state variables, conditional rendering
4. Accessibility: decorative → alt="" aria-hidden="true" · content → alt="description"
   · interactive → role, aria-label
5. Semantic HTML: top-level <section>, heading order h1~h6, lists <ul>/<ol>
```

Component skeleton template: `templates/component.md`.

### C4. SCSS File Structure

```
layout/     → position, display, flex, width, height, padding, gap, overflow, z-index
components/ → font, color, border, shadow, opacity, background
_base.scss  → .{feature} { width: 100%; max-width: 720px; margin: 0 auto; overflow-x: hidden; }
_tokens.scss → reference existing tokens (@use); if no mapping, create a new
               feature-scoped token ($feature-color-xxx)
```

### C5. Self-Validation

```
⛔ Any failure → rewrite that section's code (do not proceed to the next section)

1. All template classes defined in SCSS · 2. Image src files actually exist
3. Auto Layout node → flex present in SCSS
4. ⛔ No @function/@mixin defined in SCSS (existing token @use is allowed)
5. ⛔ Every SCSS property grounded in sections.json css object
   (aspect-ratio, container queries, etc. not in the tree → FAIL)
6. ⛔ Image filenames kebab-case (hash filenames like 68ad470b.webp → FAIL)
```

---

## Error Recovery

| Failure | Recovery |
|---------|----------|
| figma-extract.js script error | Node.js >=18? API token in config? Retry once. |
| Figma API 401 | Prompt user to set FIGMA_ACCESS_TOKEN in env or ~/.vibe/config.json |
| Figma API 404 | Verify fileKey from URL; check file is shared/accessible |
| Figma API 429 (rate limit) | Wait 60s, retry with reduced node scope (single page) |
| API timeout on large file | Split request by page via nodeId parameter |
| Screenshot download failure | Proceed with tree.json only (visual verification → manual) |
| tree.json missing in Phase 4 | Run Extract Mode (Phase 2) first |
| component-index.json missing | Generate minimal index from tree.json section names |
| sections.json malformed | Regenerate from tree.json via figma-refine.js |
| SCSS output empty | Check sections.json for valid style nodes; else default reset styles |
| figma-to-scss.js parse failure | Validate tree.json structure; if malformed, re-run Extract Mode |
| figma-validate.js comparison failure | Skip automated validation; screenshot side-by-side manual review |
| Puppeteer/CDP not available | Skip visual verification; manual browser check |
