# Server vs Client Component Decision Guide

## Decision Tree

```
Does this component need any of the following?
    │
    ├─ useState / useReducer         → Client
    ├─ useEffect / lifecycle hooks   → Client
    ├─ Browser APIs (window, document, localStorage) → Client
    ├─ Event handlers (onClick, onChange, onSubmit)  → Client
    ├─ Third-party hooks (useRouter, useForm, etc.)  → Client
    │
    └─ None of the above?            → Server (default)
```

## Default: Server Component

Next.js App Router defaults all components to Server. Only add `"use client"` when required.

**Server components can:**
- Fetch data directly (no useEffect needed)
- Access backend resources (DB, filesystem, env secrets)
- Reduce client bundle size (zero JS shipped)
- Use `async/await` at the component level

```tsx
// Server component — no directive needed
async function UserProfile({ id }: { id: string }) {
  const user = await db.user.findUnique({ where: { id } });
  return <div>{user?.name}</div>;
}
```

## Client Component

Add `"use client"` at the top of the file.

```tsx
"use client";
import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

## Composition Pattern: Push Client Down

Keep client boundary as low as possible. Wrap only the interactive slice, not the whole page.

```tsx
// Bad: entire section becomes client
"use client";
async function ProductPage({ id }: { id: string }) { ... }

// Good: server fetches, client handles interaction
async function ProductPage({ id }: { id: string }) {
  const product = await getProduct(id);
  return (
    <div>
      <ProductDetails product={product} />   {/* server */}
      <AddToCartButton productId={id} />     {/* client — small, isolated */}
    </div>
  );
}
```

## Gotchas

| Mistake | Effect | Fix |
|---------|--------|-----|
| Importing a Client component into a Server component that passes a non-serializable prop | Runtime error | Only pass serializable data (string, number, plain object) |
| `"use client"` on a file that only uses server features | Unnecessary client bundle | Remove directive |
| `async` component without Suspense wrapper | Blocks entire parent render | Wrap in `<Suspense fallback={...}>` |
| Calling `React.cache()` in a Client component | No effect — cache is server-only | Move data fetching to Server component |
| Secrets in Client component | Exposed to browser | Move fetch to Server component or API route |

## Data Fetching Boundary

| Where | Pattern |
|-------|---------|
| Server component | `await fetch()` / direct DB call |
| Client component | `useEffect` + fetch, or SWR/React Query |
| Shared across server components | Wrap with `React.cache()` for per-request dedup |
