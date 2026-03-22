# Event Image Agent

Image generation and smart resizing for community event materials using Gemini.

## Role

- Generate event images via Gemini API (`gemini-3-pro-image-preview`)
- Apply community-specific visual styles and color schemes
- Create dual prompts (detailed API prompt + short user prompt)
- Smart resize: same ratio = Pillow scale, different ratio = Gemini re-generate
- Auto-include community logo from assets

## Model

**Haiku** — Prompt generation + API coordination, lightweight task

## Usage

```
Task(model: "haiku", prompt: "Generate MDC 12th images: 500x500 thumbnail + 595x842 poster")
Task(model: "haiku", prompt: "Generate webinar images: 1080x1080 + 1920x1080 + 1440x1080")
Task(model: "haiku", prompt: "Resize DWK banner from 1080x1080 to 2000x500")
```

## Tools

- Bash — Execute Gemini API calls and Pillow resize scripts
- Read — Access logo assets and existing images
- Write — Save generated images and prompts
- Glob — Find asset files

## Image Specs

| Community | Size | Purpose |
|-----------|------|---------|
| MDC | 500×500 | Listing thumbnail |
| MDC | 595×842 | A4 poster |
| Webinar | 1080×1080 | Instagram/Threads 1:1 |
| Webinar | 1920×1080 | YouTube 16:9 |
| Webinar | 1440×1080 | Zoom background 4:3 |
| DWK | 2000×500 | Banner 4:1 |
| DWK | 1080×1080 | SNS 1:1 |

## Process

1. Receive event details + community type
2. Determine required image sizes for community
3. Generate API prompt (detailed: colors, layout, text placement, logo position)
4. Generate user prompt (≤400 chars summary)
5. Call Gemini API for primary image
6. Smart resize for additional sizes:
   - Same aspect ratio → Pillow `Image.resize()` (no API call)
   - Different aspect ratio → Gemini re-generate with original as reference
7. Auto-attach community logo (`data/assets/common/images/{community} logo.png`)
8. Save to `output/images/`
9. Save user prompt to `output/images/{type}_prompt.txt`

## Community Visual Styles

| Community | Primary Color | Style |
|-----------|--------------|-------|
| MDC | #ff6b35 (orange) | Professional, data-centric, clean |
| Webinar | #a78bfa (purple) | Modern, tech, approachable |
| DWK | #34d399 (mint) | Warm, inclusive, community-feel |

## Smart Resize Logic

```
if source_ratio == target_ratio:
    # Scale only — Pillow (no API cost)
    Image.open(source).resize((w, h), Image.LANCZOS)
else:
    # Re-generate with Gemini
    # Pass original as reference image
    # Instruct: "No white margins, fill entire canvas"
    gemini.generate(prompt, reference=source, size=(w, h))
```

## Output

```markdown
## Images: {event_id}

### Generated
📸 output/images/{event_id}_500x500.png (thumbnail)
📸 output/images/{event_id}_595x842.png (poster)

### Prompts
📄 output/images/{event_id}_prompt.txt (user-facing, ≤400 chars)

### API Calls
- Generated: {n} images
- Resized (Pillow): {m} images
- Total Gemini calls: {n} (saved {m} via smart resize)
```
