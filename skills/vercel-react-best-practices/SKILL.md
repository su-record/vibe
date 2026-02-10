---
name: vercel-react-best-practices
description: "React/Next.js performance optimization guide (based on Vercel engineering). Auto-activates when writing, reviewing, or refactoring React components. 45 rules across 8 priority categories."
triggers: [react, next.js, performance, optimization, vercel, component, rendering]
priority: 60
---

# Vercel React Best Practices

Comprehensive React/Next.js performance optimization guide from the Vercel engineering team. 45 rules organized into 8 categories with an impact-based priority system.

## When to Apply

- When writing React components or Next.js pages
- When implementing data fetching (client/server)
- During performance-focused code reviews
- When refactoring existing React/Next.js code
- When optimizing bundle size or load times

## Priority System by Category

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Waterfall Elimination | CRITICAL | `async-` |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` |
| 3 | Server-side Performance | HIGH | `server-` |
| 4 | Client Data Fetching | MEDIUM-HIGH | `client-` |
| 5 | Re-render Optimization | MEDIUM | `rerender-` |
| 6 | Rendering Performance | MEDIUM | `rendering-` |
| 7 | JavaScript Performance | LOW-MEDIUM | `js-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

## Quick Reference — 45 Rule Index

### 1. Waterfall Elimination (CRITICAL)

| Rule | Description |
|------|-------------|
| `async-defer-await` | Move await to the branch where the value is actually used |
| `async-parallel` | Use `Promise.all()` for independent operations |
| `async-dependencies` | Use better-all for partial dependencies |
| `async-api-routes` | Start Promises early, await late |
| `async-suspense-boundaries` | Stream content with Suspense |

**Key Example — `async-parallel` (CRITICAL):**

```typescript
// ❌ Bad: sequential execution → waterfall
const user = await getUser(id);
const posts = await getPosts(id);
const comments = await getComments(id);

// ✅ Good: parallel execution
const [user, posts, comments] = await Promise.all([
  getUser(id),
  getPosts(id),
  getComments(id),
]);
```

### 2. Bundle Size Optimization (CRITICAL)

| Rule | Description |
|------|-------------|
| `bundle-barrel-imports` | Avoid barrel files, use direct imports |
| `bundle-dynamic-imports` | Use `next/dynamic` for heavy components |
| `bundle-defer-third-party` | Load analytics/logging after hydration |
| `bundle-conditional` | Load modules only when feature is enabled |
| `bundle-preload` | Preload on hover/focus for perceived speed |

**Key Example — `bundle-barrel-imports` (CRITICAL):**

```typescript
// ❌ Bad: barrel import → included in entire bundle
import { Button } from "@/components";

// ✅ Good: direct import → tree-shakeable
import { Button } from "@/components/Button";
```

### 3. Server-side Performance (HIGH)

| Rule | Description |
|------|-------------|
| `server-cache-react` | Deduplicate per-request with `React.cache()` |
| `server-cache-lru` | Cross-request caching with LRU cache |
| `server-serialization` | Minimize data passed to client components |
| `server-parallel-fetching` | Redesign component structure for parallel fetching |
| `server-after-nonblocking` | Non-blocking post-processing with `after()` |

**Key Example — `server-cache-react` (HIGH):**

```typescript
// ❌ Bad: duplicate DB calls within same request
async function Layout() {
  const user = await getUser(); // call 1
  return <Header user={user}><Content /></Header>;
}
async function Content() {
  const user = await getUser(); // call 2 (duplicate)
  return <div>{user.name}</div>;
}

// ✅ Good: per-request deduplication with React.cache
import { cache } from "react";
const getUser = cache(async () => {
  return await db.user.findUnique({ where: { id: currentUserId } });
});
```

### 4. Client Data Fetching (MEDIUM-HIGH)

| Rule | Description |
|------|-------------|
| `client-swr-dedup` | Auto-deduplicate requests with SWR |
| `client-event-listeners` | Prevent duplicate global event listener registration |

**Key Example — `client-swr-dedup` (MEDIUM-HIGH):**

```typescript
// ❌ Bad: duplicate API calls from multiple components
function Header() {
  const [user, setUser] = useState(null);
  useEffect(() => { fetch("/api/user").then(r => r.json()).then(setUser); }, []);
  return <div>{user?.name}</div>;
}
function Sidebar() {
  const [user, setUser] = useState(null);
  useEffect(() => { fetch("/api/user").then(r => r.json()).then(setUser); }, []);
  return <div>{user?.email}</div>;
}

// ✅ Good: auto-deduplication + caching with SWR
import useSWR from "swr";
function useUser() {
  return useSWR("/api/user", fetcher);
}
function Header() {
  const { data: user } = useUser(); // same key → auto-deduplicated
  return <div>{user?.name}</div>;
}
function Sidebar() {
  const { data: user } = useUser(); // only 1 network request
  return <div>{user?.email}</div>;
}
```

### 5. Re-render Optimization (MEDIUM)

