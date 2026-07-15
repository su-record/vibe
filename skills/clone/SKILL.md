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
   ✅ clone-to-scss.js output is a DRAFT (skeleton), not a frozen artifact. You MAY
      rewrite SCSS values/selectors — but ONLY with evidence cited from computed.json /
      states.json / behaviors.json (value correction, dedupe, selector restructuring).
   ✅ clone-validate.js PASS is the sole judge of value correctness — not self-report.
   ❌ Do NOT invent values with no extraction evidence ("looks like 18px" is forbidden).
   ❌ Do NOT write CSS values directly inside scoped <style> blocks — style LOCATION
      rule: all values live in styles/{feature}/ SCSS (value authority and style
      location are separate rules; both hold).

2. Do NOT hotlink remote assets. All images/fonts must be downloaded and rewritten.

3. Do NOT skip the pixel verification loop (Phase 5). The clone is incomplete without it.

4. Do NOT copy textual content verbatim from copyrighted sources for production use.
   This skill is for layout/markup learning ("클론 코딩"). Replace text with placeholders
   or user-provided copy when shipping a real product.
   Exception: `--real-content` — the user confirms (once, explicitly) they own the site
   or have permission. Then keep text verbatim; clone-spec.js is invoked with
   `--real-content` so specs mark copy as verbatim.

5. Do NOT build a section without confirming its interaction model. The model in
   sections.json is a static-DOM heuristic — verify scroll-driven vs click-driven vs
   time-driven vs hover against the live site. Misidentifying it is the #1 clone failure mode.

6. Do NOT ship default-state-only. Implement every harvested state (hover/focus/active/open/
   tab-switch) from states.json / the section spec.

7. Do NOT ignore behaviors.json. The ACTIVE interaction sweep (scroll-state diffs,
   click-driven tab content-swap detection, hover diffs, in-view entrance animations,
   time-driven mutation candidates, smooth-scroll-lib detection) catches JS-set state
   that static CSS harvesting is blind to. When the spec's "Dynamic behaviors" block
   conflicts with the static interaction heuristic, the active capture wins.
```

## Full Flow

```
Input: a URL (or multiple URLs for multi-page clones)

→ Phase 0: Setup (stack detection, feature naming, working dir)
→ Phase 1: Capture (Puppeteer → rendered HTML + computed CSS + screenshots + assets)
→ Phase 2: Refine (DOM → sections.json per breakpoint; + interaction model + states)
→ Phase 2.5: Foundation (fonts / favicon / OG / SVG icons — sequential, before any section)
→ Phase 3: Scaffold (spec gate → SCSS draft + builder dispatch, parallel per section)
→ Phase 3C: Responsive merge (clone-merge-responsive.js — mobile-first @media)
→ Phase 4: Compile gate
→ Phase 5: Pixel verification loop (BOTH viewports after merge)
```

> Read `references/setup-and-layout.md` for the working-directory layout and code-output paths.

---

## Phase 0: Setup

> Read `references/setup-and-layout.md` for the full Phase 0 setup steps (stack detection, feature naming, directories, component indexing, design token scan).

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

> Read `references/capture-rules.md` for the full per-breakpoint output directory listing and the deterministic capture rule set (networkidle wait, asset resolution, states/behaviors harvesting, SEO asset harvest).

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

> Read `references/refine-rules.md` for the full refinement rule set and the sections.json output schema.

---

## Phase 2.5: Foundation ← sequential, BEFORE any section build

Nothing renders right until the foundation exists. Do this yourself (not delegated) — it
touches shared files:

```
1. Fonts: verify _base.scss @font-face srcs point at downloaded assets/fonts/ files.
   Next.js stack → wire via next/font/local in the layout instead of raw @font-face.
