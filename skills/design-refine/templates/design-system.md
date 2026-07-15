# Design System Summary: {{PROJECT_NAME}}

**Generated**: {{DATE}}
**Version**: {{VERSION}}
**Source**: {{SOURCE}} (distilled from codebase / design-context.json / MASTER.md)

---

## Brand Identity

| Attribute | Value |
|-----------|-------|
| Personality | {{BRAND_PERSONALITY}} |
| Tone | {{BRAND_TONE}} |
| Style | {{AESTHETIC_STYLE}} |
| Color Mood | {{COLOR_MOOD}} |
| Typography Mood | {{TYPOGRAPHY_MOOD}} |
| Reference Products | {{REFERENCES}} |

---

## Color Palette

### Primary

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | {{PRIMARY_VALUE}} | Primary actions, links |
| `--color-primary-hover` | {{PRIMARY_HOVER_VALUE}} | Hover state |
| `--color-secondary` | {{SECONDARY_VALUE}} | Secondary actions |

### Surfaces

| Token | Value | Usage |
|-------|-------|-------|
| `--color-surface` | {{SURFACE_VALUE}} | Page background |
| `--color-surface-raised` | {{SURFACE_RAISED_VALUE}} | Cards |
| `--color-surface-overlay` | {{SURFACE_OVERLAY_VALUE}} | Modals |
| `--color-border` | {{BORDER_VALUE}} | Borders |

### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--color-text` | {{TEXT_VALUE}} | Body text |
| `--color-text-muted` | {{TEXT_MUTED_VALUE}} | Secondary text |
| `--color-error` | {{ERROR_VALUE}} | Errors |
| `--color-success` | {{SUCCESS_VALUE}} | Success |
| `--color-warning` | {{WARNING_VALUE}} | Warnings |

---

## Typography

| Token | Value | Usage |
|-------|-------|-------|
| Heading font | {{HEADING_FONT}} | All headings |
| Body font | {{BODY_FONT}} | Body text |
| Mono font | {{MONO_FONT}} | Code, technical |

### Scale

| Token | Size | Weight | Line Height | Use |
|-------|------|--------|-------------|-----|
| `--text-xs` | {{XS_SIZE}} | {{XS_WEIGHT}} | {{XS_LH}} | Captions |
| `--text-sm` | {{SM_SIZE}} | {{SM_WEIGHT}} | {{SM_LH}} | Labels |
| `--text-base` | {{BASE_SIZE}} | {{BASE_WEIGHT}} | {{BASE_LH}} | Body |
| `--text-lg` | {{LG_SIZE}} | {{LG_WEIGHT}} | {{LG_LH}} | Subheading |
| `--text-2xl` | {{2XL_SIZE}} | {{2XL_WEIGHT}} | {{2XL_LH}} | Section heading |
| `--text-4xl` | {{4XL_SIZE}} | {{4XL_WEIGHT}} | {{4XL_LH}} | Hero |

---

## Spacing

Base unit: {{SPACING_BASE}} ({{SPACING_SYSTEM}})

| Token | Value | Common Use |
|-------|-------|------------|
| `--space-1` | {{S1}} | Tight internal gap |
| `--space-2` | {{S2}} | Icon-text spacing |
| `--space-4` | {{S4}} | Component padding |
| `--space-6` | {{S6}} | Section internal gap |
| `--space-8` | {{S8}} | Section separation |
| `--space-12` | {{S12}} | Large section gap |

---

## Shape & Elevation

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | {{RADIUS_SM}} | Badges, tags |
| `--radius-md` | {{RADIUS_MD}} | Inputs, buttons |
| `--radius-lg` | {{RADIUS_LG}} | Cards |
| `--radius-full` | 9999px | Pills |
| `--shadow-sm` | {{SHADOW_SM}} | Subtle lift |
| `--shadow-md` | {{SHADOW_MD}} | Cards |
| `--shadow-lg` | {{SHADOW_LG}} | Dropdowns |
| `--shadow-xl` | {{SHADOW_XL}} | Modals |

---

## Motion

| Token | Value | Use |
|-------|-------|-----|
| `--duration-fast` | 150ms | Micro-interactions |
| `--duration-normal` | 200ms | State transitions |
| `--duration-slow` | 300ms | Page transitions |
| `--ease-default` | {{EASE_DEFAULT}} | Standard transitions |
| `--ease-enter` | {{EASE_ENTER}} | Elements entering |
| `--ease-exit` | {{EASE_EXIT}} | Elements leaving |

---

## Component Patterns Preserved

The following elements were identified as brand-expressive and preserved during distillation:

{{#PRESERVED_PATTERNS}}
- **{{NAME}}**: {{DESCRIPTION}}
{{/PRESERVED_PATTERNS}}
{{#NO_PRESERVED_PATTERNS}}
- None identified — all patterns are functional
{{/NO_PRESERVED_PATTERNS}}

---

## Notes

{{ADDITIONAL_NOTES}}
