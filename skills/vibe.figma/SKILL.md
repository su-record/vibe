---
name: vibe.figma
description: Figma design to code — tree-based structural code generation
triggers: []
tier: standard
---

# vibe.figma — Structural Code Generation

## Core Principles

```
The Figma tree is the source of truth for code. Screenshots are for verification only.

✅ Figma Auto Layout → CSS Flexbox 1:1 mechanical mapping
✅ Figma CSS properties → SCSS direct conversion (no guessing)
✅ Claude handles semantic decisions only: tag selection, component splitting, interactions
✅ Screenshots are used for verification only, not generation
```

## Immutable Rules

```
1. Do NOT render content as images via screenshot
   ✅ BG rendering (backgrounds with no TEXT children), vector-text GROUPs, section screenshots (verification only)
   ❌ Frames with TEXT children, INSTANCE repetitions, buttons/prices, rendering entire sections

2. BG must use CSS background-image only. <img> tag is forbidden.

3. No new screenshot calls during Phase 4 code generation.
   Use only Phase 2 materials. No matter how complex — implement with HTML+CSS.
```

## Full Flow

```
Input: receive all URLs at once
  Storyboard: figma.com/...?node-id=aaa (if present)
  MO Design:  figma.com/...?node-id=xxx
  PC Design:  figma.com/...?node-id=yyy (if present)

→ Phase 0: Setup
→ Phase 1: Storyboard analysis → functional spec document
→ Phase 2: Gather materials (→ vibe.figma.extract)
→ Phase 3: Remapping (MO↔PC matching → remapped.json)
→ Phase 4: Sequential code generation (→ vibe.figma.convert)
→ Phase 5: Compile gate
→ Phase 6: Visual verification loop

Working directory:
  /tmp/{feature}/
  ├── mo-main/tree.json, bg/, content/, sections/
  ├── pc-main/tree.json, bg/, content/, sections/
  └── remapped.json ← sole input for Phase 4

Code output: placed directly in the project directory
  components/{feature}/, styles/{feature}/
```

---

## Phase 0: Setup

```
1. Stack detection: package.json → react/vue/svelte, next/nuxt, scss/tailwind
2. Feature name: Figma filename → kebab-case
3. Directories: components/{feature}/, public/images/{feature}/, styles/{feature}/
4. Component indexing → /tmp/{feature}/component-index.json
   (scan up to 50 components, extract props/slots/classes, within 2 minutes)
5. Hooks/Types/Constants → /tmp/{feature}/context-index.json
6. Design token scan → /tmp/{feature}/project-tokens.json
   (SCSS > CSS Variables > Tailwind > CSS-in-JS)
```

---

## Phase 1: Storyboard Analysis

```
User input: enter URLs or PDF/images separated by newlines

URL classification (automatic):
  Different fileKey → storyboard vs design
  ROOT name contains "MO" → mobile, "PC" → desktop

Storyboard analysis:
  Collect frames at depth=3 → classify by name pattern
  SPEC (functional definition) → CONFIG (resolution) → PAGE (main sections) → SHARED (common)
  PDF/images follow the same structural extraction

❌ No code file creation during Phase 1

Output (text only):
  1. Section list table (name, Figma name, height, description)
  2. Functional definition per section ([Function] + [Interaction] + [State])
  3. Common component list
  4. TypeScript interface draft
```

---

## Phase 2: Gather Materials ← Research (parallel)

**→ Follow the rules of the vibe.figma.extract skill.**
**Coordinator pattern: run MO/PC extraction as parallel workers.**

```
# [FIGMA_SCRIPT] = ~/.vibe/hooks/scripts/figma-extract.js

Simultaneous MO/PC extraction (each as an independent worker):
  Worker-MO: screenshot → tree → images → asset rendering → sections/
  Worker-PC: screenshot → tree → images → asset rendering → sections/
  → Proceed to Phase 3 only after both workers have completed

Single BP: run sequentially with 1 worker

Multi-frame (same BP, different pages):
  Sequential extraction (500ms interval), partial failure allowed
```

---

## Phase 3: Data Refinement ← Synthesis (independent per BP)

**Split and refine each BP's tree.json by section.**
**MO↔PC matching (responsive) is NOT done at this stage.**

