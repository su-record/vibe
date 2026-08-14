# Figma Handoff — {{FEATURE_NAME}}

**Figma File:** {{FIGMA_FILE_URL}}
**Feature Key:** {{FEATURE_KEY}} (kebab-case)
**Date:** {{DATE}}
**Stack:** {{STACK}} (e.g. Vue/Nuxt + SCSS, React/Next.js + SCSS)

---

## Design Specs

### Viewport / Responsive

| Breakpoint | Design Width | Min Width | CSS 단위 |
|-----------|-------------|-----------|---------|
| Mobile (base) | {{DESIGN_MOBILE_PX}}px | {{MIN_WIDTH}}px | vw + clamp |
| Desktop | {{DESIGN_PC_PX}}px | — | vw + clamp |

Breakpoint threshold: `@media (min-width: {{BP_PC}}px)`
ROOT folder: `{{MO_FOLDER}}/`, `{{PC_FOLDER}}/`

### Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `$color-{{NAME}}` | `{{HEX}}` | {{USAGE}} |

### Typography Tokens

| Token | Figma px | vw | clamp 최소 | Role |
|-------|---------|-----|----------|------|
| `$text-{{ROLE}}` | {{FIGMA_PX}}px | {{VW}}vw | {{MIN_PX}}px | {{ROLE}} |

### Spacing Tokens

| Token | Figma px | vw | Usage |
|-------|---------|-----|-------|
| `$space-{{NAME}}` | {{FIGMA_PX}}px | {{VW}}vw | {{USAGE}} |

---

## Sections

| # | Section Name | Component File | Tree Nodes | Height (design) |
|---|-------------|---------------|-----------|----------------|
| 1 | {{SECTION_NAME}} | `components/{{FEATURE_KEY}}/{{ComponentName}}.vue` | {{NODE_COUNT}} | {{HEIGHT}}px |

**Generation:** tree.json → HTML+SCSS 구조적 매핑 (vw/clamp 반응형)

---

## Asset Manifest

| Image | Local Path | Type | Render Method |
|-------|-----------|------|--------------|
| {{NAME}} | `/images/{{FEATURE_KEY}}/{{FILE_NAME}}.webp` | {{bg\|content\|vector-text}} | {{frame-render\|node-render\|group-render}} |

Total assets: {{ASSET_COUNT}} (BG 렌더링 {{BG_COUNT}}장 + 콘텐츠 {{CONTENT_COUNT}}장)

---

## File Structure

```
/tmp/{{FEATURE_KEY}}/
  {{MO_FOLDER}}/                ← 모바일 작업
    tree.json
    bg/
    content/
    sections/
  {{PC_FOLDER}}/                ← 데스크탑 작업
    ...
  final/                        ← Phase 5 공통화 결과
    components/{{FEATURE_KEY}}/
    styles/{{FEATURE_KEY}}/
      index.scss
      _tokens.scss
      _mixins.scss
      _base.scss
      layout/
      components/
```

---

## Verification Checklist

- [ ] No `figma.com/api` URLs in any generated file
- [ ] No `placeholder` or empty `src=""` in components
- [ ] No `<style>` blocks in components
- [ ] All images are node-rendered (no imageRef direct download)
- [ ] No image file > 5MB (텍스처 fill 의심)
- [ ] Build passes without errors
- [ ] Screenshot comparison: P1 issues = 0

---

## Notes

{{NOTES}}
