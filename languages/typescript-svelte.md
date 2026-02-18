# 🔥 TypeScript + Svelte/SvelteKit Quality Rules

## Core Principles (inherited from core)

```markdown
✅ Single Responsibility (SRP)
✅ Don't Repeat Yourself (DRY)
✅ Reusability
✅ Low Complexity
✅ Functions ≤ 30 lines
✅ Nesting ≤ 3 levels
✅ Cyclomatic complexity ≤ 10
```

## Svelte 5 Runes (Latest Syntax)

### 1. $state - Reactive State

```svelte
<script lang="ts">
  // ✅ Declare reactive state with $state
  let count = $state(0);
  let user = $state<User | null>(null);
  let items = $state<string[]>([]);

  function increment() {
    count++;
  }

  function addItem(item: string) {
    items.push(item); // Arrays are reactive too
  }
</script>

<button onclick={increment}>Count: {count}</button>
```

### 2. $derived - Derived State

```svelte
<script lang="ts">
  let items = $state<Item[]>([]);
  let filter = $state('all');

  // ✅ Computed values with $derived
  let filteredItems = $derived(
    filter === 'all'
      ? items
      : items.filter(item => item.status === filter)
  );

  let totalPrice = $derived(
    items.reduce((sum, item) => sum + item.price, 0)
  );

  // Complex derived logic
  let stats = $derived.by(() => {
    const active = items.filter(i => i.active).length;
    const total = items.length;
    return { active, total, ratio: total ? active / total : 0 };
  });
</script>

<p>Showing {filteredItems.length} items</p>
<p>Total: ${totalPrice}</p>
```

### 3. $effect - Side Effects

```svelte
<script lang="ts">
  let searchQuery = $state('');
  let results = $state<SearchResult[]>([]);

  // ✅ Side effects with $effect
  $effect(() => {
    if (searchQuery.length < 3) {
      results = [];
      return;
    }

    const controller = new AbortController();

    fetch(`/api/search?q=${searchQuery}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { results = data; })
      .catch(() => {});

    // Return cleanup function
    return () => controller.abort();
  });

  // localStorage sync
  $effect(() => {
    localStorage.setItem('searchQuery', searchQuery);
  });
</script>
```

### 4. $props - Component Props

```svelte
<!-- UserCard.svelte -->
<script lang="ts">
  interface Props {
    user: User;
    onEdit?: (user: User) => void;
    class?: string;
  }

  // ✅ Declare props with $props
  let { user, onEdit, class: className = '' }: Props = $props();
</script>

