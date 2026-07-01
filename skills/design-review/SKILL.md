---
name: design-review
user-invocable: true
invocation: [command, auto]
tier: standard
description: "Design quality review — technical audit (a11y, performance, responsive, theming, AI slop) + UX critique (Nielsen heuristics, persona red flags). Read-only report. Use when design-review, design-audit, ui-audit, a11y-check, ux-review."
triggers: [design-review, design-audit, ui-audit, a11y-check, design-critique, ux-review]
priority: 50
---

# Design Review — Technical Audit + UX Critique

Read-only design quality review. Two modes selected by the first argument. No code modifications — report only.

## Usage

```
/design-review <target>           # Both modes (audit + critique)
/design-review audit <target>     # Technical quality audit only
/design-review critique <target>  # UX critique only
/design-review .                  # Review all changed UI files
```

## Shared Scoring Scale (0–4)

| Score | Meaning |
|-------|---------|
| 0 | Violated / critical failures |
| 1 | Major issues — degraded experience |
| 2 | Moderate — functional but rough |
| 3 | Good — minor friction/polish only |
| 4 | Excellent — production ready |

Detailed per-level criteria: `rubrics/scoring.md` (audit) · `rubrics/ux-heuristics.md` (critique).

---

## Mode: audit — 5-Dimension Technical Quality

### 1. Accessibility (a11y)
- Interactive elements keyboard-reachable, visible focus indicator, focus order
- ARIA roles/labels on custom widgets; inputs linked to `<label>` or `aria-label`
- Color contrast ≥ 4.5:1 (text), ≥ 3:1 (large text, UI components)
- Meaningful `alt` text; `aria-live` for dynamic content; skip-to-content link

### 2. Performance
- Images: `loading="lazy"` below fold, `srcset`, WebP/AVIF
- Fonts: `font-display: swap`, ≤3 font files; no blocking scripts in `<head>`
- Route-level code-splitting; explicit media `width`/`height` (no layout shift); no duplicate deps

### 3. Responsive
- Mobile-first `min-width` breakpoints (or consistent direction); no horizontal scroll
- Touch targets ≥ 44×44px; typography scales (clamp or breakpoints)
- `@container` where component-level responsiveness needed; navigation adapts on mobile

### 4. Theming
- Colors/spacing/radius/shadows via design tokens (CSS custom properties, not hardcoded)
- Dark mode support or documented opt-out; variants via classes/data attributes, not inline styles

### 5. AI Slop Detection (full pattern list: `rubrics/ai-slop-patterns.md`)
- No cyan-on-dark / neon accents or purple-to-blue gradients without brand justification
- No hero-metric template, identical icon+title+description card grids, gradient text on stats
- No default glassmorphism, bounce/elastic easing on functional animations, lazy Inter/Roboto choice

### Severity Tagging

| Severity | Meaning | Example |
|----------|---------|---------|
| P0 | Blocker — breaks functionality | Missing focus trap on modal |
| P1 | Critical — significant UX impact | No keyboard navigation |
| P2 | Important — noticeable quality gap | Touch targets too small |
| P3 | Minor — polish opportunity | Inconsistent border radius |

Multi-agent orchestration (parallel dimension auditors): `orchestrator.md` + `agents/`. Frameworks: `frameworks/wcag-checklist.md`, `frameworks/core-web-vitals.md`.

---

## Mode: critique — UX Review

### Nielsen's 10 Heuristics (0–4 each; code-level evidence in `rubrics/ux-heuristics.md`)

| # | Heuristic | What to Check |
|---|-----------|---------------|
| H1 | Visibility of system status | Loading indicators, progress, state feedback |
| H2 | Match with real world | Natural language, familiar icons, logical groupings |
| H3 | User control and freedom | Undo/redo, cancel, exit paths |
| H4 | Consistency and standards | Same action = same pattern, platform conventions |
| H5 | Error prevention | Confirmations, input constraints, disabled states |
| H6 | Recognition over recall | Visible options, contextual help, breadcrumbs |
| H7 | Flexibility and efficiency | Shortcuts, defaults, power-user paths |
| H8 | Aesthetic and minimalist design | Signal-to-noise, essential info only |
| H9 | Error recognition and recovery | Clear messages, suggested fixes |
| H10 | Help and documentation | Tooltips, onboarding, contextual guidance |

### 5-Persona Red Flag Analysis

| Persona | Red-Flag Questions |
|---------|-------------------|
| Power User | Fast task completion? Shortcuts/bulk actions? Adequate density? |
| First-Time User | Obvious entry point? Primary task without docs? Progressive disclosure? |
| Accessibility-Dependent | Screen-reader navigation sane? Color not the only channel? Text resizable? |
| Stressed / Distracted | Easy mistake recovery? Destructive actions guarded? Critical info scannable? |
| Mobile-Only | Touch targets adequate? One-thumb reach? Minimal typing in forms? |

---

## Platform Adaptation

On mobile stacks (React Native, Flutter, iOS, Android): skip web-specific items (CSS variables, `@container`, `srcset`, `font-display`, breadcrumbs/URLs); evaluate against platform HIG / Material Design; adapt responsive checks (safe areas, orientation); focus on hierarchy, cognitive load, a11y, AI slop.

## Preparation

1. **Read** `.vibe/design-context.json`
   - Missing → display "Run `/design-teach` first for better results" → proceed with defaults
   - Parse error → warn → proceed with defaults → recommend `/design-teach`
   - Present → weight audit findings by `audience.context` / `constraints.accessibility` / `brand.personality`; adjust critique persona priorities by `audience.primary` / `audience.expertise`
2. **Read** `.vibe/design-system/*/MASTER.md` (if exists) for token reference

## Output Format

```markdown
## Design Review: {target} (mode: {audit|critique|both})

### Scores — | Dimension / Heuristic | Score | Key Issue | ... | **Overall N/M (NN%)** |
### Findings — audit: P0→P3 with {file}:{line} · critique: persona red flags 🔴🟡🟢
### Top Recommendations — priority-ordered actionable items
```

Full report templates: `templates/report.md` (audit) · `templates/critique-report.md` (critique).

## Next Steps

| If Result Shows | Recommended Next |
|----------------|-----------------|
| Visual complexity / clutter | `/design-refine distill` |
| Token / design-system inconsistencies | `/design-refine normalize` |
| Ship-ready or minor polish only | `/design-refine polish` |

## Important

- **Read-only**: produces a report. Does NOT modify code.
- **Context-aware**: weighted by `.vibe/design-context.json` when present.
- **Incremental**: on `.`, only reviews files in the current diff.
