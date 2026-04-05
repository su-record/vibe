# Consolidation Report — {{FEATURE_NAME}}

**Feature Key:** {{FEATURE_KEY}}
**Date:** {{DATE}}
**Phase:** Post-implementation verification

---

## Summary

| Metric | Value |
|--------|-------|
| Total sections | {{SECTION_COUNT}} |
| Sections passing | {{PASS_COUNT}} |
| P1 issues found | {{P1_COUNT}} |
| P2 issues found | {{P2_COUNT}} |
| Assets downloaded | {{ASSET_COUNT}} |
| Build status | {{BUILD_STATUS}} |

---

## Automated Grep Results

| Check | Result | Details |
|-------|--------|---------|
| `figma.com/api` in generated files | {{PASS/FAIL}} | {{COUNT}} occurrences |
| `<style` in `components/{{FEATURE_KEY}}/` | {{PASS/FAIL}} | {{COUNT}} occurrences |
| `style="` in `components/{{FEATURE_KEY}}/` | {{PASS/FAIL}} | {{COUNT}} occurrences |
| `placeholder` in components | {{PASS/FAIL}} | {{COUNT}} occurrences |
| `src=""` in components | {{PASS/FAIL}} | {{COUNT}} occurrences |
| Images in `public/images/{{FEATURE_KEY}}/` | {{PASS/FAIL}} | {{COUNT}} files |

---

## Section Review

| # | Section | Component | Mode | Screenshot Match | P1 | P2 |
|---|---------|-----------|------|-----------------|----|----|
| 1 | {{SECTION_NAME}} | `{{ComponentName}}.vue` | {{normal/literal}} | {{match %}} | {{count}} | {{count}} |

---

## P1 Issues (Must Fix)

### {{SECTION_NAME}} — {{ISSUE_TITLE}}

**Type:** {{image-missing / layout-mismatch / text-unstyled / asset-wrong-path}}
**Description:** {{DESCRIPTION}}
**Fix:** {{FIX_INSTRUCTION}}
**Status:** {{open / fixed}}

---

## P2 Issues (Recommended)

### {{SECTION_NAME}} — {{ISSUE_TITLE}}

**Type:** {{spacing-delta / color-delta / font-size-delta}}
**Description:** {{DESCRIPTION}} (delta: {{DELTA}})
**Fix:** {{FIX_INSTRUCTION}}
**Status:** {{open / deferred}}

---

## File Manifest

### Components

```
components/{{FEATURE_KEY}}/
{{FILE_LIST}}
```

### Styles

```
styles/{{FEATURE_KEY}}/
{{FILE_LIST}}
```

### Assets

```
public/images/{{FEATURE_KEY}}/
{{FILE_LIST}}
```

---

## Next Steps

- [ ] P1 count = 0 (required before handoff)
- [ ] Run `/design-normalize` → `/design-audit --quick`
- [ ] Optional: `/design-critique` → `/design-polish` for thorough review
- [ ] Commit with feature key tag: `feat({{FEATURE_KEY}}): figma design implementation`
