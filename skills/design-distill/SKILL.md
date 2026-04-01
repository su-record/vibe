---
name: design-distill
description: "Remove unnecessary visual complexity — strip decorative clutter, apply progressive disclosure, simplify UI to essentials. Use when design-distill, simplify-ui, ui-simplify, strip-ui."
triggers: [design-distill, simplify-ui, ui-simplify, strip-ui]
priority: 50
---

# Design Distill — Remove Visual Complexity

Strip unnecessary visual elements. Every remaining element must justify its existence. Applies the principle: **if it doesn't help the user complete their task, remove it.**

## Usage

```
/design-distill <target>      # Distill specific page/component
/design-distill .              # Distill all changed UI files
```

## What Gets Distilled

### 1. Decorative Clutter

- Gradient backgrounds that don't convey hierarchy
- Decorative dividers between already-spaced sections
- Background patterns or textures without purpose
- Ornamental icons (icons that don't aid comprehension)
- Excessive border/shadow stacking on nested containers

### 2. Redundant Information

- Headings that repeat the page title or parent context
- Labels that duplicate placeholder text
- "Welcome to {App}" banners on authenticated pages
- Empty state illustrations when a simple message suffices
- Descriptions restating what the UI element obviously does

### 3. Over-Wrapped Containers

- Cards wrapping single elements (card containing only a button)
- Nested cards (card inside card inside card)
- Wrapper divs with only cosmetic purpose
- Sections with only one child element

### 4. Excessive Animation

- Entry animations on every element (staggered fade-ins on list items)
- Hover animations on non-interactive elements
- Transitions > 300ms for feedback (feels sluggish)
- Parallax effects on content pages
- Decorative loading animations when a spinner suffices

### 5. Progressive Disclosure Opportunities

- Settings pages showing all options at once → group and collapse
- Forms with 10+ fields visible → break into steps
- Dashboards showing every metric → show top 3, expandable for rest
- Navigation with 8+ top-level items → group into categories

## Distillation Principles

| Principle | Question to Ask |
|-----------|----------------|
| **Purpose** | Does this element help the user complete a task? |
| **Duplication** | Is this information available elsewhere on screen? |
| **Cognitive load** | Would removing this reduce decision fatigue? |
| **Visual weight** | Does this element compete with more important content? |
| **Progressive disclosure** | Can this be hidden until needed? |

## Process

1. Read target files fully
2. Identify elements matching distillation categories
3. For each candidate:
   - Verify removal won't break functionality
   - Check if element carries semantic meaning
   - Confirm removal improves signal-to-noise ratio
4. Apply removals and simplifications
5. Report changes with before/after rationale

## Output Format

```markdown
## Design Distill: {target}

### Removed
- ✂️ {file}:{line} — Decorative gradient background (no hierarchy purpose)
- ✂️ {file}:{line} — Wrapper card around single button
- ✂️ {file}:{line} — Heading repeating parent page title

### Simplified
- 🔄 {file}:{line} — Collapsed 3 nested divs into 1 flex container
- 🔄 {file}:{line} — Replaced staggered animation with single fade-in

### Progressive Disclosure Applied
- 📦 {file}:{line} — Settings grouped into collapsible sections (was 15 flat options)

### Preserved (Justified)
- ✓ {file}:{line} — Decorative illustration on empty state (brand expression)

### Summary
- Elements reviewed: {N}
- Removed: {N}
- Simplified: {N}
- Progressive disclosure: {N}
- Net complexity reduction: {percentage}
```

## Preparation

Before running distillation:

1. **Read** `.claude/vibe/design-context.json`
   - If missing → display: "Run `/design-teach` first for better results" → proceed with defaults
   - If parse error → display warning → proceed with defaults → recommend `/design-teach`
   - If present → preserve elements that match `brand.personality` (e.g., "playful" brand may justify decorative elements)
2. Use `aesthetic.style` to calibrate aggressiveness (minimal → more aggressive, bold → more lenient)

## Next Steps

| If Result Shows | Recommended Next |
|----------------|-----------------|
| Elements removed/simplified | `/design-normalize` — align remaining tokens |
| Already minimal | `/design-polish` — final pre-ship pass |

## Important

- **Modifying**: Directly removes and simplifies identified elements.
- **Conservative**: Only removes elements that clearly don't serve user tasks. Brand-expressive elements preserved.
- **Reversible**: All removals listed in report for easy review and revert if needed.
