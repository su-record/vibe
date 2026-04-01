# Spatial Design Reference

Spacing, layout, and visual hierarchy systems for production UI.

---

## The 4pt Spacing System

Every spacing value in your UI should come from a single geometric scale. The 4pt system (also called the 8pt system with half-steps) gives you a predictable set of increments that compose cleanly across all screen densities.

**The scale:**

| Token | px | Tailwind class | Use case |
|-------|-----|----------------|----------|
| space-1 | 4 | `p-1` | Tight internal padding, icon nudges |
| space-2 | 8 | `p-2` | Default inline padding, compact components |
| space-3 | 12 | `p-3` | Form field padding, small card insets |
| space-4 | 16 | `p-4` | Standard component padding |
| space-6 | 24 | `p-6` | Section spacing within a card |
| space-8 | 32 | `p-8` | Card padding, modal insets |
| space-12 | 48 | `p-12` | Section separators, large layout gaps |
| space-16 | 64 | `p-16` | Page section padding |
| space-24 | 96 | `p-24` | Hero sections, full-bleed separators |

The rule is simple: if a value is not on this scale, do not use it. A spacing value of 20px or 28px is a red flag — it means someone eyeballed it. Arbitrary values fragment the visual rhythm and make future changes brittle.

**Why 4pt works:** On 1x, 2x, and 3x displays, 4px always divides evenly. A 3px gap renders at 6px on retina — still crisp. A 5px gap renders at 10px — fine. A 4px gap renders at exactly 8px — perfect. The scale is screen-density safe.

**Applying it in Tailwind:**

```tsx
// Compact list item
<div className="flex items-center gap-2 px-3 py-2">
  <Icon className="w-4 h-4" />
  <span>List item</span>
</div>

// Standard card
<div className="p-6 rounded-xl space-y-4">
  <h2 className="text-lg font-semibold">Card title</h2>
  <p className="text-sm text-zinc-500">Card body copy goes here.</p>
</div>

// Section separator
<section className="py-16 px-8">
  <div className="max-w-5xl mx-auto space-y-12">
    {/* content */}
  </div>
</section>
```

### DO / DON'T

**DO** define spacing tokens in your design system config so Tailwind's preset enforces them.

```js
// tailwind.config.ts
theme: {
  spacing: {
    '1': '4px',
    '2': '8px',
    '3': '12px',
    '4': '16px',
    '6': '24px',
    '8': '32px',
    '12': '48px',
    '16': '64px',
    '24': '96px',
  }
}
```

**DON'T** use arbitrary values in Tailwind classes unless you have an exceptional reason, and document it.

```tsx
// Bad — arbitrary, breaks rhythm
<div className="p-[18px] mt-[22px]">

// Good — on-scale, predictable
<div className="p-4 mt-6">
```

---

## Grid Systems

### 12-Column Layouts

The 12-column grid is the standard for page-level layout because 12 divides evenly into 2, 3, 4, and 6 — covering most content splits without custom math.

```tsx
// 12-column CSS Grid
<div className="grid grid-cols-12 gap-6">
  <aside className="col-span-3">Sidebar</aside>
  <main className="col-span-9">Main content</main>
</div>

// Responsive: full-width mobile, sidebar on desktop
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
  <aside className="lg:col-span-3">Sidebar</aside>
  <main className="lg:col-span-9">Main content</main>
</div>
```

### Auto-Fit Fluid Grids

For card grids and galleries where you do not know the exact column count at design time, `auto-fit` with `minmax` is the correct pattern. It eliminates the need for breakpoint-specific column counts.

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem; /* 24px = space-6 */
}
```

```tsx
// React component version
<div
  className="grid gap-6"
  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
>
  {cards.map(card => <Card key={card.id} {...card} />)}
</div>
```

The `minmax(280px, 1fr)` instruction means: "each column must be at least 280px wide, but can grow to fill available space." The browser automatically determines how many columns fit without a media query.

**Column count at common widths:**
- 320px viewport: 1 column
- 640px viewport: 2 columns
- 960px viewport: 3 columns
- 1280px viewport: 4 columns

### DO / DON'T

**DO** use `auto-fit` for homogeneous content (cards, thumbnails, product tiles).

**DON'T** use `auto-fill` when you want columns to expand to fill space — `auto-fill` keeps empty column tracks and does not expand existing ones.

```css
/* auto-fill — may leave empty tracks at wide viewports */
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));

