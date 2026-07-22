---
name: vibe.design-refine
user-invocable: true
invocation: [command, auto]
tier: standard
description: "Design refinement — distill (remove visual complexity), normalize (hardcoded values → design tokens), polish (pre-ship micro-details). Modifying passes. Use when design-refine, design-polish, design-normalize, token-align, simplify-ui, ship-ready."
triggers: [design-refine, design-polish, design-normalize, token-align, design-distill, simplify-ui, ship-ready]
priority: 50
---

# Design Refine — Distill / Normalize / Polish

Modifying design-improvement passes. Mode selected by the first argument; default runs the full pipeline in order: **distill → normalize → polish**.

## Usage

```
/design-refine <target>            # Full pipeline (distill → normalize → polish)
/design-refine distill <target>    # Remove visual complexity only
/design-refine normalize <target>  # Token alignment only
/design-refine polish <target>     # Pre-ship final pass only
/design-refine .                   # Refine all changed UI files
```

---

## Mode: distill — Remove Visual Complexity

Every remaining element must justify its existence: **if it doesn't help the user complete their task, remove it.**

### Targets

1. **Decorative clutter** — purposeless gradients/patterns/textures, dividers between already-spaced sections, ornamental icons, stacked borders/shadows on nested containers
2. **Redundant information** — headings repeating page title/parent context, labels duplicating placeholders, "Welcome to {App}" banners, descriptions restating the obvious
3. **Over-wrapped containers** — cards wrapping a single element, nested cards, cosmetic-only wrapper divs, single-child sections
4. **Excessive animation** — entry animations on every element, hover effects on non-interactive elements, transitions > 300ms for feedback, parallax on content pages
5. **Progressive disclosure opportunities** — 10+ visible form fields → steps; flat settings → grouped collapsibles; 8+ nav items → categories; all-metrics dashboards → top 3 + expand

### Principles

| Principle | Question |
|-----------|----------|
| Purpose | Does this help the user complete a task? |
| Duplication | Is this information already on screen? |
| Cognitive load | Would removal reduce decision fatigue? |
| Visual weight | Does this compete with more important content? |
| Progressive disclosure | Can this be hidden until needed? |

Before removing: verify functionality survives, check semantic meaning, confirm signal-to-noise improves. Preserve brand-expressive elements (per `brand.personality`); calibrate aggressiveness by `aesthetic.style` (minimal → aggressive, bold → lenient).

---

## Mode: normalize — Design Token Alignment

Replace hardcoded design values with tokens. Naming conventions: `rubrics/token-naming.md`.

### Process

1. **Load token source** (priority): `.vibe/design-system/{project}/MASTER.md` → `.vibe/design-context.json` → default detection (with prompt: "Run `/design-teach` or create MASTER.md first")
2. **Scan for hardcoded values**:

   | Category | Pattern | Example |
   |----------|---------|---------|
   | Colors | hex, `rgb()`, `hsl()` | `#3B82F6` → `var(--color-primary)` |
   | Typography | `font-size`, `font-weight` | `14px` → `var(--text-sm)` |
   | Spacing | `margin`/`padding`/`gap` px | `16px` → `var(--space-4)` |
   | Shadows | inline `box-shadow` | → `var(--shadow-sm)` |
   | Border radius | `border-radius: 8px` | → `var(--radius-md)` |

3. **Map to tokens**: exact match → replace; close match (within 2px / similar hue) → replace + note; no match → flag for manual review (may need new token)
4. **Apply**, preserving: `/* intentional */` one-offs, animation keyframes, SVG path data, third-party overrides

Use `detectedStack.styling` to pick token format (CSS vars, Tailwind, etc.). New-token suggestions go to MASTER.md, then re-run.

---

## Mode: polish — Pre-Ship Final Pass

Last-mile pixel-level check with **direct fixes**. Detailed pass/fail criteria: `rubrics/polish-checklist.md`.

### Checklist

1. **Alignment & spacing** — 4/8px grid, section rhythm, baselines across columns, icons vertically centered with text, symmetric container padding
2. **Interaction states (complete set)** — Default / Hover / Focus (visible ring) / Active / Disabled (`aria-disabled` + reduced opacity) / Loading / Error / Success
3. **Typography & copy** — no orphaned words, consistent capitalization, no placeholder text, ellipsis truncation, line length ≤ 75ch
4. **Visual consistency** — border radius per level, shadow matches elevation, icon sizes (16/20/24), semantic color usage
5. **Cleanup** — no `console.log`, no commented-out JSX/HTML, no `z-index` > 100 undocumented, no inline styles that should be tokens, no dead CSS

### Auto-Fix Rules

| Issue | Fix |
|-------|-----|
| Missing hover / focus / disabled state | Add using existing tokens (`focus-visible` outline, reduced-opacity disabled) |
| Inconsistent border radius | Normalize to nearest token |
| Inline color values | Replace with CSS variable |
| `console.log` / commented-out code | Remove |

Only auto-fix items with clear, safe remediation — ambiguous items are flagged for manual review. Re-verify fixed files pass the checklist.

---

## Preparation (all modes)

1. **Read** `.vibe/design-context.json`
   - Missing → display "Run `/design-teach` first for better results" → proceed with defaults
   - Parse error → warn → proceed with defaults → recommend `/design-teach`
2. **Read** `.vibe/design-system/*/MASTER.md` (if exists) as authoritative token source

## Output Format

```markdown
## Design Refine: {target} (mode: {distill|normalize|polish|full})

### Changed
- ✂️ {file}:{line} — removed decorative gradient (distill)
- 🔄 {file}:{line} — #3B82F6 → var(--color-primary), confidence: exact (normalize)
- ✅ {file}:{line} — added hover state to submit button (polish)

### Manual Review Needed
- ⚠️ {file}:{line} — no matching token / layout choice / missing loading state

### Summary
- Reviewed: {N} · Changed: {N} · New tokens suggested: {N} · Manual review: {N}
- Ship-ready: {yes/no}
```

Report templates: `templates/polish-report.md` · `templates/token-audit.md` · `templates/design-system.md`.

## Next Steps

| If Result Shows | Recommended Next |
|----------------|-----------------|
| New tokens suggested | Add to MASTER.md → re-run `/design-refine normalize` |
| Broad quality concerns | `/design-review` — audit + UX critique |
| All items pass | Ship ready |

## Important

- **Modifying**: applies changes directly (conservative — safe items only; removals listed for easy revert).
- **Pairs with**: `/design-review` first for findings, then `/design-refine` to fix.
