---
name: seo-checklist
description: "SEO gotchas for web development - easy-to-miss items that hurt search ranking"
triggers: [seo, search, meta, sitemap, schema, structured data, og, opengraph, google, naver]
priority: 65
---

# SEO Checklist

## Pre-check (K1)

> Is this a public-facing web page that needs search visibility? Internal tools, admin panels, and authenticated-only pages don't need SEO optimization.

## Easy-to-Miss Gotchas

### Meta & Social

| Gotcha | Why It Hurts | Fix |
|--------|-------------|-----|
| Missing `<link rel="canonical">` | Duplicate content penalty from URL variants | Set canonical on every page, including paginated |
| OG image wrong size | Cropped/pixelated on social share | Must be exactly **1200x630px** |
| Same title/description on all pages | Google treats as duplicate content | Unique title (50-60 chars) + description (150-160 chars) per page |
| Missing `og:type` | Defaults to "website" for articles | Set `article` for posts, `product` for products |

### Technical

| Gotcha | Why It Hurts | Fix |
|--------|-------------|-----|
| `robots.txt` blocks important pages | Pages not indexed | `Allow: /` for public, only block `/api/`, `/admin/` |
| No sitemap or stale sitemap | Crawler misses new pages | Auto-generate, include `<lastmod>` with real dates |
| `noindex` left in production | Entire site invisible | Verify `<meta name="robots">` in production build |
| Images without `width`/`height` | CLS layout shift penalty | Always set dimensions + `loading="lazy"` for below-fold |

### Core Web Vitals

| Metric | Target | Common Miss |
|--------|--------|-------------|
| LCP | ≤2.5s | Hero image not preloaded — add `<link rel="preload">` |
| INP | ≤200ms | Heavy JS on interaction — defer non-critical scripts |
| CLS | ≤0.1 | Dynamic content without reserved space — set `min-height` |

### Structured Data

| Gotcha | Fix |
|--------|-----|
| JSON-LD not validated | Test with Google Rich Results Test before deploy |
| Wrong `@type` | `Product` for products, `Article` for posts, `FAQPage` for FAQs |
| Missing `BreadcrumbList` | Add breadcrumb schema for all non-root pages |

## Done Criteria (K4)

- [ ] Every page has unique title, description, canonical URL
- [ ] OG images are 1200x630px on all shareable pages
- [ ] `robots.txt` and `sitemap.xml` present and correct
- [ ] Structured data validates in Rich Results Test
- [ ] Core Web Vitals green (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1)
- [ ] No `noindex` tags in production
