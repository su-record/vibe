# 🚀 TypeScript + Astro Quality Rules

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

## Astro Architecture

```
┌─────────────────────────────────────────────┐
│  .astro Components (Server-first)           │
│  - Zero JS by default                       │
│  - HTML + CSS + optional JS                 │
├─────────────────────────────────────────────┤
│  Islands (Interactive Components)           │
│  - React, Vue, Svelte, Solid               │
│  - Hydration on demand                      │
├─────────────────────────────────────────────┤
│  Content Collections (Type-safe content)    │
│  - Markdown, MDX                           │
│  - Schema validation                        │
└─────────────────────────────────────────────┘
```

## Astro Component Patterns

### 1. Basic Component Structure

```astro
---
// Component Script (Server-side TypeScript)
interface Props {
  title: string;
  description?: string;
  tags?: string[];
}

const { title, description, tags = [] } = Astro.props;

// Server-side data fetching
const posts = await fetch('https://api.example.com/posts').then(r => r.json());
---

<!-- Component Template -->
<article class="card">
  <h2>{title}</h2>
  {description && <p>{description}</p>}

  {tags.length > 0 && (
    <ul class="tags">
      {tags.map(tag => <li>{tag}</li>)}
    </ul>
  )}
</article>

<style>
  /* Scoped styles by default */
  .card {
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
  }

  .tags {
    display: flex;
    gap: 0.5rem;
    list-style: none;
    padding: 0;
  }
</style>
```

### 2. Slots and Named Slots

```astro
---
// Layout.astro
interface Props {
  title: string;
}

const { title } = Astro.props;
---

<!DOCTYPE html>
<html>
<head>
  <title>{title}</title>
  <slot name="head" />
</head>
<body>
  <header>
    <slot name="header">
      <h1>{title}</h1>
    </slot>
  </header>

  <main>
    <slot />  <!-- Default slot -->
  </main>

  <footer>
    <slot name="footer">
      <p>© 2024</p>
    </slot>
  </footer>
</body>
</html>

<!-- Usage -->
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="Home">
  <Fragment slot="header">
    <nav>...</nav>
  </Fragment>

  <p>Main content goes here</p>

  <p slot="footer">Custom footer</p>
</Layout>
```

### 3. Content Collections

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    author: z.string().default('Anonymous'),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const authorsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    avatar: z.string().url(),
  }),
});

export const collections = {
  blog: blogCollection,
  authors: authorsCollection,
};
```

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection, getEntry } from 'astro:content';
import Layout from '../../layouts/Layout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);

  return posts.map(post => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content, headings } = await post.render();
---

<Layout title={post.data.title}>
  <article>
    <h1>{post.data.title}</h1>
    <time datetime={post.data.pubDate.toISOString()}>
      {post.data.pubDate.toLocaleDateString()}
    </time>
    <Content />
  </article>
</Layout>
```

### 4. Islands (Client Interactivity)

```astro
---
// Using React component
import Counter from '../components/Counter.tsx';
import SearchBar from '../components/SearchBar.tsx';
import Newsletter from '../components/Newsletter.tsx';
import Comments from '../components/Comments.tsx';
---

<!-- No JS - static HTML -->
<h1>My Page</h1>

<!-- Hydrate on page load -->
<Counter client:load initialCount={0} />

<!-- Hydrate when visible in viewport -->
<Comments client:visible postId="123" />

<!-- Hydrate on idle (requestIdleCallback) -->
<Newsletter client:idle />

<!-- Hydrate on media query match -->
<SearchBar client:media="(min-width: 768px)" />

<!-- Never hydrate - just render HTML -->
<StaticComponent />
```

### 5. API Routes

```typescript
// src/pages/api/posts.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, url }) => {
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Number(url.searchParams.get('limit') ?? '10');

  const posts = await db.post.findMany({
    skip: (page - 1) * limit,
    take: limit,
  });

  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    if (!body.title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const post = await db.post.create({ data: body });

    return new Response(JSON.stringify(post), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

### 6. Middleware

```typescript
// src/middleware.ts
import { defineMiddleware, sequence } from 'astro:middleware';

const auth = defineMiddleware(async ({ locals, request, redirect }, next) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (token) {
    const user = await validateToken(token);
    if (user) {
      locals.user = user;
    }
  }

  // Protected routes
  if (request.url.includes('/admin') && !locals.user?.isAdmin) {
    return redirect('/login');
  }

  return next();
});

const logger = defineMiddleware(async ({ request }, next) => {
  console.log(`${request.method} ${request.url}`);
  const response = await next();
  console.log(`Response: ${response.status}`);
  return response;
});

export const onRequest = sequence(logger, auth);
```

### 7. View Transitions

```astro
---
// Layout.astro
import { ViewTransitions } from 'astro:transitions';
---

<html>
<head>
  <ViewTransitions />
</head>
<body>
  <header transition:persist>
    <nav>...</nav>
  </header>

  <main transition:animate="slide">
    <slot />
  </main>
</body>
</html>

<!-- Custom animation -->
<div transition:animate={{
  old: {
    name: 'fadeOut',
    duration: '0.2s',
    easing: 'ease-out',
  },
  new: {
    name: 'fadeIn',
    duration: '0.3s',
    easing: 'ease-in',
  },
}}>
  Content
</div>
```

### 8. Environment Variables

```typescript
// astro.config.mjs
export default defineConfig({
  vite: {
    define: {
      'import.meta.env.PUBLIC_API_URL': JSON.stringify(process.env.PUBLIC_API_URL),
    },
  },
});

// Usage in .astro files
---
const apiUrl = import.meta.env.PUBLIC_API_URL;  // Client-safe
const dbUrl = import.meta.env.DATABASE_URL;     // Server-only
---

// Type declarations (env.d.ts)
/// <reference types="astro/client" />
interface ImportMetaEnv {
  readonly DATABASE_URL: string;
  readonly PUBLIC_API_URL: string;
}
```

## Project Structure

```
src/
├── components/
│   ├── Card.astro
│   ├── Header.astro
│   └── islands/            # Interactive components
│       ├── Counter.tsx
│       └── Search.svelte
├── content/
│   ├── config.ts           # Collection schemas
│   └── blog/
│       ├── post-1.md
│       └── post-2.mdx
├── layouts/
│   ├── Layout.astro
│   └── BlogPost.astro
├── pages/
│   ├── index.astro
│   ├── blog/
│   │   ├── index.astro
│   │   └── [...slug].astro
│   └── api/
│       └── posts.ts
├── styles/
│   └── global.css
└── middleware.ts
```

## Checklist

- [ ] Use `.astro` for static content
- [ ] Use Islands only where needed (client:*)
- [ ] Define Content Collections with schemas
- [ ] Use TypeScript for type safety
- [ ] Scope styles by default
- [ ] Use slots for composition
- [ ] Implement proper error handling
- [ ] Use middleware for auth/logging
- [ ] Enable View Transitions for SPA-like navigation
- [ ] Optimize images with astro:assets
