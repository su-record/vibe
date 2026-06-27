---
name: clone
description: URL → markup 수준 pixel-perfect 클론 본체 — headless browser로 라이브 사이트 캡처 후 현재 스택으로 스캐폴드.
when_to_use: /vibe.clone 진입점에서 체인 호출. 직접 호출 금지.
user-invocable: false
tier: standard
---

# vibe.clone — Markup-Level Website Clone

## Core Principles

```
The rendered DOM is the source of truth for markup. Screenshots are for pixel verification only.

✅ Puppeteer-rendered DOM (post-JS) → HTML structural mapping
✅ Computed CSS → SCSS direct conversion (no guessing)
✅ All remote assets (images, fonts) → downloaded locally and rewritten to project paths
✅ Claude handles semantic decisions only: tag selection, component splitting, interactions
✅ Screenshots are used for verification only, not generation
```

## Immutable Rules

```
1. Do NOT generate CSS values by guessing or eyeballing screenshots.
   ✅ Use clone-extract.js computed CSS output as-is.
   ❌ Do NOT write CSS values directly inside scoped <style> blocks.

2. Do NOT hotlink remote assets. All images/fonts must be downloaded and rewritten.

3. Do NOT skip the pixel verification loop (Phase 5). The clone is incomplete without it.

4. Do NOT copy textual content verbatim from copyrighted sources for production use.
   This skill is for layout/markup learning ("클론 코딩"). Replace text with placeholders
   or user-provided copy when shipping a real product.

5. Do NOT build a section without confirming its interaction model. The model in
   sections.json is a static-DOM heuristic — verify scroll-driven vs click-driven vs
   time-driven vs hover against the live site. Misidentifying it is the #1 clone failure mode.

6. Do NOT ship default-state-only. Implement every harvested state (hover/focus/active/open/
   tab-switch) from states.json / the section spec.
```

## Full Flow

```
Input: a URL (or multiple URLs for multi-page clones)

→ Phase 0: Setup (stack detection, feature naming, working dir)
→ Phase 1: Capture (Puppeteer → rendered HTML + computed CSS + screenshots + assets)
→ Phase 2: Refine (DOM → sections.json per breakpoint; + interaction model + states)
→ Phase 3: Scaffold (spec gate → SCSS auto-gen + Claude-authored HTML/components)
→ Phase 4: Compile gate
→ Phase 5: Pixel verification loop

Working directory:
  /tmp/{feature}/
  ├── mo/ (375×812)  — rendered.html, computed.json, screenshot.png, assets/, sections.json
  ├── pc/ (1440×900) — rendered.html, computed.json, screenshot.png, assets/, sections.json
  └── tokens.json    — extracted design tokens (colors/fonts/spacing)

Code output: placed directly in the project directory per detected stack
  components/{feature}/, components/{feature}/_specs/, styles/{feature}/, public/images/{feature}/
```

---

## Phase 0: Setup

```
1. Stack detection:
   - .vibe/config.json → stack (react/vue/next/svelte/vanilla, scss/tailwind/css-modules)
   - Fallback: package.json deps
2. Feature name: URL hostname → kebab-case (e.g. stripe.com → stripe-clone)
   - User may override with --name=<custom>
3. Directories:
   - components/{feature}/, styles/{feature}/, public/images/{feature}/
4. Component indexing → /tmp/{feature}/component-index.json
   (scan up to 50 existing components, extract props/slots/classes, within 2 minutes)
5. Design token scan → /tmp/{feature}/project-tokens.json
   (SCSS > CSS Variables > Tailwind > CSS-in-JS)
```

---

## Phase 1: Capture ← Headless browser (parallel MO/PC)

**Coordinator pattern: run MO/PC capture as parallel workers.**

### BLOCKING Command — Use only clone-extract.js for capture

```bash
# [CLONE_SCRIPT] = {{VIBE_PATH}}/hooks/scripts/clone-extract.js

# Mobile (375×812)
node {{VIBE_PATH}}/hooks/scripts/clone-extract.js capture <URL> \
  --out=/tmp/{feature}/mo/ \
  --viewport=375x812 \
  --bp=mo

# Desktop (1440×900)
node {{VIBE_PATH}}/hooks/scripts/clone-extract.js capture <URL> \
  --out=/tmp/{feature}/pc/ \
  --viewport=1440x900 \
  --bp=pc
```

⛔ **Writing custom capture scripts (puppeteer-fetch.mjs, etc.) is forbidden.**
⛔ **Do NOT use WebFetch or curl** — they cannot render JS-driven SPAs.
✅ Use clone-extract.js. If output is unsatisfactory, modify the script.

