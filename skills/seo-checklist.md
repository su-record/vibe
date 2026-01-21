---
name: seo-checklist
description: "SEO/GEO checklist for web development - meta tags, structured data, Core Web Vitals"
triggers: [seo, search, meta, sitemap, schema, structured data, og, opengraph, google, naver]
priority: 65
---
# SEO Checklist Skill

Development output SEO quality checklist for web projects.

## When to Use

- Web application development with `/vibe.run`
- Landing pages and marketing sites
- E-commerce product pages
- Content-heavy applications

## Essential SEO Elements

### 1. Meta Tags (Required)

```html
<!-- Basic -->
<title>Page Title - Brand (50-60 chars)</title>
<meta name="description" content="Compelling description (150-160 chars)">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://example.com/page">

<!-- Open Graph -->
<meta property="og:title" content="Title">
<meta property="og:description" content="Description">
<meta property="og:image" content="https://example.com/og-image.png">
<meta property="og:url" content="https://example.com/page">
<meta property="og:type" content="website">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Title">
<meta name="twitter:description" content="Description">
<meta name="twitter:image" content="https://example.com/twitter-image.png">
```

### 2. Structured Data (Schema.org)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page Title",
  "description": "Page description",
  "url": "https://example.com/page"
}
</script>
```

#### Common Schema Types

| Type | Use Case |
|------|----------|
| `Organization` | Company/brand pages |
| `Product` | E-commerce product pages |
| `Article` | Blog posts, news |
| `FAQPage` | FAQ sections |
| `BreadcrumbList` | Navigation breadcrumbs |
| `LocalBusiness` | Local/physical stores |

### 3. Technical SEO Files

#### robots.txt
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
```

#### sitemap.xml
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

### 4. Performance (Core Web Vitals)

| Metric | Good | Needs Work | Poor |
|--------|------|------------|------|
| LCP (Largest Contentful Paint) | ≤2.5s | ≤4.0s | >4.0s |
| INP (Interaction to Next Paint) | ≤200ms | ≤500ms | >500ms |
| CLS (Cumulative Layout Shift) | ≤0.1 | ≤0.25 | >0.25 |

### 5. Image Optimization

```html
<!-- Responsive images -->
<img
  src="image.webp"
  alt="Descriptive alt text"
  width="800"
  height="600"
  loading="lazy"
  decoding="async"
>

<!-- Next.js Image -->
<Image
  src="/image.webp"
  alt="Descriptive alt text"
  width={800}
  height={600}
  priority={false}
/>
```

## Framework-Specific Implementation

### Next.js (App Router)

```typescript
// app/layout.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Site Name',
    template: '%s | Site Name',
  },
  description: 'Site description',
  openGraph: {
    title: 'Site Name',
    description: 'Site description',
    url: 'https://example.com',
    siteName: 'Site Name',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'ko_KR',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

### React (Vite + react-helmet-async)

```typescript
import { Helmet } from 'react-helmet-async';

function SEO({ title, description, image }) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
    </Helmet>
  );
}
```

## Quality Checklist

### Pre-Launch

- [ ] All pages have unique title and description
- [ ] Open Graph tags on all shareable pages
- [ ] Structured data validates (Google Rich Results Test)
- [ ] robots.txt allows important pages
- [ ] sitemap.xml includes all public pages
- [ ] canonical URLs set correctly
- [ ] Images have alt text
- [ ] No broken links (404s)

### Performance

- [ ] LCP < 2.5s on mobile
- [ ] Images optimized (WebP, lazy loading)
- [ ] CSS/JS minified and compressed
- [ ] Server response time < 200ms

### Accessibility (SEO Impact)

- [ ] Semantic HTML (h1-h6 hierarchy)
- [ ] ARIA labels where needed
- [ ] Keyboard navigation works
- [ ] Color contrast meets WCAG AA

## Validation Tools

| Tool | Purpose |
|------|---------|
| [Google Search Console](https://search.google.com/search-console) | Index status, errors |
| [Google Rich Results Test](https://search.google.com/test/rich-results) | Schema validation |
| [PageSpeed Insights](https://pagespeed.web.dev/) | Core Web Vitals |
| [Lighthouse](https://developer.chrome.com/docs/lighthouse) | SEO audit |
| [Ahrefs/Screaming Frog](https://www.screamingfrog.co.uk/) | Site crawl |

## Integration with /vibe.run

During implementation phase, check:

1. **Phase 1 (Setup)**: Create robots.txt, sitemap structure
2. **Phase 2-3 (Core)**: Add meta tags to layout/pages
3. **Phase 4 (Polish)**: Validate structured data, test OG images
4. **Phase 5 (QA)**: Run Lighthouse SEO audit, fix issues

## Generative Engine Optimization (AI 검색)

For AI search engines (ChatGPT, Perplexity, Google AI Overviews):

### Content Structure for LLM Citation

- Add summary paragraph at page top
- Use clear Q&A format for FAQs
- Include data/statistics with sources
- Add author, publish date, last updated
- Structure content with clear headings

### Machine-Readable Formats

```json
// /api/public/faq.json (optional)
{
  "faqs": [
    {
      "question": "What is X?",
      "answer": "X is...",
      "source": "https://example.com/docs",
      "lastUpdated": "2024-01-01"
    }
  ]
}
```
