# Figma Handoff — {{FEATURE_NAME}}

**Figma File:** {{FIGMA_FILE_URL}}
**Feature Key:** {{FEATURE_KEY}} (kebab-case)
**Date:** {{DATE}}
**Stack:** {{STACK}} (e.g. Vue/Nuxt + SCSS, React/Next.js + SCSS)

---

## Design Specs

### Viewport / Scale

| Breakpoint | Design Width | Target Width | Scale Factor |
|-----------|-------------|-------------|-------------|
| Mobile (base) | {{DESIGN_MOBILE_PX}}px | {{TARGET_MOBILE_PX}}px | {{SCALE_MOBILE}} |
| Desktop | {{DESIGN_PC_PX}}px | {{TARGET_PC_PX}}px | {{SCALE_PC}} |

Breakpoint threshold: `@media (min-width: {{BP_PC}}px)`

### Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `$color-{{NAME}}` | `{{HEX}}` | {{USAGE}} |

### Typography Tokens

| Token | Figma px | Scaled px | Weight | Role |
|-------|---------|----------|--------|------|
| `$text-{{ROLE}}` | {{FIGMA_PX}}px | {{SCALED_PX}}px | {{WEIGHT}} | {{ROLE}} |

### Spacing Tokens

| Token | Figma px | Scaled px | Usage |
|-------|---------|----------|-------|
| `$space-{{NAME}}` | {{FIGMA_PX}}px | {{SCALED_PX}}px | {{USAGE}} |

---

## Sections

| # | Section Name | Component File | Mode | Height (design) |
|---|-------------|---------------|------|----------------|
| 1 | {{SECTION_NAME}} | `components/{{FEATURE_KEY}}/{{ComponentName}}.vue` | {{MODE}} | {{HEIGHT}}px |

**Mode key:** `normal` = external SCSS | `literal` = scoped CSS (non-standard layout)

---

## Asset Manifest

| Variable | Local Path | Type | Alt Text |
|----------|-----------|------|----------|
| `{{IMG_VAR}}` | `/images/{{FEATURE_KEY}}/{{FILE_NAME}}.webp` | {{bg\|content\|decorative}} | {{ALT}} |

Total assets: {{ASSET_COUNT}}

---

## File Structure

```
components/{{FEATURE_KEY}}/
  {{ComponentName}}.vue

public/images/{{FEATURE_KEY}}/
  {{FILE_NAME}}.webp

styles/{{FEATURE_KEY}}/
  index.scss
  _tokens.scss
  _mixins.scss
  _base.scss
  layout/
    _{{section}}.scss
  components/
    _{{section}}.scss
```

---

## Verification Checklist

- [ ] No `figma.com/api` URLs in any generated file
- [ ] No `placeholder` or empty `src=""` in components
- [ ] No `<style>` blocks in components (normal mode)
- [ ] All assets downloaded and non-zero bytes
- [ ] Build passes without errors
- [ ] Screenshot comparison: P1 issues = 0

---

## Notes

{{NOTES}}
