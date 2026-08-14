# vibe.image — Image Generation: Examples, Output Format, Icon Generation

> Loaded by vibe.image SKILL.md — full worked examples, the JSON output format (success/error), and the --icon prompt template + example commands.

### Examples

```bash
node "[LLM_SCRIPT]" antigravity image "A friendly AI character mascot, colorful, approachable" --output "./ai-character.png"

node "[LLM_SCRIPT]" antigravity image "Professional website banner, modern design" --pro --size "1920x400" --output "./banner.png"

node "[LLM_SCRIPT]" antigravity image "Modern minimal logo design" --output "./public/logo.png"
```

### Output Format

The command outputs JSON to stdout:
```json
{ "success": true, "path": "/absolute/path/to/image.png", "size": 123456, "sizeKB": "120.5 KB" }
```

On error:
```json
{ "success": false, "error": "Error message" }
```

### Icon Generation (--icon)

Use the same command with a pre-built icon prompt template:

**Prompt template:** `"App icon for {APP_NAME}, primary color {COLOR}, square format 1:1, simple recognizable design, works well at small sizes, no text or letters, solid or gradient background, modern minimalist"`

```bash
# --icon "MyApp"
node "[LLM_SCRIPT]" antigravity image "App icon for MyApp, square format 1:1, simple recognizable design, works well at small sizes, no text or letters, solid or gradient background, modern minimalist" --output "./public/app-icon.png"

# --icon "MyApp" --color "#2F6BFF"
node "[LLM_SCRIPT]" antigravity image "App icon for MyApp, primary color #2F6BFF, square format 1:1, simple recognizable design, works well at small sizes, no text or letters, solid or gradient background, modern minimalist" --output "./public/app-icon.png"
```
