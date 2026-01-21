---
name: brand-assets
description: "Auto-generate app icons and favicons from SPEC brand information using Gemini Image API"
triggers: [icon, favicon, brand, logo, app icon, branding, assets]
priority: 65
---
# Brand Assets Generation Skill

Auto-generate app icons and favicons based on SPEC brand information.

## When to Use

- First-time project setup with `/vibe.run`
- When SPEC contains brand/design information
- When Gemini API key is configured

## Prerequisites

- Gemini API key configured (`vibe gemini auth`)
- SPEC with brand context (app name, colors, style)

## Generated Assets

### Web
- `favicon.ico` (16x16, 32x32, 48x48)
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png` (180x180)
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`

### Mobile (if applicable)
- iOS: `AppIcon.appiconset/` with all sizes
- Android: `mipmap-*/` adaptive icons

## SPEC Brand Section

For best results, include brand info in your SPEC:

```yaml
<context>
Brand:
  - App Name: MyApp
  - Primary Color: #2F6BFF
  - Style: Modern, minimal, flat design
  - Icon Concept: Abstract geometric shape representing connectivity
</context>
```

## Generation Flow

```
SPEC Brand Info
      |
      v
Extract: name, colors, style keywords
      |
      v
Generate Prompt: "App icon for [name], [style], [colors]..."
      |
      v
Gemini Image API (imagen-3)
      |
      v
Resize & Convert: All platform sizes
      |
      v
Save to: public/ or assets/
```

## Auto-Trigger Conditions

1. First `/vibe.run` execution (no existing icons)
2. SPEC contains brand/design context
3. Gemini API key is available
4. `--generate-icons` flag passed

## Skip Conditions

- Icons already exist (unless `--regenerate-icons`)
- No brand info in SPEC
- Gemini API not configured

## Prompt Template

```
Create a modern app icon for "[APP_NAME]".

Style: [STYLE_KEYWORDS]
Primary color: [PRIMARY_COLOR]
Design: Minimalist, professional, suitable for mobile app
Format: Square, clean edges, simple recognizable shape
Background: Solid color or subtle gradient

Requirements:
- Works at small sizes (16x16 to 512x512)
- No text or letters
- Single focal element
- High contrast for visibility
```

## Manual Usage

```bash
# Generate via hook script (when Gemini configured)
node hooks/scripts/generate-brand-assets.js \
  --name "MyApp" \
  --color "#2F6BFF" \
  --style "modern minimal" \
  --output "./public"
```

## Integration with /vibe.run

During Phase 1 (Setup), if brand assets don't exist:

1. Parse SPEC for brand context
2. Generate icon via Gemini Image API
3. Create all size variants
4. Place in appropriate directories
5. Update manifest files if needed

## Fallback Strategy

If Gemini Image fails:
1. Generate text-based monogram icon (first letter)
2. Use project primary color as background
3. Create simple geometric placeholder

## Output Structure

```
public/
  favicon.ico
  favicon-16x16.png
  favicon-32x32.png
  apple-touch-icon.png
  android-chrome-192x192.png
  android-chrome-512x512.png
  site.webmanifest
```
