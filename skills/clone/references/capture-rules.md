# Clone — Phase 1 Capture Output & Rules

> Loaded by vibe.clone SKILL.md Phase 1 (Capture) — full per-breakpoint output directory listing and the deterministic capture rule set.

### Output per breakpoint

```
/tmp/{feature}/{bp}/
  ├── rendered.html       — final DOM after JS execution
  ├── computed.json       — per-element computed CSS + bounding box
  ├── screenshot.png      — full-page screenshot
  ├── states.json         — non-default state rules (hover/focus/active/checked/tab/aria/data-state)
  ├── behaviors.json      — ACTIVE sweep: scroll / tab / hover / in-view / time-driven + scrollLib
  ├── assets/
  │   ├── images/         — all <img>, background-image, <picture> sources
  │   ├── fonts/          — @font-face srcs
  │   └── seo/            — favicons, apple-touch-icons, OG images, webmanifest
  └── asset-map.json      — remote URL → local path mapping
```

### Capture rules

```
1. Wait for `networkidle2` (no in-flight requests for 500ms) before snapshot
2. Scroll to bottom slowly to trigger lazy-loaded content
3. Resolve all <img src>, srcset, and computed background-image URLs
4. Resolve @font-face src() URLs from all stylesheets
5. Download assets in parallel (concurrency=8), preserve original extensions
6. Rewrite asset URLs in rendered.html and computed.json to local paths
7. Strip inline analytics/tracking scripts before saving rendered.html
8. Harvest non-default state rules from all stylesheets → states.json
   (deterministic: read :hover/:focus/:active/:checked/[aria-*]/[data-state]/.is-*/.active/
    .scrolled/.sticky/.pinned/… declarations straight from CSS — NO scripted clicking)
9. ACTIVE interaction sweep → behaviors.json (runs after lazy-load, before freeze).
   Drives the live page to capture JS-set state that CSS harvesting can't see:
   - Scroll-state diff: tag sticky/fixed/top-bar headers+nav, snapshot computed CSS at
     scroll 0, scroll past threshold, re-snapshot, diff → {prop: {from, to}, triggerScrollY}
   - Tab groups: click tab-like sibling sets, detect whether content swaps on click
   - Hover diff: hover interactive elements (1 sample per tag+class signature, max 30),
     diff computed styles → JS-set hover states that :hover harvesting misses
   - In-view entrance: fresh reload, tag below-fold "waiting to animate" nodes
     (opacity 0 / transform offset), scroll each into view, diff → fade-up/slide-in
   - Time-driven: 3s no-input MutationObserver watch → carousel/auto-cycle candidates
   - Scroll-lib detection: Lenis / Locomotive Scroll (native scrolling feels different —
     the user spots it immediately; wire the lib page-level, not per-section)
   Disable with --no-interact (restores the old fully-deterministic, screenshot-stable capture).
10. SEO asset harvest: favicon / apple-touch-icon / webmanifest / og:image → assets/seo/
```
