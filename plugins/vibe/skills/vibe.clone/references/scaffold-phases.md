# Clone — Phase 3A/3B/3C Builder Contract

> Loaded by vibe.clone SKILL.md Phase 3 (Scaffold) — full prep/dispatch/merge steps for MO/PC scaffold, the 150-line split rule, framework mapping, Phase 3C's import-switch/selector-review steps, and Claude's role checklist. Phase headers, Input lines, and script invocation commands stay in SKILL.md; this file covers the supporting detail only.

```
  Prep (sequential, once):
    a. Step 0: clone-spec.js → emit _specs/mo/{Section}.spec.md for every section
    b. Step A: clone-to-scss.js → SCSS draft in styles/{feature}/mo/ (computed values)
    c. Orchestrator resolves every spec TODO BEFORE dispatch:
       ├─ Confirm the interaction model (spec.interaction is a heuristic guess;
       │  the spec's active-capture "Dynamic behaviors" block overrides it on conflict)
       ├─ List the states to implement (spec.states + Dynamic behaviors)
       ├─ Mark copyrighted text for placeholder replacement (skip with --real-content)
       └─ Map component candidates against component-index.json (reuse vs create)
    d. 150-line split rule (mechanical — wc -l, don't override with "but it's related"):
       a completed spec over 150 lines means the section is too big for one builder →
       split into sub-component specs (one per card variant / repeated pattern) + one
       wrapper spec that imports them.
  Dispatch (parallel):
    ⛔ Every builder prompt embeds the FULL spec text INLINE — never "go read the file".
       The spec file stays on disk as the audit trail; the prompt must be self-sufficient.
    ⛔ Builders that write files in parallel run in worktree isolation; sub-component
       builders complete before their wrapper builder starts.
    Builder contract (each agent):
      1. Build HTML structure + semantic tags + framework-specific component file
         ⛔ No CSS in <style> blocks — only @import/@use of styles/{feature}/mo/
         ⛔ Build for the CONFIRMED interaction model in the spec; wire every state
         Framework mapping:
           - React/Next → .tsx with CSS Modules or styled-components per stack
           - Vue/Nuxt   → .vue with scoped <style lang="scss"> @import only
           - Svelte     → .svelte with <style> @import only
           - Vanilla    → .html + linked .scss
      2. Asset references → public/images/{feature}/ (already populated in Phase 1)
      3. SCSS edits per Immutable Rule 1 (evidence-cited only)
      4. Verify compile (tsc --noEmit or stack equivalent) before finishing
  Merge (orchestrator, as builders complete):
    5. Merge worktrees; resolve conflicts (you have full context on every spec)
    6. clone-validate.js per section — Step B
       ├─ PASS → section done
       └─ FAIL → fix discrepancies → re-run step 6 (loop until P1=0, no round cap)

  2. Switch component style imports from styles/{feature}/{bp}/index.scss to the merged
     styles/{feature}/index.scss
  3. Review pc-only/mo-only selectors in the merge report — hide/show them with the
     media query if the original does (evidence: the two sections.json trees)

Claude's role:
  ✅ Component candidates: decide which patterns become reusable components
  ✅ HTML semantics: section/h1/p/button/nav tag selection
  ✅ Text replacement: substitute copyrighted copy with placeholders or user-supplied text
  ✅ Interaction model: confirm the spec's heuristic guess, then build for the real model
  ✅ Interactions: implement every state in the spec (hover/focus/active/open), click handlers
  ✅ SCSS value edits WITH cited evidence (computed.json/states.json/behaviors.json) —
     clone-validate.js PASS is the judge
  ❌ Do NOT invent CSS values without extraction evidence
  ❌ Do NOT write CSS directly in <style> blocks
  ❌ Do NOT hand-write vw/clamp/@media in Phase 3A/3B (responsive comes from Phase 3C merge)
  ❌ Do NOT hotlink remote URLs — all assets must use local public/images/ paths
```
