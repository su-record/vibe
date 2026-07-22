# Technical SEO Checklist

## Meta Tags

- [ ] `<title>` unique per page, 50-60 characters
- [ ] `<meta name="description">` unique per page, 150-160 characters
- [ ] `<link rel="canonical">` on every page (including paginated, filtered)
- [ ] `<meta name="robots" content="index,follow">` — verify `noindex` is NOT in production
- [ ] `<html lang="{{LOCALE}}">` set correctly

## Open Graph / Social

- [ ] `og:title` — matches page title or optimized variant
- [ ] `og:description` — matches meta description or optimized variant
- [ ] `og:image` — exactly **1200x630px**, under 8MB
- [ ] `og:type` — `website` for homepage, `article` for posts, `product` for products
- [ ] `og:url` — canonical URL
- [ ] `twitter:card` — `summary_large_image` for image-rich pages
- [ ] `twitter:image` — same as og:image (some crawlers check separately)

## Structured Data (JSON-LD)

- [ ] Correct `@type` for content: `Article`, `Product`, `FAQPage`, `LocalBusiness`, `BreadcrumbList`
- [ ] `BreadcrumbList` on all non-root pages
- [ ] Validated with [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] No structured data describing content not visible on the page

## Crawlability

- [ ] `robots.txt` present at domain root
  - `Allow: /` for public pages
  - `Disallow: /api/`, `/admin/`, `/_next/` (static assets excepted)
  - `Sitemap: https://{{DOMAIN}}/sitemap.xml`
- [ ] `sitemap.xml` auto-generated, includes `<lastmod>` with real dates
- [ ] Sitemap submitted to Google Search Console

## Performance (Core Web Vitals)

| Metric | Target | Common Fix |
|--------|--------|------------|
| LCP | ≤ 2.5s | `<link rel="preload">` on hero image |
| INP | ≤ 200ms | Defer non-critical JS |
| CLS | ≤ 0.1 | Set `width`/`height` on all images; `min-height` on dynamic containers |

- [ ] Images have explicit `width` and `height` attributes
- [ ] Below-fold images use `loading="lazy"`
- [ ] Hero/LCP image uses `fetchpriority="high"` (not lazy)
- [ ] No render-blocking scripts without `defer` or `async`
