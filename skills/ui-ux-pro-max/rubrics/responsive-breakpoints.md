# Standard Breakpoint Definitions

Reference for responsive design implementation across all stacks.

---

## Core Breakpoints

| Name | Min Width | Target Devices | Priority |
|------|-----------|---------------|----------|
| `xs` | 375px | Small phones (iPhone SE, Galaxy A) | Test target |
| `sm` | 640px | Large phones (landscape), small tablets | Layout change |
| `md` | 768px | Tablets (portrait), large phones | Major breakpoint |
| `lg` | 1024px | Tablets (landscape), small laptops | Major breakpoint |
| `xl` | 1280px | Standard desktop | Primary design target |
| `2xl` | 1536px | Large monitors | Wide-layout target |

---

## Framework Mappings

| Breakpoint | Tailwind class | CSS media query | Common use |
|------------|---------------|-----------------|------------|
| Mobile default | (no prefix) | base styles | Mobile-first base |
| sm | `sm:` | `@media (min-width: 640px)` | Large phone adjustments |
| md | `md:` | `@media (min-width: 768px)` | Tablet layout |
| lg | `lg:` | `@media (min-width: 1024px)` | Desktop layout |
| xl | `xl:` | `@media (min-width: 1280px)` | Wide desktop |
| 2xl | `2xl:` | `@media (min-width: 1536px)` | Ultra-wide |

---

## Layout Behavior by Breakpoint

### Navigation
| Breakpoint | Pattern |
|------------|---------|
| < md | Hamburger menu / bottom tab bar |
| md–lg | Collapsed sidebar or top nav with fewer items |
| ≥ lg | Full sidebar or top nav with all items visible |

### Content Grid
| Breakpoint | Columns |
|------------|---------|
| xs–sm | 1 column |
| md | 2 columns |
| lg | 3 columns |
| xl+ | 4 columns (data-heavy) or 3 columns (content) |

### Typography Scale Adjustments
| Element | Mobile | Desktop |
|---------|--------|---------|
| Hero heading | `text-3xl` (30px) | `text-5xl` (48px) |
| Section heading | `text-xl` (20px) | `text-3xl` (30px) |
| Body | `text-base` (16px) | `text-base` (16px) — never reduce below 16px |
| Caption | `text-sm` (14px) | `text-sm` (14px) |

---

## Touch Target Rules

| Device | Minimum touch target | Recommended |
|--------|---------------------|-------------|
| Mobile (< md) | 44×44px | 48×48px |
| Tablet (md–lg) | 44×44px | 44×44px |
| Desktop (≥ lg) | 32×32px (mouse) | 36×36px |

---

## Testing Checklist

| Breakpoint | Must Verify |
|------------|-------------|
| 375px | No horizontal scroll; text readable; nav accessible; forms usable |
| 768px | Layout transitions correctly; no content overlap |
| 1024px | Desktop features visible; sidebar or nav fully expanded |
| 1440px | Max-width container centered; content not stretched too wide |

### Max-width containers

| Use case | Recommended max-width |
|----------|-----------------------|
| Marketing / landing pages | `max-w-5xl` (1024px) or `max-w-6xl` (1152px) |
| Application layouts | `max-w-7xl` (1280px) |
| Reading / article content | `max-w-2xl` (672px) or `max-w-3xl` (768px) |
| Full-bleed dashboards | None (use grid with sidebars) |

---

## Container Query Usage

Use `@container` when a component's layout depends on its parent width, not the viewport.

| Scenario | Use viewport breakpoint | Use container query |
|----------|------------------------|---------------------|
| Page-level layout | Yes | No |
| Component in sidebar vs main | No | Yes |
| Card grid columns | No | Yes |
| Navbar collapsing | Yes | No |