/* auto-fit — always expands columns to fill the row */
grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
```

**DO** set a `max-width` on the grid container to prevent cards from becoming uncomfortably wide on ultrawide screens.

```tsx
<div className="max-w-7xl mx-auto px-6">
  <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
    {/* cards */}
  </div>
</div>
```

---

## Visual Hierarchy

Visual hierarchy tells the user what to look at first, second, and third. It is not about aesthetics — it is about guiding attention to reduce cognitive load.

### The Three Levels

**Primary** — One element per view. The action or information you most need the user to see. Largest text, highest contrast, most whitespace around it.

**Secondary** — Supporting context. Labels, descriptions, secondary actions. Smaller, lower contrast.

**Tertiary** — Metadata, timestamps, fine print. Subdued, visually quiet.

```tsx
// Three-level hierarchy in a card
<div className="p-6 space-y-1">
  {/* Primary */}
  <h2 className="text-2xl font-bold text-zinc-900">$129/mo</h2>
  {/* Secondary */}
  <p className="text-base text-zinc-600">Pro plan — billed annually</p>
  {/* Tertiary */}
  <p className="text-xs text-zinc-400">Renews March 31, 2027</p>
</div>
```

### Gestalt Proximity Principle

The proximity principle states that elements placed close together are perceived as belonging to the same group. This means spacing is not decoration — it encodes relationships.

**Tighter spacing = stronger relationship. Looser spacing = weaker relationship.**

```tsx
// Form field: label and input are tightly related
// Input and next field are loosely related
<div className="space-y-6"> {/* loose — between fields */}
  <div className="space-y-1"> {/* tight — label to input */}
    <label className="text-sm font-medium text-zinc-700">Email</label>
    <input className="w-full px-3 py-2 border rounded-lg" type="email" />
  </div>
  <div className="space-y-1">
    <label className="text-sm font-medium text-zinc-700">Password</label>
    <input className="w-full px-3 py-2 border rounded-lg" type="password" />
  </div>
</div>
```

The `space-y-1` (4px) between label and input signals they are one unit. The `space-y-6` (24px) between field groups signals separation. This is six times more space — the ratio matters.

### DO / DON'T

**DO** use dramatically different spacing ratios to signal relationships. A 4:1 ratio (tight vs. loose) reads clearly. A 1.5:1 ratio looks like a mistake.

**DON'T** add equal spacing between all elements. Equal spacing destroys proximity grouping and makes the layout look like an unsorted list.

```tsx
// Bad — all spacing equal, no grouping signal
<div className="space-y-4">
  <label>Email</label>
  <input />
  <label>Password</label>
  <input />
</div>

// Good — spacing encodes relationships
<div className="space-y-6">
  <div className="space-y-1">
    <label>Email</label>
    <input />
  </div>
  <div className="space-y-1">
    <label>Password</label>
    <input />
  </div>
</div>
```

---

## Container Queries

Media queries respond to the viewport. Container queries respond to the component's parent. For component libraries and design systems, container queries are almost always the right tool.

### The Problem With Media Queries for Components

A card component placed in a sidebar looks different from the same card in a main content area. With media queries, both respond to the same viewport width — so at 1280px the sidebar card explodes into a wide layout it was never designed for.

Container queries solve this: the card responds to the width of its container, not the screen.

### Setup

```css
/* Mark the container */
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}
```

```tsx
// In Tailwind (v3.3+ with @tailwindcss/container-queries plugin)
<div className="@container">
  <div className="flex flex-col @md:flex-row gap-4 p-4">
    <img className="w-full @md:w-32 rounded-lg" src={src} alt={alt} />
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-zinc-500">{description}</p>
    </div>
  </div>
