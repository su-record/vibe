# Required Brand Assets Checklist

Complete this checklist before shipping. Each missing item is a gap in brand completeness.

---

## Tier 1 — Blocking (must exist before launch)

### Favicon & App Icons

- [ ] `favicon.ico` — 16×16, 32×32, 48×48 combined
- [ ] `favicon-16x16.png`
- [ ] `favicon-32x32.png`
- [ ] `apple-touch-icon.png` — 180×180
- [ ] `android-chrome-192x192.png`
- [ ] `android-chrome-512x512.png`
- [ ] `site.webmanifest` — references all icon paths, correct `name` and `theme_color`

### Logo

- [ ] Primary logo (SVG) — color version
- [ ] Primary logo (SVG) — white/reversed version for dark backgrounds
- [ ] Icon-only version (SVG) — usable at 32px minimum

---

## Tier 2 — Important (should exist before public launch)

### Open Graph / Social Sharing

- [ ] `og-image.png` — 1200×630px, includes logo and product name
- [ ] `twitter-image.png` — 1200×600px or reuse OG image
- [ ] OG meta tags in `<head>`: `og:title`, `og:description`, `og:image`, `og:url`
- [ ] Twitter card meta tags: `twitter:card`, `twitter:image`

### iOS / PWA

- [ ] `apple-touch-icon.png` correctly linked in `<head>`
- [ ] `maskable_icon.png` — 512×512, safe zone within inner 80% (for Android adaptive icons)
- [ ] PWA manifest includes `purpose: "any maskable"` entry
- [ ] `theme-color` meta tag set to brand primary color

---

## Tier 3 — Complete (production-quality brand presence)

### Email Assets

- [ ] Email header logo — 300×80px max, hosted URL (not local path)
- [ ] Email footer logo — monochrome version

### Documentation / Marketing

- [ ] Logo usage guidelines documented
- [ ] Color codes documented (HEX, RGB, HSL)
- [ ] Font names and weights documented
- [ ] Do/don't logo usage examples

---

## Quality Checks

### Icon Quality

- [ ] Icon is recognizable at 16×16 (no fine details lost)
- [ ] No text or letters in icon (illegible at small sizes)
- [ ] Single focal element (not a scene or complex composition)
- [ ] Works on both white and dark backgrounds
- [ ] Consistent visual weight with similar products in the app's ecosystem

### File Formats

- [ ] SVG files are clean (no Figma/Illustrator junk metadata)
- [ ] PNG files are optimized (use `pngcrush` or equivalent)
- [ ] ICO file contains all three sizes (16, 32, 48)
- [ ] All files referenced in manifest actually exist

### Colors in Assets

- [ ] Icon colors match brand color palette exactly (no approximations)
- [ ] OG image background uses brand color, not generic gray
- [ ] Logo SVG uses `currentColor` or hardcoded brand values (never browser defaults)

---

## Asset Inventory

| Asset | File Path | Size | Format | Status |
|-------|-----------|------|--------|--------|
| Primary logo | {{LOGO_PATH}} | — | SVG | {{STATUS}} |
| Logo white | {{LOGO_WHITE_PATH}} | — | SVG | {{STATUS}} |
| App icon | {{ICON_PATH}} | 512×512 | PNG | {{STATUS}} |
| Favicon bundle | `public/favicon.ico` | 16/32/48 | ICO | {{STATUS}} |
| Apple touch | `public/apple-touch-icon.png` | 180×180 | PNG | {{STATUS}} |
| Android 192 | `public/android-chrome-192x192.png` | 192×192 | PNG | {{STATUS}} |
| Android 512 | `public/android-chrome-512x512.png` | 512×512 | PNG | {{STATUS}} |
| OG image | `public/og-image.png` | 1200×630 | PNG | {{STATUS}} |
| Maskable icon | `public/maskable-icon.png` | 512×512 | PNG | {{STATUS}} |
