---
name: structured-data
type: framework
applies-to: [seo-checklist]
format: JSON-LD
---

# Structured Data — JSON-LD Schema Templates

Embed in `<script type="application/ld+json">` in `<head>` or before `</body>`.

## Article

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title (max 110 chars)",
  "description": "Article summary (max 160 chars)",
  "image": "https://example.com/article-image.jpg",
  "author": {
    "@type": "Person",
    "name": "Author Name",
    "url": "https://example.com/authors/name"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Publisher Name",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png"
    }
  },
  "datePublished": "2024-01-15T08:00:00+00:00",
  "dateModified": "2024-01-20T10:00:00+00:00",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://example.com/article-slug"
  }
}
```

**Required by Google**: `headline`, `image`, `datePublished`, `author`

## Product

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Product description",
  "image": ["https://example.com/product-1.jpg", "https://example.com/product-2.jpg"],
  "sku": "PROD-123",
  "brand": {
    "@type": "Brand",
    "name": "Brand Name"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/product",
    "priceCurrency": "USD",
    "price": "29.99",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "127"
  }
}
```

**Required by Google**: `name` + one of `review`, `aggregateRating`, or `offers`

## FAQ

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the return policy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We accept returns within 30 days of purchase. Items must be unused and in original packaging."
      }
    },
    {
      "@type": "Question",
      "name": "How long does shipping take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Standard shipping takes 3-5 business days. Express shipping is available for 1-2 day delivery."
      }
    }
  ]
}
```

**Note**: Each Q&A must appear as visible content on the page. Do not use for ad content.

## BreadcrumbList

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://example.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Category",
      "item": "https://example.com/category"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Product Name",
      "item": "https://example.com/category/product"
    }
  ]
}
```

**Note**: `position` must be sequential starting at 1. Last item does not require `item` URL.

## Validation

| Tool | URL |
|------|-----|
| Google Rich Results Test | https://search.google.com/test/rich-results |
| Schema.org Validator | https://validator.schema.org |
| Chrome DevTools → Network | Filter for `application/ld+json` |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Price without currency | Always include `priceCurrency` with `price` |
| Missing `datePublished` on Article | Required for Google News eligibility |
| FAQ content not visible on page | Google penalizes hidden Q&A markup |
| Breadcrumb positions not sequential | Use 1, 2, 3 — no skipping |
| Image URL not absolute | Always use full `https://` URLs |
