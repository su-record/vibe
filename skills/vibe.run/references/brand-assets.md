# Brand Assets Generation — Full Reference

> Loaded by vibe.run SKILL.md when starting a new project with brand context in SPEC.

## Brand Assets Generation (Optional)

When starting a **new project** with brand context in SPEC, auto-generate app icons and favicons:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND ASSETS GENERATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Check] Brand assets exist? → Skip if favicon.ico exists
[Check] Antigravity API configured? → Required for image generation
[Check] SPEC has brand context? → Extract app name, colors, style

[Generate] Creating app icon with Antigravity Image API...
  - Prompt: "App icon for [AppName], [style], [color]..."
  - Generated: 512x512 master icon

[Resize] Creating platform variants...
  favicon.ico (16/32/48)
  favicon-16x16.png
  favicon-32x32.png
  apple-touch-icon.png (180x180)
  android-chrome-192x192.png
  android-chrome-512x512.png
  site.webmanifest

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Brand assets generated in public/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## SPEC Brand Context Example

```xml
<context>
Brand:
  - App Name: MyApp
  - Primary Color: #2F6BFF
  - Style: Modern, minimalist, flat design
  - Icon Concept: Abstract geometric shape
</context>
```

## Trigger Conditions

- First `/vibe.run` execution (no existing icons)
- SPEC contains brand/design context
- Antigravity API key configured (`vibe antigravity key <key>`)

## Manual Generation

```bash
# [LLM_SCRIPT] = {{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js
node "[LLM_SCRIPT]" antigravity image "App icon for MyApp, primary color #2F6BFF, square format 1:1, simple recognizable design, works well at small sizes, no text or letters, solid or gradient background, modern minimalist" --output "./public/app-icon.png"
```
