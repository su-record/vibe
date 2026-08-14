# Clone — Phase Commands (BLOCKING)

> Loaded by vibe.clone SKILL.md Phases 1 / 2 / 3 / 3C. These are the **only** sanctioned
> commands for each phase. `{{VIBE_PATH}}` is substituted at install time.

## Global prohibitions

```
⛔ Writing custom capture/refine/SCSS/spec scripts (puppeteer-fetch.mjs, ad-hoc parsers) is forbidden.
⛔ Do NOT use WebFetch or curl for capture — they cannot render JS-driven SPAs.
⛔ Do NOT parse rendered.html with custom Python/Node scripts.
✅ Use the bundled scripts. If output is unsatisfactory, modify the script — not the workflow.
```

## Phase 1: Capture

Coordinator pattern — run MO/PC capture as parallel workers.

```bash
# Mobile (375×812)
node {{VIBE_PATH}}/hooks/scripts/clone-extract.js capture <URL> \
  --out=/tmp/{feature}/mo/ --viewport=375x812 --bp=mo

# Desktop (1440×900)
node {{VIBE_PATH}}/hooks/scripts/clone-extract.js capture <URL> \
  --out=/tmp/{feature}/pc/ --viewport=1440x900 --bp=pc

# --sub URL expansion (Phase 0, once)
node {{VIBE_PATH}}/hooks/scripts/clone-extract.js suburls <url> \
  --out=/tmp/{feature}/menu-urls.json [--ignore-robots]
```

`--sub` collection rule: prefer `/sitemap`, else header/nav/mega-menu. Include same-origin URLs
sharing the locale prefix. Exclude external links, language switchers, search, TOP, and footer
policy/contact/partner/newsroom links.

## Phase 2: Refine

```bash
# MO  (--states is optional — auto-resolved as states.json next to computed.json)
node {{VIBE_PATH}}/hooks/scripts/clone-refine.js \
  /tmp/{feature}/mo/rendered.html /tmp/{feature}/mo/computed.json \
  --out=/tmp/{feature}/mo/sections.json --states=/tmp/{feature}/mo/states.json --bp=mo

# PC
node {{VIBE_PATH}}/hooks/scripts/clone-refine.js \
  /tmp/{feature}/pc/rendered.html /tmp/{feature}/pc/computed.json \
  --out=/tmp/{feature}/pc/sections.json --states=/tmp/{feature}/pc/states.json --bp=pc
```

⛔ Phase 3 is blocked until refine completes for **all** required BPs.

## Phase 3: Scaffold

```bash
# Step 0: per-section build-contract specs (once per BP)
node {{VIBE_PATH}}/hooks/scripts/clone-spec.js \
  /tmp/{feature}/{bp}/sections.json \
  --out=<project>/components/{feature}/_specs/{bp}/ \
  --feature={feature} [--real-content]

# Step A: SCSS draft (once per BP — note the per-BP out dir)
node {{VIBE_PATH}}/hooks/scripts/clone-to-scss.js \
  /tmp/{feature}/{bp}/sections.json \
  --out=<project>/styles/{feature}/{bp}/ \
  --token-file=/tmp/{feature}/project-tokens.json

# Step B: per-section validation (after writing each section's component code)
node {{VIBE_PATH}}/hooks/scripts/clone-validate.js \
  <project>/styles/{feature}/{bp}/ /tmp/{feature}/{bp}/sections.json --section={SectionName}
```

Gate rules:

- ⛔ **No section is built without a completed spec.** Step 0 emits `_specs/{Section}.spec.md`
  (interaction model + active-capture Dynamic behaviors + states + computed CSS + assets + text +
  checklist). clone-spec.js auto-loads `behaviors.json` from the sections.json dir and attaches
  matching behaviors per section. Before dispatching a section's builder, review its spec and
  resolve every `TODO` (confirm interaction model, list states, choose tags, replace copyrighted
  text — skipped with `--real-content`). The spec is the contract **and** the audit trail.
- ⛔ **Step A must run first** — its output is the DRAFT every section starts from. Later SCSS
  edits are allowed per Immutable Rule 1 (evidence-cited only); clone-validate.js PASS is the judge.
- ⛔ **Do NOT proceed past a section without a clone-validate.js PASS for it.**
- Spec over 150 lines → split into sub-component specs (mechanical check: `wc -l`).

Order: Phase 3A (MO scaffold → Phase 4 → Phase 5) → Phase 3B (PC, same process) → Phase 3C.

## Phase 3C: Responsive Merge

Runs only after **both** MO and PC pass Phase 5.

```bash
node {{VIBE_PATH}}/hooks/scripts/clone-merge-responsive.js \
  --mo=<project>/styles/{feature}/mo/ \
  --pc=<project>/styles/{feature}/pc/ \
  --out=<project>/styles/{feature}/ [--breakpoint=1024]
```

Mobile-first merge: MO declarations become the base, PC diffs go into a `@media (min-width)` block.
Then switch component imports to the merged `index.scss` and re-run Phase 4 → Phase 5 at **both**
viewports. ⛔ The clone is NOT complete until the MERGED build passes Phase 5 at both.

## Phase 2.5: Foundation (no script — do this yourself)

Nothing renders right until the foundation exists. Not delegated — it touches shared files.

```
1. Fonts: verify _base.scss @font-face srcs point at downloaded assets/fonts/ files.
   Next.js stack → wire via next/font/local in the layout instead of raw @font-face.
2. Favicon / OG / manifest: copy assets/seo/* → public/ (project convention path),
   wire metadata (layout.tsx metadata / <head>) to the local files.
3. SVG icons: collect inline <svg> from rendered.html, dedupe by path data, emit one
   stack-appropriate icon module (e.g. components/{feature}/icons.tsx).
   Name by visual function (SearchIcon, ArrowRightIcon, LogoIcon).
4. Global behaviors from behaviors.json: scrollLib detected → install/wire page-level
   (Lenis etc.); global keyframes/scroll-snap → styles/{feature}/_shared.scss.
5. Verify: compile passes before moving on.
```
