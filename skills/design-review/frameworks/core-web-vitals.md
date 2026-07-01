---
name: core-web-vitals
type: framework
applies-to: [design-audit]
---

# Core Web Vitals — Reference Card

## The Three Metrics

| Metric | Measures | Good | Needs Improvement | Poor |
|--------|----------|------|-------------------|------|
| **LCP** — Largest Contentful Paint | Loading performance | ≤2.5s | 2.5s–4.0s | >4.0s |
| **INP** — Interaction to Next Paint | Responsiveness (replaces FID) | ≤200ms | 200ms–500ms | >500ms |
| **CLS** — Cumulative Layout Shift | Visual stability | ≤0.1 | 0.1–0.25 | >0.25 |

> **INP replaced FID** as a Core Web Vital in March 2024.

## LCP — Largest Contentful Paint

**What triggers LCP**: `<img>`, `<video>` poster, background-image via CSS, block-level text.

### Common Causes of Poor LCP

| Cause | Fix |
|-------|-----|
| Render-blocking resources | Move scripts to `defer`/`async`, inline critical CSS |
| Slow server response (TTFB >600ms) | CDN, edge caching, preconnect hints |
| LCP image not preloaded | Add `<link rel="preload" as="image">` for hero image |
| LCP image lazy-loaded | Remove `loading="lazy"` from above-fold images |
| Large uncompressed images | Use WebP/AVIF, set `srcset`, compress ≤200KB for hero |

```html
<!-- Good: preload LCP image, no lazy loading above fold -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high">
<img src="/hero.webp" alt="Hero" fetchpriority="high" width="1200" height="600">
```

## INP — Interaction to Next Paint

**What triggers INP**: Click, tap, keyboard input — measures time until next frame paint.

### Common Causes of Poor INP

| Cause | Fix |
|-------|-----|
| Long JS tasks (>50ms) blocking main thread | Break into chunks with `scheduler.yield()` |
| Heavy event handlers | Debounce input, defer non-critical work |
| Synchronous layout thrash | Batch DOM reads/writes, use `requestAnimationFrame` |
| Large React re-renders on interaction | `useMemo`, `useCallback`, virtualize long lists |

```ts
// Good: yield back to browser between chunks
async function processLargeList(items: Item[]): Promise<void> {
  for (const chunk of chunkArray(items, 50)) {
    processChunk(chunk);
    await scheduler.yield(); // let browser paint between chunks
  }
}
```

## CLS — Cumulative Layout Shift

**What causes shifts**: Elements inserted above existing content, images/iframes without dimensions, fonts swapping.

### Common Causes of Poor CLS

| Cause | Fix |
|-------|-----|
| Images without `width`/`height` | Always set explicit dimensions or `aspect-ratio` |
| Dynamic content injection (ads, banners) | Reserve space with `min-height` placeholders |
| Web fonts causing FOUT/FOIT | Use `font-display: swap` + preload key fonts |
| Animations using `top`/`left`/`margin` | Use `transform` instead (compositor-only) |

```css
/* Good: reserve space before image loads */
.hero-image {
  aspect-ratio: 16 / 9;
  width: 100%;
}

/* Good: compositor-only animation (no layout shift) */
.slide-in {
  transform: translateX(-100%);
  transition: transform 0.3s ease;
}
```

## Measurement Tools

| Tool | Purpose |
|------|---------|
| Chrome DevTools → Performance | Record and analyze LCP/CLS waterfall |
| Lighthouse | Automated audit with recommendations |
| PageSpeed Insights | Field data (CrUX) + lab data combined |
| Web Vitals extension | Real-time metric overlay in browser |
| `web-vitals` npm package | Measure in production JS |

## Audit Checklist

- [ ] LCP element identified (DevTools → Performance → Timings)
- [ ] LCP image preloaded and not lazy-loaded
- [ ] All images have explicit `width` + `height` (or `aspect-ratio`)
- [ ] No layout-shifting animations using positional properties
- [ ] Fonts preloaded with `font-display: swap`
- [ ] No long tasks >50ms in interaction handlers
- [ ] Third-party scripts loaded with `async`/`defer`