| Rule | Description |
|------|-------------|
| `rerender-defer-reads` | Avoid subscribing to state used only in callbacks |
| `rerender-memo` | Isolate expensive computations in memoized components |
| `rerender-dependencies` | Use primitive values for effect dependencies |
| `rerender-derived-state` | Subscribe to derived booleans instead of raw data |
| `rerender-functional-setstate` | Use functional setState for stable callbacks |
| `rerender-lazy-state-init` | Pass functions for expensive initial values |
| `rerender-transitions` | Use startTransition for non-urgent updates |

**Key Example — `rerender-memo` (MEDIUM):**

```typescript
// ❌ Bad: expensive computation re-runs on every parent re-render
function Dashboard({ data, filter }) {
  const processed = expensiveProcess(data); // runs every time
  return <Chart data={processed} />;
}

// ✅ Good: isolate expensive computation in memoized component
const ProcessedChart = memo(function ProcessedChart({ data }: { data: Data[] }) {
  const processed = expensiveProcess(data);
  return <Chart data={processed} />;
});
```

### 6. Rendering Performance (MEDIUM)

| Rule | Description |
|------|-------------|
| `rendering-animate-svg-wrapper` | Animate div wrapper instead of SVG elements |
| `rendering-content-visibility` | Apply content-visibility to long lists |
| `rendering-hoist-jsx` | Hoist static JSX outside components |
| `rendering-svg-precision` | Reduce SVG coordinate precision |
| `rendering-hydration-no-flicker` | Prevent client-only data flicker with inline scripts |
| `rendering-activity` | Use Activity component for show/hide |
| `rendering-conditional-render` | Use ternary instead of `&&` |

**Key Example — `rendering-content-visibility` (MEDIUM):**

```css
/* ❌ Bad: render all items in a long list immediately */
.list-item {
  /* default: render all items */
}

/* ✅ Good: defer rendering for off-viewport items */
.list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

**Key Example — `rendering-hoist-jsx` (MEDIUM):**

```typescript
// ❌ Bad: static JSX recreated on every re-render
function Page({ data }) {
  return (
    <div>
      <header><h1>My App</h1><nav>...</nav></header>
      <main>{data.map(item => <Card key={item.id} {...item} />)}</main>
    </div>
  );
}

// ✅ Good: hoist static JSX outside component
const HEADER = <header><h1>My App</h1><nav>...</nav></header>;

function Page({ data }) {
  return (
    <div>
      {HEADER}
      <main>{data.map(item => <Card key={item.id} {...item} />)}</main>
    </div>
  );
}
```

### 7. JavaScript Performance (LOW-MEDIUM)

| Rule | Description |
|------|-------------|
| `js-batch-dom-css` | Batch CSS changes via class or cssText |
| `js-index-maps` | Index repeated lookups with Map |
| `js-cache-property-access` | Cache object property access in loops |
| `js-cache-function-results` | Cache function results in module-level Map |
| `js-cache-storage` | Cache localStorage/sessionStorage reads |
| `js-combine-iterations` | Combine multiple filter/map into single loop |
| `js-length-check-first` | Check array length before expensive comparisons |
| `js-early-exit` | Early return from functions |
| `js-hoist-regexp` | Hoist RegExp creation out of loops |
| `js-min-max-loop` | Calculate min/max with loop instead of sort |
| `js-set-map-lookups` | Use Set/Map for O(1) lookups |
| `js-tosorted-immutable` | Use toSorted() for immutable sorting |

### 8. Advanced Patterns (LOW)

| Rule | Description |
|------|-------------|
| `advanced-event-handler-refs` | Store event handlers in refs |
| `advanced-use-latest` | Use useLatest for stable callback refs |

**Key Example — `advanced-event-handler-refs` (LOW):**

```typescript
// ❌ Bad: event handler changes every render → effect re-runs
function useInterval(callback: () => void, delay: number) {
  useEffect(() => {
    const id = setInterval(callback, delay);
    return () => clearInterval(id);
  }, [callback, delay]); // callback changes every time
}

// ✅ Good: ref holds latest handler → stable effect
function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; });
  useEffect(() => {
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]); // only depends on delay
}
```

## Rule Count Summary by Category

| Category | Rules | Impact |
|----------|-------|--------|
| Waterfall Elimination | 5 | CRITICAL |
| Bundle Size Optimization | 5 | CRITICAL |
| Server-side Performance | 5 | HIGH |
| Client Data Fetching | 2 | MEDIUM-HIGH |
| Re-render Optimization | 7 | MEDIUM |
| Rendering Performance | 7 | MEDIUM |
| JavaScript Performance | 12 | LOW-MEDIUM |
| Advanced Patterns | 2 | LOW |
| **Total** | **45** | |

## Usage

This skill provides a Quick Reference index and key examples per category. For detailed explanations and full code examples of each rule, refer to the CCPP AGENTS.md.

### Priority-Based Application Strategy

1. **CRITICAL (Priority 1-2)**: Must apply in all projects
2. **HIGH (Priority 3)**: Apply when using server components
3. **MEDIUM (Priority 4-6)**: Review first when performance issues arise
4. **LOW (Priority 7-8)**: Selectively apply during optimization phase

### VIBE Tool Integration

- `core_analyze_complexity` — Analyze component complexity
- `core_validate_code_quality` — Validate code quality
- `/vibe.review` — 13+ agent parallel review (includes performance-reviewer)
