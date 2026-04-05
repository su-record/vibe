# Content SEO Checklist

## Heading Structure

- [ ] Single `<h1>` per page — matches primary keyword intent
- [ ] Logical hierarchy: `h1 → h2 → h3` (no skipping levels)
- [ ] `<h2>` tags cover major subtopics (crawlers use for content outline)
- [ ] No headings used purely for styling — use CSS classes instead

## Keyword Placement

- [ ] Primary keyword in `<title>`, `<h1>`, first 100 words of body
- [ ] Secondary keywords in `<h2>` tags and body naturally
- [ ] Keyword in image `alt` text where relevant (descriptive, not stuffed)
- [ ] URL slug contains primary keyword (lowercase, hyphens, no stop words)

## Internal Linking

- [ ] Every important page reachable within 3 clicks from homepage
- [ ] Anchor text is descriptive ("authentication guide") not generic ("click here")
- [ ] New content links back to related existing content
- [ ] Orphan pages (no inbound internal links) have at least one link added

## Content Quality Signals

- [ ] Word count appropriate for topic depth (informational: 1000+, landing: 300-600)
- [ ] No duplicate content across pages — each URL has unique value
- [ ] Pagination uses `rel="next"` / `rel="prev"` or canonical to main page
- [ ] Thin content pages (< 300 words) either expanded or `noindex` applied

## Images & Media

- [ ] Every `<img>` has descriptive `alt` text (empty `alt=""` for decorative images)
- [ ] File names descriptive: `product-dashboard-screenshot.webp` not `IMG_4821.jpg`
- [ ] Use WebP or AVIF format where possible
- [ ] Videos have transcript or caption for accessibility and crawlability

## Localization (if applicable)

- [ ] `hreflang` tags on all translated pages
- [ ] Each locale version has its own canonical URL
- [ ] `hreflang` includes `x-default` for language selector page
