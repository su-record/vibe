# Design Audit — Detailed Scoring Rubric

Each dimension scored 0–4. Score the lowest applicable level that matches observed issues.

---

## 1. Accessibility (a11y)

| Score | Criteria |
|-------|----------|
| **4** | All interactive elements keyboard-reachable; ARIA roles correct; contrast ≥ 4.5:1 everywhere; all images have meaningful alt text; every form input has a label; focus indicators visible; `aria-live` on dynamic regions; skip-to-content present |
| **3** | 1–2 minor issues: e.g., one icon missing `aria-label`, or skip link absent on a simple page |
| **2** | Multiple issues but no complete blockers: e.g., some form inputs unlabeled, focus order inconsistent in one section |
| **1** | Significant gaps: contrast failures on primary text, keyboard traps present, or no ARIA on custom widgets |
| **0** | Critical failures: interactive elements unreachable by keyboard, no contrast at all on key text, or screen reader produces nonsense navigation |

---

## 2. Performance

| Score | Criteria |
|-------|----------|
| **4** | All below-fold images lazy-loaded with `srcset` and modern formats; ≤3 font files with `font-display: swap`; critical CSS inlined; JS code-split at routes; no layout shift on media; no duplicate deps |
| **3** | 1–2 minor gaps: e.g., one non-critical image missing `loading="lazy"`, or a fourth font file loaded |
| **2** | Several issues: missing lazy load on multiple images, no `font-display`, or a blocking script in `<head>` |
| **1** | Major issues: no image optimization at all, large unneeded CSS framework fully loaded, or significant layout shifts |
| **0** | Critical: blocking JS on `<head>` delays render, images 5× larger than necessary, LCP asset entirely unoptimized |

---

## 3. Responsive

| Score | Criteria |
|-------|----------|
| **4** | Mobile-first breakpoints; all touch targets ≥ 44×44px; no horizontal scroll at any viewport; typography scales cleanly; container queries used where appropriate; navigation adapts correctly |
| **3** | 1–2 small gaps: e.g., one touch target slightly under 44px, or minor horizontal overflow on a niche breakpoint |
| **2** | Several issues: some touch targets too small, typography doesn't scale, navigation doesn't adapt on mobile |
| **1** | Layout broken at common breakpoints; horizontal scroll present; fixed-width elements causing overflow |
| **0** | Completely non-responsive: desktop layout forced on mobile, content unreadable at 375px |

---

## 4. Theming

| Score | Criteria |
|-------|----------|
| **4** | All colors via CSS custom properties; dark mode supported or explicitly opted out with documentation; spacing, radius, and shadows all use design tokens; component variants use data attributes or classes only |
| **3** | 1–3 hardcoded values in low-visibility areas; no inline styles on primary surfaces |
| **2** | Multiple hardcoded values scattered through components; some spacing arbitrary; dark mode partial or inconsistent |
| **1** | Most values hardcoded; design tokens exist but rarely used; inline styles prevalent |
| **0** | No token system; all values inline or in scattered magic numbers; dark mode completely absent if required |

---

## 5. AI Slop Detection

| Score | Criteria |
|-------|----------|
| **4** | No AI template patterns; color scheme, typography, and layout reflect deliberate brand choices; animations serve function; design feels intentional and specific to this product |
| **3** | 1 pattern present but with partial justification (e.g., gradient used sparingly, not as the dominant aesthetic) |
| **2** | 2–3 patterns present; design leans on AI defaults without clear brand rationale |
| **1** | 4–5 patterns present; the overall aesthetic is indistinguishable from generic AI-generated UI |
| **0** | Full AI slop template: neon/cyan accents, purple-blue gradient hero, glassmorphism cards, 3-up icon grids, Inter font, gradient metric text — all present simultaneously |
