# Brand Guide: {{PROJECT_NAME}}

**Version**: {{VERSION}}
**Last Updated**: {{DATE}}
**Maintainer**: {{MAINTAINER}}

---

## Brand Identity

| Attribute | Value |
|-----------|-------|
| Product Name | {{PRODUCT_NAME}} |
| Tagline | {{TAGLINE}} |
| Category | {{CATEGORY}} (SaaS / Mobile App / Consumer / Developer Tool) |
| Personality | {{PERSONALITY_WORDS}} |
| Tone | {{TONE}} |

---

## Logo

| Asset | File | Usage |
|-------|------|-------|
| Primary logo (color) | `{{LOGO_COLOR_PATH}}` | Default usage on white/light backgrounds |
| Primary logo (white) | `{{LOGO_WHITE_PATH}}` | Dark backgrounds |
| Primary logo (dark) | `{{LOGO_DARK_PATH}}` | Light backgrounds where color logo lacks contrast |
| Icon only (color) | `{{ICON_COLOR_PATH}}` | App icons, favicons, small contexts |
| Icon only (mono) | `{{ICON_MONO_PATH}}` | Single-color contexts |
| Wordmark only | `{{WORDMARK_PATH}}` | When icon is shown separately |

### Logo Clear Space

Maintain minimum clear space of **{{LOGO_CLEAR_SPACE}}** on all sides of the logo. No other elements within this zone.

### Logo Minimum Size

| Context | Minimum Width |
|---------|--------------|
| Print | {{LOGO_MIN_PRINT}} |
| Digital | {{LOGO_MIN_DIGITAL}} |
| Favicon | 16px (icon only) |

### Logo Misuse

- Do not stretch or distort the logo
- Do not apply drop shadows to the logo
- Do not place on busy backgrounds without a clear area
- Do not recreate with incorrect fonts or colors
- Do not use at sizes below minimum

---

## Color Palette

### Primary Colors

| Name | Hex | RGB | HSL | Usage |
|------|-----|-----|-----|-------|
| {{PRIMARY_NAME}} | {{PRIMARY_HEX}} | {{PRIMARY_RGB}} | {{PRIMARY_HSL}} | Primary brand, CTAs |
| {{SECONDARY_NAME}} | {{SECONDARY_HEX}} | {{SECONDARY_RGB}} | {{SECONDARY_HSL}} | Secondary actions |

### Neutral Colors

| Name | Hex | Usage |
|------|-----|-------|
| {{NEUTRAL_DARK}} | {{NEUTRAL_DARK_HEX}} | Primary text |
| {{NEUTRAL_MID}} | {{NEUTRAL_MID_HEX}} | Secondary text, borders |
| {{NEUTRAL_LIGHT}} | {{NEUTRAL_LIGHT_HEX}} | Backgrounds, dividers |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| Error | {{ERROR_HEX}} | Error states, destructive actions |
| Success | {{SUCCESS_HEX}} | Confirmation, positive states |
| Warning | {{WARNING_HEX}} | Caution states |
| Info | {{INFO_HEX}} | Informational states |

---

## Typography

### Typefaces

| Role | Font Family | Weight(s) | Source |
|------|------------|-----------|--------|
| Heading | {{HEADING_FONT}} | {{HEADING_WEIGHTS}} | {{HEADING_SOURCE}} |
| Body | {{BODY_FONT}} | {{BODY_WEIGHTS}} | {{BODY_SOURCE}} |
| Monospace | {{MONO_FONT}} | {{MONO_WEIGHTS}} | {{MONO_SOURCE}} |

### Type Scale

| Level | Size | Weight | Line Height | Use |
|-------|------|--------|-------------|-----|
| Display | {{DISPLAY_SIZE}} | {{DISPLAY_WEIGHT}} | {{DISPLAY_LH}} | Hero text |
| H1 | {{H1_SIZE}} | {{H1_WEIGHT}} | {{H1_LH}} | Page titles |
| H2 | {{H2_SIZE}} | {{H2_WEIGHT}} | {{H2_LH}} | Section headings |
| H3 | {{H3_SIZE}} | {{H3_WEIGHT}} | {{H3_LH}} | Subsections |
| Body | {{BODY_SIZE}} | {{BODY_WEIGHT}} | {{BODY_LH}} | Paragraphs |
| Caption | {{CAPTION_SIZE}} | {{CAPTION_WEIGHT}} | {{CAPTION_LH}} | Labels, captions |

---

## Iconography

| Attribute | Value |
|-----------|-------|
| Icon library | {{ICON_LIBRARY}} |
| Icon style | {{ICON_STYLE}} (outline / solid / duotone) |
| Standard sizes | 16px, 20px, 24px |
| Stroke width | {{STROKE_WIDTH}} |
| Color usage | Match adjacent text or use `--color-primary` for emphasis |

---

## App Icons & Favicons

| Asset | Size | File | Format |
|-------|------|------|--------|
| Favicon | 16×16 | `public/favicon-16x16.png` | PNG |
| Favicon | 32×32 | `public/favicon-32x32.png` | PNG |
| Favicon bundle | 16/32/48 | `public/favicon.ico` | ICO |
| Apple Touch Icon | 180×180 | `public/apple-touch-icon.png` | PNG |
| Android Chrome | 192×192 | `public/android-chrome-192x192.png` | PNG |
| Android Chrome | 512×512 | `public/android-chrome-512x512.png` | PNG |

---

## Imagery & Illustration

| Attribute | Guideline |
|-----------|-----------|
| Photography style | {{PHOTO_STYLE}} |
| Illustration style | {{ILLUSTRATION_STYLE}} |
| Image treatment | {{IMAGE_TREATMENT}} |
| Avoid | {{IMAGE_AVOID}} |

---

## Motion

| Attribute | Value |
|-----------|-------|
| Default duration | 200ms |
| Fast duration | 150ms (micro-interactions) |
| Slow duration | 300ms (page transitions) |
| Default easing | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Personality | {{MOTION_PERSONALITY}} (subtle / expressive / none) |

---

## Voice & Tone

| Context | Tone | Example |
|---------|------|---------|
| Marketing | {{MARKETING_TONE}} | {{MARKETING_EXAMPLE}} |
| UI labels | {{UI_TONE}} | {{UI_EXAMPLE}} |
| Error messages | {{ERROR_TONE}} | {{ERROR_EXAMPLE}} |
| Success messages | {{SUCCESS_TONE}} | {{SUCCESS_EXAMPLE}} |
| Empty states | {{EMPTY_TONE}} | {{EMPTY_EXAMPLE}} |