### BLOCKING Command — Writing custom refine scripts is strictly forbidden

```bash
# MO
node ~/.vibe/hooks/scripts/figma-refine.js \
  /tmp/{feature}/mo-main/tree.json \
  --out=/tmp/{feature}/mo-main/sections.json \
  --design-width=720 \
  --bp=mo

# PC
node ~/.vibe/hooks/scripts/figma-refine.js \
  /tmp/{feature}/pc-main/tree.json \
  --out=/tmp/{feature}/pc-main/sections.json \
  --design-width=2560 \
  --bp=pc
```

⛔ **Phase 4 is blocked until these commands are executed.**
⛔ **Do NOT write custom refine scripts** (refine-sections.mjs, refine.js, etc. — all forbidden)
⛔ **Do NOT parse tree.json directly with Python/Node to produce sections.json**
✅ Use only the output of figma-refine.js. If the output is unsatisfactory, modify figma-refine.js.

### Core Principles

```
⛔ Refine each BP independently. Do NOT mix MO and PC.
⛔ The refined JSON is the sole input for Phase 4.
⛔ The full subtree (recursive children) for each section must be included.
```

### Output

```
/tmp/{feature}/
  mo-main/
    sections.json    ← MO refinement result
  pc-main/
    sections.json    ← PC refinement result

sections.json structure:
  {
    meta: { feature, designWidth, bp (the corresponding BP) },
    sections: [
      {
        name: "Hero",
        nodeId, name, type, size, css,
        text,          // TEXT nodes only
        imageRef,      // image fill
        fills,         // multiple fills (2 or more)
        layoutSizingH, // HUG/FILL/FIXED
        layoutSizingV,
        children: [    // ⛔ full recursive subtree — down to leaf nodes
          { nodeId, name, type, size, css, children: [...] }
        ],
        images: {
          bg: "bg/hero-bg.webp",
          content: ["content/hero-title.webp"]
        }
      }
    ]
  }
```

### Node Refinement Rules

```
Refinement applied when converting tree.json → sections.json:
  1. Nodes with size 0px → remove
  2. VECTOR decorative lines (w/h ≤ 2px) → remove
  3. isMask nodes → remove
  4. BG frames → separate from children, move to images.bg
  5. Vector-text GROUPs → separate from children, add to images.content
  6. Design text (TEXT with multiple/gradient fills or effects) → add to images.content
  7. Remaining nodes → keep in children (with CSS, recursive)
```

### Multi-frame (same BP, different pages)

```
Identify common elements → extract shared components
Union of common tokens → shared _tokens.scss
```

---

## Phase 4: Per-BP Static Implementation ← Implement (sequential per BP)

**→ Follow the rules of the vibe.figma.convert skill.**
**⛔ Implement MO fully first → pass verification → then implement PC. No responsive conversion.**
**⛔ CSS values must use Figma original px as-is. vw conversion, clamp, @media are forbidden.**

### BLOCKING Command — SCSS must only use script output

```bash
# Step A: Auto-generate SCSS skeleton (run once per BP)
node ~/.vibe/hooks/scripts/figma-to-scss.js \
  /tmp/{feature}/{bp}-main/sections.json \
  --out=/path/to/project/assets/scss/{feature}/

# Step B: Per-section validation (after writing each section's code)
node ~/.vibe/hooks/scripts/figma-validate.js \
  /path/to/project/assets/scss/{feature}/ \
  /tmp/{feature}/{bp}-main/sections.json \
  --section={SectionName}
```

⛔ **Writing SCSS files directly without calling figma-to-scss.js invalidates Phase 4.**
⛔ **Do NOT write custom SCSS generation scripts** (to-scss.mjs, generate-scss.js, etc. — all forbidden)
⛔ **Do NOT proceed to the next section without a figma-validate.js PASS.**
⛔ **Do NOT write CSS values directly inside scoped style blocks** — only @import of external SCSS files is allowed.
✅ Use figma-to-scss.js output as-is. If unsatisfactory, modify figma-to-scss.js.