<div class="card {className}">
  <h2>{user.name}</h2>
  <p>{user.email}</p>
  {#if onEdit}
    <button onclick={() => onEdit(user)}>Edit</button>
  {/if}
</div>
```

### 5. $bindable - Two-way Binding

```svelte
<!-- TextInput.svelte -->
<script lang="ts">
  interface Props {
    value: string;
    placeholder?: string;
  }

  // ✅ Bindable prop for two-way binding
  let { value = $bindable(), placeholder = '' }: Props = $props();
</script>

<input bind:value {placeholder} />

<!-- Usage -->
<script lang="ts">
  let name = $state('');
</script>

<TextInput bind:value={name} placeholder="Enter name" />
```

### 6. Snippets (Reusable Markup)

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    items: Item[];
    header?: Snippet;
    row: Snippet<[Item]>;
  }

  let { items, header, row }: Props = $props();
</script>

<!-- ✅ Define Snippet -->
{#snippet defaultHeader()}
  <th>Name</th>
  <th>Price</th>
{/snippet}

<table>
  <thead>
    <tr>
      {@render header?.() ?? defaultHeader()}
    </tr>
  </thead>
  <tbody>
    {#each items as item}
      <tr>
        {@render row(item)}
      </tr>
    {/each}
  </tbody>
</table>

<!-- Usage -->
<Table {items}>
  {#snippet row(item)}
    <td>{item.name}</td>
    <td>${item.price}</td>
  {/snippet}
</Table>
```

## SvelteKit Patterns

### 7. Load Functions (Server Data Loading)

```typescript
// +page.ts (Client + Server)
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const response = await fetch(`/api/users/${params.id}`);
  if (!response.ok) {
    throw error(404, 'User not found');
  }

  const user = await response.json();
  return { user };
};

// +page.server.ts (Server only)
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const user = await db.user.findUnique({
    where: { id: params.id }
  });

  if (!user) {
    throw error(404, 'User not found');
  }

  return { user };
};
```

### 8. Form Actions

```typescript
// +page.server.ts
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const actions: Actions = {
  create: async ({ request }) => {
    const data = await request.formData();
    const name = data.get('name')?.toString();
    const email = data.get('email')?.toString();

    // Validation
    if (!name || name.length < 2) {
      return fail(400, { name, email, error: 'Name is required' });
    }
    if (!email || !email.includes('@')) {
      return fail(400, { name, email, error: 'Invalid email' });
    }

    try {
      await db.user.create({ data: { name, email } });
    } catch (e) {
      return fail(500, { error: 'Failed to create user' });
    }

    throw redirect(303, '/users');
  },

  delete: async ({ request }) => {
    const data = await request.formData();
    const id = data.get('id')?.toString();

    if (!id) {
      return fail(400, { error: 'ID is required' });
    }

    await db.user.delete({ where: { id } });
    return { success: true };
  }
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<form method="POST" action="?/create" use:enhance>
  <input name="name" value={form?.name ?? ''} />
  <input name="email" type="email" value={form?.email ?? ''} />

  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}

  <button type="submit">Create</button>
</form>
```

### 9. API Routes

```typescript
// src/routes/api/users/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Number(url.searchParams.get('limit') ?? '10');

  const users = await db.user.findMany({
    skip: (page - 1) * limit,
    take: limit,
  });

  return json(users);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  if (!body.name || !body.email) {
    throw error(400, 'Name and email are required');
  }

  const user = await db.user.create({ data: body });
  return json(user, { status: 201 });
};

// src/routes/api/users/[id]/+server.ts
export const GET: RequestHandler = async ({ params }) => {
  const user = await db.user.findUnique({ where: { id: params.id } });

  if (!user) {
    throw error(404, 'User not found');
  }

  return json(user);
};

export const DELETE: RequestHandler = async ({ params }) => {
  await db.user.delete({ where: { id: params.id } });
  return new Response(null, { status: 204 });
};
```

### 10. Hooks

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Auth check
  const token = event.cookies.get('session');
  if (token) {
    const user = await validateToken(token);
    if (user) {
      event.locals.user = user;
    }
  }

  // Protected routes
  if (event.url.pathname.startsWith('/admin')) {
    if (!event.locals.user?.isAdmin) {
      throw redirect(303, '/login');
    }
  }

  return resolve(event);
};
```

## Recommended Folder Structure

```
src/
├── app.html
├── app.d.ts
├── hooks.server.ts
├── lib/
│   ├── components/
│   │   ├── Button.svelte
│   │   └── Modal.svelte
│   ├── stores/
│   │   └── user.svelte.ts
│   └── utils/
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte
│   ├── users/
│   │   ├── +page.svelte
│   │   ├── +page.server.ts
│   │   └── [id]/
│   │       ├── +page.svelte
│   │       └── +page.server.ts
│   └── api/
│       └── users/
│           └── +server.ts
└── params/
    └── id.ts
```

## Checklist

- [ ] Use Svelte 5 Runes ($state, $derived, $effect)
- [ ] Type-safe props with $props
- [ ] Reusable markup with Snippets
- [ ] Data loading with SvelteKit load functions
- [ ] Form handling with Form Actions
- [ ] API routes with +server.ts
- [ ] Auth handling with hooks.server.ts
- [ ] Use $lib alias
- [ ] Proper error handling (error, fail)
- [ ] TypeScript strict mode