### Output per breakpoint

```
/tmp/{feature}/{bp}/
  ├── rendered.html       — final DOM after JS execution
  ├── computed.json       — per-element computed CSS + bounding box
  ├── screenshot.png      — full-page screenshot
  ├── states.json         — non-default state rules (hover/focus/active/checked/tab/aria/data-state)
  ├── assets/
  │   ├── images/         — all <img>, background-image, <picture> sources
  │   └── fonts/          — @font-face srcs
  └── asset-map.json      — remote URL → local path mapping
```

### Capture rules

```
1. Wait for `networkidle2` (no in-flight requests for 500ms) before snapshot
2. Scroll to bottom slowly to trigger lazy-loaded content
3. Resolve all <img src>, srcset, and computed background-image URLs
4. Resolve @font-face src() URLs from all stylesheets
5. Download assets in parallel (concurrency=8), preserve original extensions
6. Rewrite asset URLs in rendered.html and computed.json to local paths
7. Strip inline analytics/tracking scripts before saving rendered.html
8. Harvest non-default state rules from all stylesheets → states.json
   (deterministic: read :hover/:focus/:active/:checked/[aria-*]/[data-state]/.is-*/.active
    declarations straight from CSS — NO scripted clicking, so output stays reproducible)
```

---

## Phase 2: Refine ← DOM → sections.json (independent per BP)

### BLOCKING Command — Writing custom refine scripts is forbidden

```bash
# MO  (--states is optional — auto-resolved as states.json next to computed.json)
node {{VIBE_PATH}}/hooks/scripts/clone-refine.js \
  /tmp/{feature}/mo/rendered.html \
  /tmp/{feature}/mo/computed.json \
  --out=/tmp/{feature}/mo/sections.json \
  --states=/tmp/{feature}/mo/states.json \
  --bp=mo

# PC
node {{VIBE_PATH}}/hooks/scripts/clone-refine.js \
  /tmp/{feature}/pc/rendered.html \
  /tmp/{feature}/pc/computed.json \
  --out=/tmp/{feature}/pc/sections.json \
  --states=/tmp/{feature}/pc/states.json \
  --bp=pc
```

⛔ **Phase 3 is blocked until refine completes for all required BPs.**
⛔ **Do NOT parse rendered.html with custom Python/Node scripts.**
✅ Use clone-refine.js output as-is. If unsatisfactory, modify the script.

### Refinement rules

```
Refinement applied when converting rendered.html + computed.json → sections.json:
  1. Strip <script>, <noscript>, <style>, tracking pixels
  2. Strip nodes with display:none, visibility:hidden, opacity:0, size 0
  3. Detect sections: <header>, <nav>, top-level <section>/<main> children, <footer>
     Fallback: top-level children of <body> with height > 100px
  4. Detect repeated patterns (sibling nodes with same tag+class signature, count >= 3)
     → mark as component candidates
  5. Extract design tokens:
     - colors: unique color/background-color values, sorted by frequency
     - typography: font-family/size/weight combinations
     - spacing: padding/margin values (px), bucketed to nearest 4px
  6. Background images (background-image: url) → images.bg
  7. Inline <img> → images.content
  8. Keep CSS subset: layout (display/flex/grid/position/inset/margin/padding/width/height/gap),
     typography (font-*, line-height, letter-spacing, text-*, color),
     decoration (background, border, border-radius, box-shadow, opacity),
     transform/transition
  9. Classify interaction model per section (static-DOM heuristic) → section.interaction
     = { model, confidence, signals[], note }. model ∈ static | click-driven | scroll-driven
     | time-driven | hover. This is a best-guess + ranked SIGNALS, NOT a silent decision —
     the builder confirms it against the live site (Phase 5). Misidentifying the interaction
     model is the #1 clone failure mode (scroll-driven original built as a click UI, etc.).
 10. Attach matching state rules from states.json to each section → section.states
     (rules whose selector references a class/leaf-tag inside that section's subtree)
```

### Output

```
/tmp/{feature}/{bp}/sections.json:
  {
    meta: { feature, url, viewport, bp },
    tokens: { colors: [...], typography: [...], spacing: [...] },
    sections: [
      {
        name: "Header" | "Hero" | "Features" | ...,
        nodeRef, tag, size, css,
        interaction: {        // static-DOM heuristic — builder confirms in Phase 5
          model: "static" | "click-driven" | "scroll-driven" | "time-driven" | "hover",
          confidence: "high" | "medium" | "low",
          signals: [...],     // ranked evidence (sticky, infinite animation, role=tab, …)
          note
        },
        text,                 // text content (placeholder candidates)
        components: [...],    // detected repeated patterns
        states: [             // non-default state rules scoped to this section
          { selector, media, css }
        ],
        children: [...],      // full recursive subtree
        images: { bg, content: [...] }
      }
    ]
  }
```

