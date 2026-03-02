---
name: vercel-react-best-practices
description: "React/Next.js performance gotchas from Vercel engineering. Non-intuitive pitfalls that LLMs commonly miss."
triggers: [react, next.js, performance, optimization, vercel, component, rendering]
priority: 60
---

# Vercel React Best Practices

## Pre-check (K1)

> Is this a React/Next.js performance issue? Standard React patterns (useState, useEffect, components) don't need this skill. Activate only for performance optimization or code review.

## CRITICAL Gotchas

### Waterfall Elimination

| Gotcha | Why Non-obvious |
|--------|----------------|
| **Sequential awaits** | `const a = await f1(); const b = await f2();` creates waterfall. Use `Promise.all([f1(), f2()])` for independent ops |
| **Await placement** | Move `await` to the branch where value is actually used, not at declaration |
| **Missing Suspense** | Wrap slow server components in `<Suspense>` to stream — don't block entire page |

### Bundle Size

| Gotcha | Why Non-obvious |
|--------|----------------|
| **Barrel imports** | `import { Button } from "@/components"` pulls entire barrel. Use `import { Button } from "@/components/Button"` |
| **Third-party in initial bundle** | Load analytics/logging AFTER hydration with `next/dynamic` or lazy `useEffect` |
| **Heavy components** | Charts, editors, maps → `next/dynamic` with `{ ssr: false }` |

## HIGH Gotchas

### Server-side

| Gotcha | Fix |
|--------|-----|
| Duplicate DB calls across server components | Wrap with `React.cache()` for per-request dedup |
| Large data serialized to client | Pick only needed fields before passing to client components |
| Blocking post-processing (logging, analytics) | Use `after()` for non-blocking tasks |

## MEDIUM Gotchas

| Gotcha | Fix |
|--------|-----|
| Expensive computation re-runs on parent re-render | Isolate in `memo()` wrapped component |
| Static JSX recreated every render | Hoist outside component: `const HEADER = <header>...</header>` |
| Long lists render all items | `content-visibility: auto; contain-intrinsic-size: 0 80px;` on list items |
| `{count && <Item />}` renders `0` | Use ternary: `{count > 0 ? <Item /> : null}` |
| Event handler changes every render → effect re-runs | Store handlers in `useRef` for stable effects |
| Object in useEffect deps | Use primitive values (id, not entire object) as dependencies |

## Done Criteria (K4)

- [ ] No sequential awaits for independent operations
- [ ] No barrel imports for tree-shakeable modules
- [ ] Server component data is `React.cache()`-wrapped where reused
- [ ] Heavy third-party loaded after hydration
- [ ] Long lists use `content-visibility: auto`
