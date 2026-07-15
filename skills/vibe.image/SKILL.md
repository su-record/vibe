---
name: vibe.image
description: Generate images (icons, banners, mockups) using the Antigravity image backend.
argument-hint: '"description" [--pro] [--icon "AppName"] [--size WxH]'
user-invocable: true
---

# /vibe.image

Generate images using the Antigravity image backend.

- **Default**: Antigravity fast image - 빠르고 가벼운 이미지 생성
- **--pro**: Antigravity pro image - 고품질 이미지 생성

## Usage

```
/vibe.image "description"          # Generate image with Antigravity (icon, banner, etc.)
/vibe.image --pro "description"    # High-quality generation
/vibe.image --icon "AppName"       # Generate app icon/favicon
```

## MANDATORY Tool Invocation

**CRITICAL: You MUST use the following command to generate images. Do NOT search for scripts, do NOT use gcloud, do NOT use any other method.**

**Step 0: Script path:**
- `[LLM_SCRIPT]` = `{{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js`

**General image generation (Antigravity fast image):**
```bash
node "[LLM_SCRIPT]" antigravity image "IMAGE_DESCRIPTION" --output "OUTPUT_PATH"
```

**Pro quality (Antigravity pro image):**
```bash
node "[LLM_SCRIPT]" antigravity image "IMAGE_DESCRIPTION" --pro --output "OUTPUT_PATH"
```

**With size option:**
```bash
node "[LLM_SCRIPT]" antigravity image "IMAGE_DESCRIPTION" --size "1920x1080" --output "OUTPUT_PATH"
```

## How to Parse User Request

1. Extract the **image description** from the user's message (what to generate)
2. Extract the **output path** from the user's message (where to save)
   - If user specifies a path, use that path
   - Default: `--output "./generated-image.png"`
3. Extract **size** if specified, otherwise default 1024x1024
4. If user requests **high quality / pro / 고품질**, add `--pro` flag

> Read `references/image-generation-examples.md` for full worked examples, the JSON output format, and the --icon prompt template + example commands.

## Prerequisites

- Antigravity API key configured (`vibe antigravity key <key>`)

---

ARGUMENTS: $ARGUMENTS