---

## Phase 3: Scaffold ← stack-specific code generation

**⛔ Implement MO fully first → pass verification → then PC. No responsive conversion in this phase.**
**⛔ CSS values must use computed.json output as-is. No vw/clamp/@media in this phase.**

### BLOCKING Command — SCSS must only use script output

```bash
# Step 0: Generate per-section build-contract specs (run once per BP)
node {{VIBE_PATH}}/hooks/scripts/clone-spec.js \
  /tmp/{feature}/{bp}/sections.json \
  --out=/path/to/project/components/{feature}/_specs/ \
  --feature={feature}

# Step A: Auto-generate SCSS skeleton (run once per BP)
node {{VIBE_PATH}}/hooks/scripts/clone-to-scss.js \
  /tmp/{feature}/{bp}/sections.json \
  --out=/path/to/project/styles/{feature}/ \
  --token-file=/tmp/{feature}/project-tokens.json

# Step B: Per-section validation (after writing each section's component code)
node {{VIBE_PATH}}/hooks/scripts/clone-validate.js \
  /path/to/project/styles/{feature}/ \
  /tmp/{feature}/{bp}/sections.json \
  --section={SectionName}
```

⛔ **No section is built without a completed spec.** Step 0 emits `_specs/{Section}.spec.md`
   (interaction model + states + computed CSS + assets + text + checklist). Before writing a
   section's component, Claude reviews its spec and resolves every `TODO` (confirm interaction
   model, list states to implement, choose tags, replace copyrighted text). The spec is the
   contract AND the audit trail — it forces extraction rigor before any code is written.
⛔ **Writing SCSS files directly without calling clone-to-scss.js invalidates Phase 3.**
⛔ **Do NOT write custom SCSS / spec generation scripts.**
⛔ **Do NOT proceed to the next section without a clone-validate.js PASS.**
✅ Use clone-spec.js / clone-to-scss.js output as-is. If unsatisfactory, modify the script.

```
Phase 3A: MO Scaffold
  Input: /tmp/{feature}/mo/sections.json
  Step 0 once: clone-spec.js → emit _specs/{Section}.spec.md for every section
  ⛔ No parallelism. Process one section at a time:
    1. Read the target section's spec → resolve every TODO:
       ├─ Confirm the interaction model (spec.interaction is a heuristic guess)
       ├─ List the states to implement (spec.states)
       └─ Mark copyrighted text for placeholder replacement
    2. Map component candidates against component-index.json
       ├─ Match → import existing
       └─ No match → create new in components/{feature}/
    3. clone-to-scss.js → auto-generate SCSS skeleton (computed values as-is) — Step A once
    4. Claude: HTML structure + semantic tags + framework-specific component file
       ⛔ No CSS written directly in <style> blocks — only @import/@use allowed
       ⛔ Build for the CONFIRMED interaction model (don't build a click UI for a
          scroll-driven original); wire every state from the spec (hover/active/open/…)
       Framework mapping:
         - React/Next → .tsx with CSS Modules or styled-components per stack
         - Vue/Nuxt   → .vue with scoped <style lang="scss"> @import only
         - Svelte     → .svelte with <style> @import only
         - Vanilla    → .html + linked .scss
    5. Asset references → public/images/{feature}/ (already populated in Phase 1)
    6. clone-validate.js → compare SCSS vs sections.json — Step B
       ├─ PASS → next section
       └─ FAIL → fix discrepancies → re-run step 6 (loop until P1=0, no round cap)
  → Phase 4 (MO compile) → Phase 5 (MO pixel verification)

Phase 3B: PC Scaffold
  Same process as MO, input /tmp/{feature}/pc/sections.json
  → Phase 4 (PC compile) → Phase 5 (PC pixel verification)

Phase 3C: Responsive Integration (after both MO+PC pass verification)
  → Merge MO+PC styles into @media-based responsive layout (separate flow, TODO)

Claude's role (restricted):
  ✅ Component candidates: decide which patterns become reusable components
  ✅ HTML semantics: section/h1/p/button/nav tag selection
  ✅ Text replacement: substitute copyrighted copy with placeholders or user-supplied text
  ✅ Interaction model: confirm the spec's heuristic guess, then build for the real model
  ✅ Interactions: implement every state in the spec (hover/focus/active/open), click handlers
  ❌ Do NOT modify SCSS CSS values (use clone-to-scss.js output as-is)
  ❌ Do NOT write CSS directly in <style> blocks
  ❌ Do NOT use vw/clamp/@media or create custom mixins in Phase 3A/3B
  ❌ Do NOT hotlink remote URLs — all assets must use local public/images/ paths
```

