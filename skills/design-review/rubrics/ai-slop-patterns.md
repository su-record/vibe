# AI Slop Detection — Pattern Reference

Patterns that indicate AI-generated defaults rather than deliberate design decisions. Each entry describes the visual signature and why it signals slop.

---

## Pattern 1: Cyan/Neon-on-Dark Accent

**Visual signature**: Electric cyan (`#00D8FF`, `#22D3EE`) or neon green/purple as the sole accent color on a dark gray or near-black background. Often applied to buttons, badges, and chart lines simultaneously.

**Why it's slop**: This palette is the default "tech/SaaS" output for most AI image and code generators. It signals no brand research was done.

**Legitimate exception**: Cyberpunk-themed games, developer tools with a deliberate retro-terminal aesthetic, or products with documented brand guidelines using these colors.

---

## Pattern 2: Purple-to-Blue Gradient Hero

**Visual signature**: A full-bleed hero section or page background using a diagonal or radial gradient from `#7C3AED` (purple) to `#2563EB` (blue). Often combined with white or light text and a "glow" effect.

**Why it's slop**: The most overused AI-generated hero background across all categories and industries. Applied without regard for brand personality.

**Legitimate exception**: Brand explicitly uses purple and blue as primary colors with documented rationale.

---

## Pattern 3: Hero Metric Template

**Visual signature**: An oversized number (60–80px font, often bold or gradient-colored) with a tiny label below it (`"Active Users"`, `"Revenue"`, `"Uptime"`). Three or four of these arranged in a row as the primary dashboard view.

**Why it's slop**: It's a structural template, not a data visualization decision. Used regardless of whether the numbers are meaningful or whether the user needs them front and center.

**Legitimate exception**: Real-time operational dashboards where these metrics are the primary user task.

---

## Pattern 4: Identical 3-Up Card Grid

**Visual signature**: Exactly three cards in a horizontal row, each containing an icon (top-left or centered), a short bold title, and 1–2 lines of description text. Repeated verbatim as a features section, benefits section, or team section.

**Why it's slop**: The 3-up grid is the default content-filling pattern for every AI-generated landing page. It imposes a visual structure regardless of whether the content benefits from comparison.

**Legitimate exception**: Content is genuinely comparative (pricing tiers, product variants), or the grid contains more than 3 genuinely distinct items.

---

## Pattern 5: Default Glassmorphism

**Visual signature**: Cards and panels with `backdrop-filter: blur(12px)`, a semi-transparent white or colored background (`rgba(255,255,255,0.1)`), and a subtle border (`rgba(255,255,255,0.2)`). Applied as the primary surface treatment across all cards.

**Why it's slop**: Glassmorphism is a specific aesthetic that requires a layered background to function visually. AI applies it universally as a "modern" default, often on solid-color backgrounds where it produces no effect.

**Legitimate exception**: OS-style UIs, media applications with rich background imagery, or products where glass surfaces are part of a coherent aesthetic system.

---

## Pattern 6: Bounce/Elastic Functional Animation

**Visual signature**: UI elements that overshoot their final position with `cubic-bezier` bounce or spring easing during state transitions — modals sliding in with elastic overshoot, buttons that wobble on hover, list items that bounce into view.

**Why it's slop**: Bounce easing communicates playfulness. Applied to functional transitions (modals, form submissions, navigation) it creates a tonally inconsistent experience and feels unpolished in professional contexts.

**Legitimate exception**: Mobile games, children's apps, or products with an explicitly playful brand personality where the animation reinforces brand voice.

---

## Pattern 7: Inter/Roboto as Lazy Default

**Visual signature**: Inter or Roboto used as both heading and body font across a product with no visible typography hierarchy differentiation. No font scale customization — using default weights and sizes from the framework.

**Why it's slop**: These fonts are excellent but are chosen by AI because they are safe and system-default-adjacent. Font selection should reflect brand personality and audience expectations.

**Legitimate exception**: Products that have explicitly evaluated their font options and chosen Inter/Roboto for legibility, neutrality, or performance reasons — with documented rationale.

---

## Pattern 8: Gradient Text on Metrics/Statistics

**Visual signature**: Key numbers, statistics, or headings rendered with a linear gradient applied to the text itself (`background-clip: text; -webkit-text-fill-color: transparent`), typically the same purple-to-blue or cyan-to-blue range.

**Why it's slop**: Gradient text is visually noisy and reduces readability. It is applied wholesale by AI to make numbers "pop" without considering whether the visual effect serves the data's meaning.

**Legitimate exception**: Brand wordmarks, decorative headings where legibility is secondary to visual impact, or hero statements where the gradient is part of a consistent typographic system.
