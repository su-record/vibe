# Analysis Dimensions — Figma Design Analysis

> This skill is merged into vibe-figma (Phase 1: Storyboard). These dimensions guide what to extract and evaluate when reading Figma frames.

## Layout

- [ ] Overall page structure — single column, multi-column, grid, or free-form absolute
- [ ] Section boundaries — identify where each distinct section starts/ends by visual grouping
- [ ] Container width — fixed px vs fluid (100%)
- [ ] Alignment system — centered, left-aligned, or asymmetric
- [ ] Z-layering — how many stacked layers exist (BG/content/overlay count)
- [ ] Overflow behavior — clip, hidden, visible, scroll

## Spacing Consistency

- [ ] Gap between sections — does a single spacing value repeat, or is each unique?
- [ ] Internal component padding — consistent across card variants?
- [ ] Icon-to-text gap — uniform within a component family?
- [ ] Recurring values — list values that appear 3+ times (these become spacing tokens)
- [ ] Irregular values — flag one-off spacings that may indicate design inconsistency

## Color Usage

- [ ] Background palette — how many distinct background colors exist?
- [ ] Text color roles — identify heading / body / label / disabled colors separately
- [ ] Accent/brand colors — primary CTA color, hover state color
- [ ] Transparency usage — rgba overlays, opacity layers
- [ ] Blend modes present — `mix-blend-lighten`, `multiply`, `hue` flag a literal-mode section
- [ ] Dark/light variants — does the design have both, requiring CSS variable tokens?

## Typography Hierarchy

- [ ] H1 equivalent — largest display text, font-size + weight + role
- [ ] H2 / section heading — size, weight, color
- [ ] Body text — base size, line-height, color
- [ ] Caption / label text — smallest size, usage context
- [ ] Font families — how many distinct families? Any variable fonts?
- [ ] Responsive scaling — does font-size change across breakpoints?

## Component Inventory

- [ ] Repeating UI patterns — cards, list items, tabs (candidates for `v-for`)
- [ ] State variants — default, hover, active, disabled, selected (note which states exist)
- [ ] Shared components — GNB, Footer, Popup (already in project or needs creation?)
- [ ] Interactive elements — buttons, links, inputs, toggles
- [ ] Decorative elements — particles, background shapes, overlay effects

## Storyboard-Specific Dimensions

- [ ] Frame classification — SPEC, CONFIG, SHARED, PAGE (by name pattern)
- [ ] Interaction annotations — arrows, overlay connections, state transitions in Figma
- [ ] Section count — total PAGE frames that need components
- [ ] Tall frames (1500px+) — flag for split strategy before `get_design_context`