---

## Phase 4: Compile Gate

```
No round cap. Loop until compile succeeds (or stuck → ask user).

0. Capture baseline (before Phase 3): record existing tsc + build errors
   → Phase 4 only fixes NEW errors

1. TypeScript: vue-tsc / svelte-check / tsc --noEmit
2. Build: npm run build (120s timeout)
3. Dev server: npm run dev → detect port → polling

On error: parse → auto-fix → re-check
Termination:
  ✅ Success: all checks pass → enter Phase 5
  ⚠️ Stuck: same errors as previous round → ask user
     1. Direct fix instructions → retry
     2. "proceed" — record remaining errors as TODO, proceed to Phase 5
     3. "abort" — halt
  ultrawork mode: on stuck, record TODO without prompting and proceed

⛔ Must enter Phase 5 after Phase 4 passes. Do NOT output a "completion summary".
```

---

## Phase 5: Pixel Verification Loop ← MANDATORY

**⛔ Phase 5 is mandatory, not optional. Enter automatically after Phase 4.**
**⛔ Skipping Phase 5 makes the entire clone "incomplete".**

```
No round cap. Loop until P1=0 (or stuck → ask user).
Infrastructure: src/infra/lib/browser/ (Puppeteer + CDP) — same as figma Phase 6.

1. Render scaffolded page in dev server at matching viewport
2. Capture screenshot → pixelmatch comparison against /tmp/{feature}/{bp}/screenshot.png
   diffRatio > 0.05 (clone target is tighter than figma) → P1
3. CSS comparison: live computed CSS vs /tmp/{feature}/{bp}/computed.json
   delta > 2px → P1, ≤ 2px → P2
4. Asset audit: every <img>/background-image resolves to local public/images/ path → else P1
5. Fix P1 first (refer to computed.json, no guessing) → revalidate compile → reload

Narrowing scope:
  Round 1: P1+P2+P3
  Round 2: P1+P2
  Round 3+: P1 only

Termination:
  ✅ P1=0 AND no new findings → complete
  ⚠️ Stuck: same findings → ask user (resolve / proceed / abort)
  ultrawork mode: on stuck, record TODO without prompting and complete

Responsive: after MO verification → change viewport → repeat against PC screenshot
Cleanup: shut down browser + dev server

⛔ "Completion summary" output only allowed after Phase 5 completes.
```

---

## Legal & Ethical Notes

```
This skill is intended for:
  ✅ "Clone coding" learning exercises (markup/layout study)
  ✅ Rebuilding the user's own previously-deployed sites
  ✅ Authorized redesigns where the user has rights to the source

NOT intended for:
  ❌ Republishing copyrighted content (text, images, logos) without permission
  ❌ Deceptive look-alike sites (phishing, brand impersonation)
  ❌ Bypassing robots.txt or rate-limiting protections

Claude must:
  - Replace copyrighted text content with placeholders (e.g. "[Lorem ipsum]") by default
  - Skip and warn when robots.txt disallows fetching the target path
  - Refuse if the user's stated intent is brand impersonation or deception
```

---

## Error Recovery

| Failure | Recovery |
|---------|----------|
| clone-extract.js Puppeteer launch failure | Verify Node ≥18 and that Chromium is installed (`npx puppeteer browsers install chrome`). Retry once. |
| Target site blocks headless (403/Cloudflare) | Retry with `--stealth` flag (uses puppeteer-extra stealth plugin). If still blocked, report to user. |
| Asset download 404 | Log to asset-map.json with `status: missing`. Use a 1×1 transparent placeholder. Continue. |
| robots.txt disallows path | Halt Phase 1. Inform user; require explicit `--ignore-robots` flag to proceed. |
| clone-refine.js produces empty sections | Site likely uses Shadow DOM or canvas rendering. Report and ask whether to fall back to screenshot-only mode. |
| Pixel diff stuck > 0.05 after 5 rounds | Likely font fallback or anti-aliasing. Report metric, allow user to accept threshold. |
| Interaction model guess wrong (Phase 5) | section.interaction is a static-DOM heuristic. Re-observe the live site, correct the model in the spec, rebuild the section for the confirmed model. |
| states.json empty but site has hover/tabs | States may be set via inline JS, not CSS rules. Note in the spec and capture them manually from the live site during Phase 5. |