</div>
```

At narrow container widths the image stacks above text. At medium container widths the layout becomes a horizontal row. This works correctly whether the component is in a sidebar, a modal, or a full-width section.

### Named Containers

When nesting containers, use names to target the right ancestor.

```css
.page-layout { container-type: inline-size; container-name: layout; }
.sidebar { container-type: inline-size; container-name: sidebar; }
```

```css
@container sidebar (min-width: 240px) {
  .nav-item { flex-direction: row; }
}
```

### DO / DON'T

**DO** use container queries for reusable components that appear in multiple layout contexts.

**DON'T** use container queries for page-level layout decisions (header, nav, footer) — viewport width is the correct signal there.

---

## The Squint Test

The squint test is a rapid validation technique for visual hierarchy. Squint (or blur) your design until text becomes unreadable. What remains visible is your hierarchy — the shapes of contrast.

A well-structured layout squints down to:
1. One dominant shape (the primary action or headline)
2. A cluster of medium shapes (content body)
3. Quiet texture in the background (tertiary content, metadata)

If everything looks equally weighted when blurred, your hierarchy is flat. Increase the contrast differential between primary, secondary, and tertiary levels.

**How to run it in practice:**
- CSS filter: `filter: blur(4px)` on a screenshot
- Figma: select all layers, reduce opacity to 50%
- Physical: step back from monitor until text is unreadable

**Common failures the squint test reveals:**
- Too many buttons with equal visual weight
- Hero headline same size as section headings
- Cards without clear focal points
- Equal contrast on primary and supporting text

---

## Whitespace as a Design Material

Whitespace is not empty space — it is a design material with real effects on perceived quality, readability, and trust.

**More space = more premium feel.** Compare the density of a fast-food menu to a high-end restaurant menu. The expensive one has more white space. The same principle applies to UI.

**Breathing room reduces cognitive load.** When elements have room to breathe, the user's eye can focus on one thing at a time. Cramped layouts force the eye to parse everything simultaneously.

**Practical guidelines:**
- Minimum 16px (space-4) padding inside any interactive component
- Minimum 24px (space-6) between distinct content sections
- At least 48px (space-12) of vertical space between major page sections
- Never let text touch the edge of a container — minimum 16px inset

```tsx
// Cramped — feels cheap, stressful
<div className="p-2">
  <h3 className="text-sm font-bold">Title</h3>
  <p className="text-xs">Description text</p>
  <button className="text-xs px-2 py-1 mt-1 bg-blue-500 text-white rounded">Action</button>
</div>

// Breathable — feels considered, premium
<div className="p-6">
  <h3 className="text-base font-semibold">Title</h3>
  <p className="text-sm text-zinc-500 mt-1">Description text</p>
  <button className="text-sm px-4 py-2 mt-4 bg-blue-500 text-white rounded-lg">Action</button>
</div>
```

---

## Consistency: Same Relationship, Same Spacing

The most important rule of spatial design is consistency. If a label sits 4px above its input in one form, it must sit 4px above its input in every form. If cards have 24px internal padding, all cards have 24px internal padding.

Inconsistency in spacing signals inconsistency in quality. Users do not consciously notice consistent spacing — but they immediately notice when something looks "off." That feeling of wrongness is almost always mismatched spacing.

**Spacing tokens enforce this automatically.** When every spacing value comes from the 4pt scale and is referenced by token name, mismatches become impossible — you would have to choose a wrong token deliberately.

### Relationship Mapping

Document the spacing relationships in your design system and enforce them in code:

| Relationship | Spacing | Tailwind |
|---|---|---|
| Label → Input | 4px | `space-y-1` |
| Input → Help text | 4px | `space-y-1` |
| Field group → Field group | 24px | `space-y-6` |
| Card inner padding | 24px | `p-6` |
| Card → Card gap | 24px | `gap-6` |
| Section → Section | 64px | `py-16` |
| Heading → Body copy | 8px | `mt-2` |
| Body copy → CTA | 32px | `mt-8` |

Once you establish this map, apply it with zero exceptions. Every deviation is a bug, not a design decision.

### DO / DON'T

**DO** extract spacing into named constants when building React component libraries.

```tsx
const SPACING = {
  fieldGap: 'space-y-6',
  fieldInner: 'space-y-1',
  cardPadding: 'p-6',
  sectionGap: 'py-16',
} as const;
```

**DON'T** adjust spacing component-by-component based on "what looks right" — this produces an inconsistent system even when each individual component looks fine in isolation.
