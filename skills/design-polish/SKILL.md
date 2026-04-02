---
name: design-polish
tier: standard
description: "Pre-ship final polish pass — pixel alignment, interaction states, micro-details check and auto-fix. Use when design-polish, ui-polish, final-pass, ship-ready."
triggers: [design-polish, ui-polish, final-pass, ship-ready]
priority: 50
---

# Design Polish — Pre-Ship Final Pass

Last-mile quality pass before shipping. Checks pixel-level details and **directly fixes** issues found.

## Usage

```
/design-polish <target>       # Polish specific component/page
/design-polish .              # Polish all changed UI files
```

## Checklist

### 1. Alignment & Spacing

- [ ] Elements align to consistent grid (4px or 8px base)
- [ ] Spacing between sections follows rhythm (not arbitrary gaps)
- [ ] Text baselines align across columns
- [ ] Icons vertically centered with adjacent text
- [ ] Padding inside containers is symmetric unless intentional

### 2. Interaction States (Complete Set)

Every interactive element must have ALL applicable states:

| State | Check |
|-------|-------|
| Default | Base appearance defined |
| Hover | Visual feedback on mouse enter |
| Focus | Visible focus ring (a11y requirement) |
| Active / Pressed | Visual response on click/tap |
| Disabled | Reduced opacity + `pointer-events: none` + `aria-disabled` |
| Loading | Spinner or skeleton replacing content |
| Error | Red/danger styling + error message |
| Success | Confirmation feedback (toast, checkmark, color change) |

### 3. Typography & Copy

- [ ] No orphaned words (single word on last line of heading)
- [ ] Consistent capitalization (Title Case vs sentence case)
- [ ] No placeholder text ("Lorem ipsum", "TODO", "test")
- [ ] Truncation with ellipsis where text can overflow
- [ ] Line length ≤ 75 characters for readability

### 4. Visual Consistency

- [ ] Border radius consistent across same-level elements
- [ ] Shadow depth matches elevation hierarchy
- [ ] Icon sizes consistent (16/20/24px common set)
- [ ] Color usage matches semantic meaning (red=error, green=success)

### 5. Cleanup

- [ ] No `console.log` statements
- [ ] No commented-out JSX/HTML
- [ ] No `z-index` values > 100 without documented reason
- [ ] No inline styles that should be classes/tokens
- [ ] No dead CSS classes

## Auto-Fix Rules

| Issue | Fix Action |
|-------|-----------|
| Missing hover state on button | Add hover style using existing token |
| Missing focus ring | Add `focus-visible` outline |
| Missing disabled state | Add disabled variant with reduced opacity |
| Inconsistent border radius | Normalize to nearest design token |
| Inline color values | Replace with CSS variable |
| `console.log` in UI files | Remove |
| Commented-out code | Remove |

## Process

1. Read target files fully
2. Run checklist against each file
3. Collect findings with file:line references
4. Apply auto-fixes for safe items
5. Report items requiring manual review
6. Re-verify fixed files pass checklist

## Output Format

```markdown
## Design Polish: {target}

### Auto-Fixed
- ✅ {file}:{line} — Added hover state to submit button
- ✅ {file}:{line} — Replaced #3B82F6 with var(--color-primary)
- ✅ {file}:{line} — Removed console.log

### Manual Review Needed
- ⚠️ {file}:{line} — Orphaned word in heading (layout choice)
- ⚠️ {file}:{line} — Missing loading state on async action

### Summary
- Items checked: {N}
- Auto-fixed: {N}
- Manual review: {N}
- Ship-ready: {yes/no}
```

## Preparation

Before running polish:

1. **Read** `.claude/vibe/design-context.json`
   - If missing → display: "Run `/design-teach` first for better results" → proceed with defaults
   - If parse error → display warning → proceed with defaults → recommend `/design-teach`
   - If present → apply brand-appropriate micro-interaction styles from `aesthetic.style`
2. **Read** `.claude/vibe/design-system/*/MASTER.md` (if exists) for token references

## Next Steps

| If Result Shows | Recommended Next |
|----------------|-----------------|
| All items pass | Ship ready — no further action needed |
| Design system gaps found | `/design-normalize` first, then re-run `/design-polish` |

## Important

- **Modifying**: This skill directly applies safe fixes.
- **Conservative**: Only auto-fixes items with clear, safe remediation. Ambiguous items flagged for manual review.
- **Pairs with**: Run `/design-audit` first for broad issues, then `/design-polish` for final touches.
