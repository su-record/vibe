---
name: design-normalize
description: "Normalize hardcoded values to design system tokens — colors, typography, spacing, shadows aligned to MASTER.md. Use when design-normalize, design-system, token-align."
triggers: [design-normalize, design-system, token-align]
priority: 50
---

# Design Normalize — Design System Token Alignment

Replace hardcoded design values with design system tokens from MASTER.md. Ensures visual consistency across the project.

## Usage

```
/design-normalize              # Normalize all changed UI files
/design-normalize <target>     # Normalize specific component/page
```

## Process

### Step 1: Load Design System

Load token source in priority order:

1. `.claude/vibe/design-system/{project}/MASTER.md` (project-specific)
2. `.claude/vibe/design-context.json` (from `/design-teach`)
3. If neither exists → prompt: "Run `/design-teach` or create MASTER.md first. Proceeding with default token detection."

### Step 2: Scan for Hardcoded Values

Detect these categories:

| Category | Pattern | Example |
|----------|---------|---------|
| Colors | Hex `#xxx`, `#xxxxxx`, `rgb()`, `hsl()` | `#3B82F6` → `var(--color-primary)` |
| Typography | `font-size: 14px`, `font-weight: 600` | `14px` → `var(--text-sm)` |
| Spacing | `margin: 16px`, `padding: 24px`, `gap: 12px` | `16px` → `var(--space-4)` |
| Shadows | `box-shadow: 0 2px 4px ...` | Inline → `var(--shadow-sm)` |
| Border Radius | `border-radius: 8px` | `8px` → `var(--radius-md)` |

### Step 3: Map to Tokens

For each hardcoded value:

1. Find closest matching token in MASTER.md
2. If exact match → replace directly
3. If close match (within 2px/similar hue) → replace + note the mapping
4. If no match → flag for manual review (may need new token)

### Step 4: Apply Replacements

Replace values in source files, preserving:
- Intentional one-off values (commented with `/* intentional */`)
- Animation keyframe values
- SVG path data
- Third-party library overrides

## Token Mapping Example

```css
/* Before */
.card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* After */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}
```

## Output Format

```markdown
## Design Normalize: {target}

### Token Source
- Using: MASTER.md / design-context.json / default detection

### Replacements Applied
| File | Line | Before | After | Confidence |
|------|------|--------|-------|------------|
| Card.tsx | 12 | #3B82F6 | var(--color-primary) | exact |
| Card.tsx | 15 | 16px | var(--space-4) | exact |
| Card.tsx | 18 | 7px | var(--radius-md) (8px) | close |

### New Tokens Suggested
- `--color-accent-light: #DBEAFE` — used 4 times, no matching token

### Skipped (Manual Review)
- {file}:{line} — animation keyframe value
- {file}:{line} — no matching token found

### Summary
- Scanned: {N} files
- Replaced: {N} values
- New tokens suggested: {N}
- Skipped: {N}
```

## Preparation

Before running normalization:

1. **Read** `.claude/vibe/design-context.json`
   - If missing → display: "Run `/design-teach` first for better results" → proceed with defaults
   - If parse error → display warning → proceed with defaults → recommend `/design-teach`
   - If present → use `detectedStack.styling` to determine token format (CSS vars, Tailwind, etc.)
2. **Read** `.claude/vibe/design-system/*/MASTER.md`
   - If missing → display: "Run `/design-teach` or create MASTER.md first. Proceeding with default token detection."
   - If present → use as authoritative token source for replacements

## Next Steps

| If Result Shows | Recommended Next |
|----------------|-----------------|
| Tokens aligned successfully | `/design-polish` — final pre-ship pass |
| New tokens suggested | Add to MASTER.md, then re-run `/design-normalize` |

## Important

- **Modifying**: Directly replaces hardcoded values with token references.
- **MASTER.md required**: Works best with a defined design system. Falls back to auto-detection if missing.
- **Safe**: Preserves intentional overrides and third-party styles.
