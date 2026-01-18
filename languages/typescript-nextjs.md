# TypeScript + Next.js Quality Rules

## Core Principles (inherited from core + React)

```markdown
# Core Principles (inherited from core + React)
Single Responsibility (SRP)
No Duplication (DRY)
Reusability
Low Complexity
Function <= 30 lines, JSX <= 50 lines
All React rules apply
```

## Next.js Specific Rules

### 1. App Router (Next.js 13+) First

```typescript
// Good: App Router structure
app/
├── layout.tsx              # Root layout
├── page.tsx                # Home page
├── loading.tsx             # Loading UI
├── error.tsx               # Error UI
├── not-found.tsx           # 404 page
├── users/
│   ├── page.tsx           # /users
│   ├── [id]/
│   │   └── page.tsx       # /users/:id
│   └── loading.tsx        # /users loading
└── api/
    └── users/
        └── route.ts       # API Route

// Good: Server Component (default)
export default async function UsersPage() {
  // Fetch data on server
  const users = await getUsers();

  return (
    <div>
      <h1>Users</h1>
      <UserList users={users} />
    </div>
  );
}

// Good: Client Component (only when needed)
'use client';

import { useState } from 'react';

export function InteractiveButton() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### 2. Server Components vs Client Components

```typescript
// Good: Server Component (recommended)
// - Data fetching
// - Environment variable access
// - Direct DB access
// - Sensitive information handling

async function UserProfile({ userId }: { userId: string }) {
  // Runs only on server (API key not exposed)
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  return <div>{user.name}</div>;
}

// Good: Client Component (only when needed)
// - useState, useEffect usage
// - Event handlers
// - Browser APIs
// - Third-party libraries (mostly)

'use client';

function SearchBar() {
  const [query, setQuery] = useState('');

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

### 3. Data Fetching Patterns

```typescript
// Good: Direct fetch in Server Component
async function PostsPage() {
  // Auto caching, revalidation
  const posts = await fetch('https://api.example.com/posts', {
    next: { revalidate: 60 }, // 60 second cache
  }).then(res => res.json());

  return <PostList posts={posts} />;
}

// Good: Parallel data fetching
async function UserDashboard({ userId }: { userId: string }) {
  const [user, posts, comments] = await Promise.all([
    getUser(userId),
    getUserPosts(userId),
    getUserComments(userId),
  ]);

  return (
    <div>
      <UserCard user={user} />
      <PostList posts={posts} />
      <CommentList comments={comments} />
    </div>
  );
}

// Good: Sequential data fetching (dependencies)
async function UserWithPosts({ username }: { username: string }) {
  // 1. Get user
  const user = await getUserByUsername(username);

  // 2. Get posts by user ID
  const posts = await getUserPosts(user.id);

  return (
    <div>
      <UserCard user={user} />
      <PostList posts={posts} />
    </div>
  );
}
```

### 4. API Routes (Route Handlers)

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

// Good: GET /api/users
export async function GET(request: NextRequest) {
  try {
    const users = await db.user.findMany();
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// Good: POST /api/users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createUserSchema.parse(body);

    const user = await db.user.create({ data });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// app/api/users/[id]/route.ts
// Good: GET /api/users/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await db.user.findUnique({
    where: { id: params.id },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}
```

### 5. Metadata & SEO

```typescript
// Good: Static metadata
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My App',
  description: 'My awesome app',
  openGraph: {
    title: 'My App',
    description: 'My awesome app',
    images: ['/og-image.png'],
  },
};

// Good: Dynamic metadata
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const user = await getUser(params.id);

  return {
    title: user.name,
    description: user.bio,
    openGraph: {
      title: user.name,
      images: [user.avatar],
    },
  };
}
```

### 6. Streaming & Suspense

```typescript
// Good: Streaming for fast initial render
import { Suspense } from 'react';

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Fast component renders first */}
      <QuickStats />

      {/* Slow component streams later */}
      <Suspense fallback={<ChartSkeleton />}>
        <SlowChart />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <SlowTable />
      </Suspense>
    </div>
  );
}

async function SlowChart() {
  const data = await fetchSlowData();
  return <Chart data={data} />;
}
```

### 7. Server Actions

```typescript
// Good: Server Action (runs only on server)
'use server';

import { revalidatePath } from 'next/cache';

export async function createUser(formData: FormData) {
  const email = formData.get('email') as string;
  const name = formData.get('name') as string;

  // Direct DB access on server
  const user = await db.user.create({
    data: { email, name },
  });

  // Cache revalidation
  revalidatePath('/users');

  return user;
}

// Good: Usage on client
'use client';

import { createUser } from './actions';

export function CreateUserForm() {
  return (
    <form action={createUser}>
      <input name="email" type="email" required />
      <input name="name" required />
      <button type="submit">Create</button>
    </form>
  );
}
```

### 8. Middleware

```typescript
// middleware.ts (root)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Auth check
  const token = request.cookies.get('token')?.value;

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Add headers
  const response = NextResponse.next();
  response.headers.set('X-Custom-Header', 'value');

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

### 9. Environment Variables

```typescript
// Good: Server-only environment variables
const dbUrl = process.env.DATABASE_URL; // Server components only
const apiKey = process.env.API_SECRET_KEY;

// Good: Client-exposed environment variables (NEXT_PUBLIC_ prefix)
const publicUrl = process.env.NEXT_PUBLIC_API_URL;

// .env.local
DATABASE_URL=postgresql://...
API_SECRET_KEY=secret123
NEXT_PUBLIC_API_URL=https://api.example.com
```

### 10. Image Optimization

```typescript
import Image from 'next/image';

// Good: Next.js Image component (auto optimization)
export function UserAvatar({ user }: { user: User }) {
  return (
    <Image
      src={user.avatar}
      alt={user.name}
      width={100}
      height={100}
      priority // priority for LCP images
    />
  );
}

// Good: External images (requires next.config.js configuration)
// next.config.js
module.exports = {
  images: {
    domains: ['example.com', 'cdn.example.com'],
  },
};
```

## Anti-patterns

```typescript
// Bad: Server-only code in Client Component
'use client';

function BadComponent() {
  const data = await db.user.findMany(); // Bad: Cannot access DB from client
}

// Bad: Browser API in Server Component
async function BadServerComponent() {
  const width = window.innerWidth; // Bad: window only exists in browser
}

// Bad: Calling API Route from another API Route
export async function GET() {
  const response = await fetch('http://localhost:3000/api/users'); // Bad
  // Instead, call DB function directly
  const users = await getUsers(); // Good
}

// Bad: Exposing environment variables
'use client';

function BadClient() {
  const apiKey = process.env.API_SECRET_KEY; // Bad: undefined (on client)
}
```

## Performance Optimization

```typescript
// Good: Static Generation (SSG)
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map(post => ({ id: post.id }));
}

// Good: Incremental Static Regeneration (ISR)
export const revalidate = 60; // Regenerate every 60 seconds

// Good: Dynamic Rendering (SSR)
export const dynamic = 'force-dynamic';

// Good: Partial Prerendering (experimental)
export const experimental_ppr = true;
```

## Checklist

When writing Next.js code:

- [ ] Use App Router (avoid Pages Router)
- [ ] Server Components first (minimize client)
- [ ] Consider Server Actions instead of API Routes
- [ ] Define metadata (SEO)
- [ ] Streaming with Suspense
- [ ] Use Next.js Image component
- [ ] Use environment variables correctly
- [ ] Auth/permission check with Middleware
- [ ] Configure caching strategy (revalidate)
- [ ] TypeScript strict mode
