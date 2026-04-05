# Figma Layer Naming Conventions for Clean Extraction

> This skill is inlined into vibe-figma, vibe-figma-extract, and vibe-figma-convert. This rubric documents how Figma layer names map to generated code identifiers.

## Layer Name → CSS Class

Convert `data-name` attribute values from reference code to CSS class names:

| Figma Layer Name | CSS Class | Notes |
|-----------------|-----------|-------|
| `BG` | `.bg` | Lowercase single word |
| `Title` | `.title` | PascalCase → camelCase |
| `Period` | `.period` | |
| `Light` | `.light` | |
| `BTN_Share` | `.btnShare` | `BTN_` prefix → `btn`, underscore → camelCase |
| `BTN_Primary` | `.btnPrimary` | |
| `KV` (Key Visual) | `.kv` | Acronym → all lowercase |
| `GNB` | `.gnb` | |
| `PC_Banner` | `.pcBanner` | |
| `Snow_Particle_12` | `.snowParticle12` | Underscore-separated → camelCase |
| *(no data-name)* | `.node-{nodeId}` | Replace `:` with `-` in nodeId |

## Conflict Resolution

When two layers in the same section share the same name:
- Prefix with parent layer name: `.heroLight`, `.kidLight`
- Or append an index suffix: `.light-1`, `.light-2`
- Never generate duplicate class names in the same `<style scoped>` block

## Image Variable Name → File Name

| Figma Variable | File Name | Rule |
|---------------|-----------|------|
| `imgTitle` | `title.webp` | Strip `img` prefix, kebab-case |
| `img21` | `img-21.webp` | Numeric suffix: keep number |
| `imgSnowParticle12` | `snow-particle-12.webp` | CamelCase → kebab |
| `imgImgBannerStatic` | `banner-static.webp` | Double `img` prefix → strip both |
| `imgBtnShare` | `btn-share.webp` | |

## Component File Naming

| Figma Section Name | Component File |
|-------------------|----------------|
| "Hero" / "히어로" | `HeroSection.vue` |
| "Daily Check-in" / "일일 출석" | `DailyCheckInSection.vue` |
| "Play Time Mission" | `PlayTimeMissionSection.vue` |
| "Exchange" / "교환" | `ExchangeSection.vue` |
| "Popup" | `RewardPopup.vue` (non-section suffix) |
| "GNB" | `TheGnb.vue` (project-wide shared) |

Rules:
- PascalCase always
- Append `Section` suffix for page sections
- No `Section` suffix for popups, overlays, shared layout components

## Feature Key (Directory Name)

Derived from Figma file name:

| Figma File Name | Feature Key |
|----------------|-------------|
| "PUBG 겨울 PC방 이벤트" | `winter-pcbang` |
| "Summer Campaign 2025" | `summer-campaign-2025` |
| "Login Page Redesign" | `login-page-redesign` |

Rules:
- kebab-case
- Remove language/brand prefixes if obvious from context
- Numbers and years are kept
- No special characters
