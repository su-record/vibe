# Image Extraction Rules

## Format

- Output format: `.webp` always — never `.png`, `.jpg`, `.svg` from MCP asset URLs
- Exception: SVG icons referenced as inline code (not MCP URLs) stay as `.svg`
- Do not convert or re-encode after download — use the raw bytes from `curl`

## Naming

Convert the JavaScript variable name to kebab-case:

| Variable | File Name |
|----------|-----------|
| `img21` | `img-21.webp` |
| `imgTitle` | `title.webp` (strip leading `img` prefix) |
| `imgSnowParticle12` | `snow-particle-12.webp` |
| `imgImgBannerStatic` | `banner-static.webp` (collapse double `img`) |
| `imgBtnShare` | `btn-share.webp` |

Rules:
- Strip leading `img` prefix before converting to kebab-case
- Numbers stay as-is: `item11` → `item-11`
- Acronyms lowercased: `BTN` → `btn`, `BG` → `bg`

## Destination

```
public/images/{feature}/    ← Vue/Nuxt
static/images/{feature}/    ← Nuxt 2 legacy
public/{feature}/           ← Next.js (under /public)
```

Always use the directory confirmed in Phase 0 setup.

## Size Limits

| Type | Warn threshold | Block threshold |
|------|---------------|----------------|
| Background image | 500 KB | 2 MB |
| Content image | 200 KB | 1 MB |
| Decorative image | 100 KB | 500 KB |
| Total per section | 3 MB | 10 MB |

If a file exceeds the warn threshold, log it. Never block the download — size checks are advisory.

## Download Rules

- [ ] Download ALL `const img...` variables — zero omissions ("core assets only" is forbidden)
- [ ] Use `curl -sL "{url}" -o {dest}` — silent, follow redirects
- [ ] After download: `ls -la {dir}` — verify file exists and size > 0
- [ ] On 0-byte file: retry once. On second failure: log and continue (do not block code gen for a single failed decorative image)
- [ ] On missing asset (in tree.json but no download URL): use node render fallback (`--render --nodeIds={id}`) to capture as PNG

## Image Mapping Table

After all downloads, produce a mapping before writing any component code:

```js
const imageMap = {
  imgTitle: '/images/{feature}/title.webp',
  img21:    '/images/{feature}/img-21.webp',
  // ...every variable
}
```

This map is the only source for `src` values in generated components. No raw Figma URLs in output code.
