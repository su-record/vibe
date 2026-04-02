---
name: design-audit
tier: standard
description: "Design technical quality audit — a11y, performance, responsive, theming, AI slop detection with 5-dimension scoring. Use when design-audit, ui-audit, a11y-check, design-check."
triggers: [design-audit, ui-audit, a11y-check, design-check]
priority: 50
---

# Design Audit — Technical Quality Inspection

Perform a read-only technical quality audit across 5 dimensions. No code modifications — report only.

## Usage

```
/design-audit <target>        # Audit specific component/page
/design-audit .               # Audit all changed UI files
```

## 5-Dimension Scoring

Each dimension scored 0–4:

| Score | Meaning |
|-------|---------|
| 0 | Critical failures — unusable |
| 1 | Major issues — degraded experience |
| 2 | Moderate issues — functional but rough |
| 3 | Minor issues — good with polish needed |
| 4 | Excellent — production ready |

### 1. Accessibility (a11y)

- [ ] All interactive elements keyboard-reachable (`tabIndex`, focus order)
- [ ] ARIA roles and labels on custom widgets
- [ ] Color contrast ≥ 4.5:1 (text), ≥ 3:1 (large text, UI components)
- [ ] Images have meaningful `alt` text (not "image" or filename)
- [ ] Form inputs linked to `<label>` or `aria-label`
- [ ] Focus indicator visible on all interactive elements
- [ ] Screen reader announcements for dynamic content (`aria-live`)
- [ ] Skip-to-content link present on pages with navigation

### 2. Performance

- [ ] Images: `loading="lazy"` on below-fold, `srcset` for responsive, WebP/AVIF formats
- [ ] Fonts: `font-display: swap`, subset if possible, ≤3 font files
- [ ] CSS: No unused large frameworks, critical CSS inlined or above-fold prioritized
- [ ] JS: Code-split at route level, no blocking scripts in `<head>`
- [ ] Layout shifts: Explicit `width`/`height` on media, skeleton placeholders
- [ ] Bundle: No duplicate dependencies, tree-shaking enabled

### 3. Responsive

- [ ] Breakpoints use `min-width` (mobile-first) or consistent direction
- [ ] Touch targets ≥ 44×44px on mobile
- [ ] No horizontal scroll at any breakpoint
- [ ] Typography scales appropriately (clamp or breakpoint-based)
- [ ] `@container` queries where component-level responsiveness needed
- [ ] Navigation adapts (hamburger, drawer, or tab bar on mobile)

### 4. Theming

- [ ] Colors use CSS custom properties (not hardcoded hex/rgb)
- [ ] Dark mode support or explicit opt-out documented
- [ ] Spacing uses design tokens (not arbitrary pixel values)
- [ ] Border radius, shadows consistent via tokens
- [ ] Component variants use data attributes or CSS classes, not inline styles

### 5. AI Slop Detection

- [ ] No cyan-on-dark or neon accent color schemes without brand justification
- [ ] No purple-to-blue gradient backgrounds as default aesthetic
- [ ] No hero metric template (oversized number + tiny label) without data purpose
- [ ] No identical card grids (3-up with icon + title + description)
- [ ] No glassmorphism applied as default surface treatment
- [ ] No bounce/elastic easing on functional animations
- [ ] No Inter/Roboto as lazy font choice (match brand personality instead)
- [ ] No gradient text on metrics or statistics

## Severity Tagging

| Severity | Meaning | Example |
|----------|---------|---------|
| P0 | Blocker — breaks functionality | Missing focus trap on modal |
| P1 | Critical — significant UX impact | No keyboard navigation |
| P2 | Important — noticeable quality gap | Touch targets too small |
| P3 | Minor — polish opportunity | Inconsistent border radius |

## Platform Adaptation

When running on mobile stacks (React Native, Flutter, iOS, Android):
- Skip web-specific items: CSS variables, `@container`, `srcset`, `font-display`
- Focus on: visual hierarchy, cognitive load, accessibility, AI slop detection
- Adapt responsive checks to platform conventions (safe areas, orientation)

## Output Format

```markdown
## Design Audit Report: {target}

### Scores
| Dimension | Score | Grade |
|-----------|-------|-------|
| Accessibility | 3/4 | Good |
| Performance | 2/4 | Moderate |
| Responsive | 4/4 | Excellent |
| Theming | 1/4 | Major Issues |
| AI Slop | 3/4 | Good |
| **Overall** | **13/20** | **65%** |

### Findings

#### P0 (Blocker)
- None

#### P1 (Critical)
- [A11Y] Modal missing focus trap — {file}:{line}
- [THEME] 12 hardcoded color values — should use CSS variables

#### P2 (Important)
- [PERF] Images without lazy loading — {file}:{line}

#### P3 (Minor)
- [SLOP] Purple-to-blue gradient matches AI template aesthetic

### Recommendations
1. {Priority-ordered actionable items}
```

## Preparation

Before running the audit:

1. **Read** `.claude/vibe/design-context.json`
   - If missing → display: "Run `/design-teach` first for better results" → proceed with defaults
   - If parse error → display warning → proceed with defaults → recommend `/design-teach`
   - If present → weight findings by `audience.context`, `constraints.accessibility`, `brand.personality`
2. **Read** `.claude/vibe/design-system/*/MASTER.md` (if exists) for token reference

## Next Steps

| If Result Shows | Recommended Next |
|----------------|-----------------|
| Design system inconsistencies | `/design-normalize` — align tokens |
| UX/usability concerns | `/design-critique` — deeper UX review |
| Ship-ready (score ≥ 16/20) | `/design-polish` — final micro-details |

## Important

- **Read-only**: This skill produces a report. It does NOT modify code.
- **Context-aware**: If `.claude/vibe/design-context.json` exists, findings are weighted by project brand and audience.
- **Incremental**: When run on `.` (changed files), only audits files in current diff.