2. Favicon / OG / manifest: copy assets/seo/* → public/ (project convention path),
   wire metadata (layout.tsx metadata / <head>) to the local files.
3. SVG icons: collect inline <svg> from rendered.html, dedupe by path data,
   emit one stack-appropriate icon module (e.g. components/{feature}/icons.tsx).
   Name by visual function (SearchIcon, ArrowRightIcon, LogoIcon).
4. Global behaviors from behaviors.json: scrollLib detected → install/wire page-level
   (Lenis etc.); global keyframes/scroll-snap → styles/{feature}/_shared.scss.
5. Verify: compile passes before moving on.
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
  --out=/path/to/project/components/{feature}/_specs/{bp}/ \
  --feature={feature} [--real-content]

# Step A: Auto-generate SCSS draft (run once per BP — note the per-BP out dir)
node {{VIBE_PATH}}/hooks/scripts/clone-to-scss.js \
  /tmp/{feature}/{bp}/sections.json \
  --out=/path/to/project/styles/{feature}/{bp}/ \
  --token-file=/tmp/{feature}/project-tokens.json

# Step B: Per-section validation (after writing each section's component code)
node {{VIBE_PATH}}/hooks/scripts/clone-validate.js \
  /path/to/project/styles/{feature}/{bp}/ \
  /tmp/{feature}/{bp}/sections.json \
  --section={SectionName}
```

⛔ **No section is built without a completed spec.** Step 0 emits `_specs/{Section}.spec.md`
   (interaction model + **active-capture Dynamic behaviors** (scroll/tab/hover/in-view/
   time-driven/scroll-lib) + states + computed CSS + assets + text + checklist).
   clone-spec.js auto-loads `behaviors.json` from the sections.json dir and attaches matching
   behaviors per section. Before dispatching a section's builder, Claude reviews its spec and
   resolves every `TODO` (confirm interaction model, list states to implement, choose tags,
   replace copyrighted text — skipped with --real-content). The spec is the contract AND the
   audit trail — it forces extraction rigor before any code is written.
⛔ **clone-to-scss.js must run first (Step A) — its output is the DRAFT every section starts
   from.** After that, SCSS edits are allowed per Immutable Rule 1 (evidence-cited only);
   clone-validate.js PASS is the judge.
⛔ **Do NOT write custom SCSS / spec generation scripts.**
⛔ **Do NOT proceed past a section without a clone-validate.js PASS for it.**

Phase 3A: MO Scaffold — parallel builder dispatch
  Input: /tmp/{feature}/mo/sections.json
  → Phase 4 (MO compile) → Phase 5 (MO pixel verification)

Phase 3B: PC Scaffold
  Same process as MO, input /tmp/{feature}/pc/sections.json → styles/{feature}/pc/
  → Phase 4 (PC compile) → Phase 5 (PC pixel verification)

Phase 3C: Responsive Integration (after both MO+PC pass Phase 5)
  1. node {{VIBE_PATH}}/hooks/scripts/clone-merge-responsive.js \
       --mo=/path/to/project/styles/{feature}/mo/ \
       --pc=/path/to/project/styles/{feature}/pc/ \
       --out=/path/to/project/styles/{feature}/ \
       [--breakpoint=1024]
     → mobile-first merge: MO declarations = base, PC diffs → @media (min-width) block
  → Phase 4 (compile) → Phase 5 at BOTH viewports against each BP's screenshot.
     ⛔ The clone is NOT complete until the MERGED build passes Phase 5 at both.
```

> Read `references/scaffold-phases.md` for the full Phase 3A prep/dispatch/merge builder contract (framework mapping, 150-line split rule, clone-validate.js PASS/FAIL loop detail), Phase 3C steps 2–3 (import switch, pc-only/mo-only selector review), and Claude's role checklist.

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
Post-merge (Phase 3C): re-run at BOTH viewports (375×812 vs mo/screenshot.png,
  1440×900 vs pc/screenshot.png) — either failing means the merge regressed; fix the
  merged SCSS (evidence: the per-BP sections.json), never by re-guessing values
Cleanup: shut down browser + dev server

⛔ "Completion summary" output only allowed after Phase 5 completes.
```

---

## Legal, Ethical & Error Recovery Reference

> Read `references/legal-and-error-recovery.md` for the full legal/ethical usage notes (intended use, prohibited use, --real-content flow) and the Error Recovery troubleshooting table.