```
Phase 4A: MO Static Implementation
  Input: /tmp/{feature}/mo-main/sections.json
  ⛔ No parallelism. Process one section at a time:
    1. Read the target section from sections.json
    2. Write an image vs HTML classification table (BLOCKING)
    3. figma-to-scss.js → auto-generate SCSS skeleton (px as-is) — Step A once
    4. Claude: HTML structure + semantic tags + layout + interactions (Vue/React files only)
       ⛔ No CSS written directly in <style> blocks — only @import or @use allowed
    5. figma-validate.js → compare SCSS vs sections.json — Step B
       ├─ PASS → next section
       └─ FAIL → fix discrepancies → re-run step 5 (repeat until P1=0, no round cap)
  → Phase 5 (MO compile) → Phase 6 (MO visual verification)

Phase 4B: PC Static Implementation
  Input: /tmp/{feature}/pc-main/sections.json
  Same process as MO
  → Phase 5 (PC compile) → Phase 6 (PC visual verification)

Phase 4C: Responsive Integration (after both MO+PC pass verification)
  → Separate flow to be established (TODO)

Claude's role (restricted):
  ✅ Image classification: BG / content / decoration / vector-text
  ✅ HTML semantics: section/h1/p/button tag selection
  ✅ Component splitting: v-for repetition, shared components
  ✅ Interactions: @click, state variables, conditional rendering
  ✅ Execute figma-to-scss.js / figma-validate.js commands
  ❌ Do NOT modify SCSS CSS values (use figma-to-scss.js output as-is)
  ❌ Do NOT write CSS directly in <style> blocks
  ❌ Do NOT use vw conversion, clamp, @media, or create custom functions/mixins
  ❌ Do NOT write custom refine/generate scripts (refine.mjs, to-scss.mjs, etc.)

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

0. Capture baseline (before Phase 4): record existing tsc + build errors
   → Phase 5 only fixes NEW errors

1. TypeScript: vue-tsc/svelte-check/tsc --noEmit
2. Build: npm run build (120s timeout)
3. Dev server: npm run dev → detect port → polling

On error: parse → auto-fix → re-check
Termination conditions:
  ✅ Success: all checks pass → enter Phase 6
  ⚠️ Stuck: same errors as previous round → ask user
      1. Provide direct fix instructions → retry next round
      2. "proceed" — record remaining errors as TODO, proceed to Phase 6
      3. "abort" — halt workflow
  ultrawork mode: on stuck, record TODO without prompting and proceed to Phase 6

On completion: preserve dev server PID → used in Phase 6

⛔ After Phase 5 passes (or user proceeds), must enter Phase 6. Do NOT output a "completion summary".
⛔ Do NOT declare work complete without Phase 6.
```

---

## Phase 6: Visual Verification Loop ← Verify (parallel) MANDATORY

**⛔ Phase 6 is mandatory, not optional. Enter automatically upon Phase 5 completion.**
**⛔ If Phase 6 is skipped, the entire task is considered "incomplete".**
**Coordinator pattern: independent per-section verification can be run as parallel workers.**

```
No round cap. Loop until P1=0 (or stuck → ask user).
Infrastructure: src/infra/lib/browser/ (Puppeteer + CDP)

1. Capture rendered screenshot → pixelmatch comparison against Figma screenshot
   diffRatio > 0.1 → P1
2. CSS value comparison: computed CSS vs tree.json expected values
   delta > 4px → P1, ≤ 4px → P2
3. Check for missing images and text
4. Fix P1 issues first (refer to tree.json, no guessing) → revalidate compile → reload

Narrowing scope (noise reduction):
  Round 1: P1+P2+P3 all
  Round 2: P1+P2
  Round 3+: P1 only (continue until P1=0)

Termination conditions:
  ✅ Success: P1 = 0 AND no new findings → complete
  ⚠️ Stuck: same findings as previous round → ask user
      1. Provide direct resolution → retry next round
      2. "proceed" — record remaining issues as TODO, complete
      3. "abort" — halt workflow
  ultrawork mode: on stuck, record TODO without prompting and complete

Responsive: after MO verification, change viewport → same loop against PC screenshots
Cleanup: shut down browser + dev server

⛔ "Completion summary" output is only allowed after Phase 6 is complete (or user proceeds).
```
