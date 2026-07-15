# Design Token Naming Conventions

Reference for evaluating and creating design tokens. Consistent naming prevents duplication and aids discovery.

---

## Naming Structure

```
--{category}-{scale-or-variant}[-{modifier}]
```

Examples: `--color-primary`, `--space-4`, `--radius-md`, `--shadow-lg-hover`

---

## Color Tokens

### Semantic over descriptive

| Preferred | Avoid | Reason |
|-----------|-------|--------|
| `--color-primary` | `--color-blue` | Blue may change; "primary" is stable |
| `--color-surface` | `--color-white` | White fails in dark mode |
| `--color-border` | `--color-gray-200` | Ties to a specific shade, not intent |
| `--color-error` | `--color-red` | Semantic meaning is the point |
| `--color-text-muted` | `--color-gray-500` | Describes role, not value |

### Required color token set

| Token | Purpose |
|-------|---------|
| `--color-primary` | Primary brand action color |
| `--color-primary-hover` | Hover state of primary |
| `--color-secondary` | Secondary action color |
| `--color-surface` | Default background surface |
| `--color-surface-raised` | Cards, elevated surfaces |
| `--color-surface-overlay` | Modals, popovers |
| `--color-border` | Default border |
| `--color-border-focus` | Focus ring color |
| `--color-text` | Primary body text |
| `--color-text-muted` | Secondary/subdued text |
| `--color-error` | Error states |
| `--color-success` | Success states |
| `--color-warning` | Warning states |

---

## Spacing Tokens

Use a numeric scale tied to a base unit (4px or 8px).

| Token | 4px base | 8px base | Use |
|-------|----------|----------|-----|
| `--space-1` | 4px | 8px | Tight gaps |
| `--space-2` | 8px | 16px | Icon-text gap |
| `--space-3` | 12px | 24px | Input padding |
| `--space-4` | 16px | 32px | Card padding |
| `--space-6` | 24px | 48px | Section gap |
| `--space-8` | 32px | 64px | Large section |
| `--space-12` | 48px | 96px | Hero spacing |

---

## Typography Tokens

| Token | Purpose |
|-------|---------|
| `--text-xs` | Caption, footnote |
| `--text-sm` | Secondary labels |
| `--text-base` | Body text (≥16px on mobile) |
| `--text-lg` | Emphasized body |
| `--text-xl` | Subheading |
| `--text-2xl` | Section heading |
| `--text-3xl` | Page heading |
| `--text-4xl` | Hero heading |
| `--font-normal` | 400 weight |
| `--font-medium` | 500 weight |
| `--font-semibold` | 600 weight |
| `--font-bold` | 700 weight |
| `--leading-tight` | 1.2 (headings) |
| `--leading-normal` | 1.5 (body) |
| `--leading-relaxed` | 1.75 (long-form) |

---

## Border Radius Tokens

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | 4px | Tags, badges |
| `--radius-md` | 6–8px | Inputs, buttons |
| `--radius-lg` | 12px | Cards |
| `--radius-xl` | 16px | Large panels |
| `--radius-full` | 9999px | Pills, avatars |

---

## Shadow Tokens

| Token | Use |
|-------|-----|
| `--shadow-sm` | Subtle card lift |
| `--shadow-md` | Default card shadow |
| `--shadow-lg` | Popovers, dropdowns |
| `--shadow-xl` | Modals, floating panels |

---

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| `--blue-500` | Descriptive, breaks dark mode | Use `--color-primary` |
| `--margin-top-16` | Property-specific; use spacing scale | Use `--space-4` |
| `--button-text-color` | Component-scoped; can't be shared | Use `--color-text` or `--color-primary` |
| `--size-large` | Ambiguous category | Specify: `--text-lg`, `--radius-lg`, `--space-lg` |
