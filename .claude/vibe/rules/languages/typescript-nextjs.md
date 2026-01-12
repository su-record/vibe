# ⚡ TypeScript + Next.js 품질 규칙

## 핵심 원칙 (core + React에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 함수 ≤ 30줄, JSX ≤ 50줄
✅ React 규칙 모두 적용
```

## Next.js 특화 규칙

### 1. App Router (Next.js 13+) 우선

```typescript
// ✅ App Router 구조
app/
├── layout.tsx              # 루트 레이아웃
├── page.tsx                # 홈 페이지
├── loading.tsx             # 로딩 UI
├── error.tsx               # 에러 UI
├── not-found.tsx           # 404 페이지
├── users/
│   ├── page.tsx           # /users
│   ├── [id]/
│   │   └── page.tsx       # /users/:id
│   └── loading.tsx        # /users 로딩
└── api/
    └── users/
        └── route.ts       # API Route

// ✅ 서버 컴포넌트 (기본)
export default async function UsersPage() {
  // 서버에서 데이터 페칭
  const users = await getUsers();

  return (
    <div>
      <h1>Users</h1>
      <UserList users={users} />
    </div>
  );
}

// ✅ 클라이언트 컴포넌트 (필요 시에만)
'use client';

import { useState } from 'react';

export function InteractiveButton() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### 2. 서버 컴포넌트 vs 클라이언트 컴포넌트

```typescript
// ✅ 서버 컴포넌트 (권장)
// - 데이터 페칭
// - 환경 변수 접근
// - DB 직접 접근
// - 민감한 정보 처리

async function UserProfile({ userId }: { userId: string }) {
  // 서버에서만 실행 (API 키 노출 안 됨)
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  return <div>{user.name}</div>;
}

// ✅ 클라이언트 컴포넌트 (필요 시만)
// - useState, useEffect 사용
// - 이벤트 핸들러
// - 브라우저 API
// - 서드파티 라이브러리 (대부분)

'use client';

function SearchBar() {
  const [query, setQuery] = useState('');

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

### 3. Data Fetching 패턴

```typescript
// ✅ 서버 컴포넌트에서 직접 fetch
async function PostsPage() {
  // 자동 캐싱, 재검증
  const posts = await fetch('https://api.example.com/posts', {
    next: { revalidate: 60 }, // 60초 캐싱
  }).then(res => res.json());

  return <PostList posts={posts} />;
}

// ✅ 병렬 데이터 페칭
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

// ✅ 순차적 데이터 페칭 (의존 관계)
async function UserWithPosts({ username }: { username: string }) {
  // 1. 사용자 조회
  const user = await getUserByUsername(username);

  // 2. 사용자 ID로 게시물 조회
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

// ✅ GET /api/users
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

// ✅ POST /api/users
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
// ✅ GET /api/users/:id
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
// ✅ 정적 메타데이터
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

// ✅ 동적 메타데이터
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
// ✅ Streaming으로 빠른 초기 렌더링
import { Suspense } from 'react';

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* 빠른 컴포넌트 먼저 렌더 */}
      <QuickStats />

      {/* 느린 컴포넌트 나중에 스트리밍 */}
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
// ✅ Server Action (서버에서만 실행)
'use server';

import { revalidatePath } from 'next/cache';

export async function createUser(formData: FormData) {
  const email = formData.get('email') as string;
  const name = formData.get('name') as string;

  // 서버에서 직접 DB 접근
  const user = await db.user.create({
    data: { email, name },
  });

  // 캐시 재검증
  revalidatePath('/users');

  return user;
}

// ✅ 클라이언트에서 사용
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
// middleware.ts (루트)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 인증 체크
  const token = request.cookies.get('token')?.value;

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 헤더 추가
  const response = NextResponse.next();
  response.headers.set('X-Custom-Header', 'value');

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

### 9. 환경 변수

```typescript
// ✅ 서버 전용 환경 변수
const dbUrl = process.env.DATABASE_URL; // 서버 컴포넌트에서만
const apiKey = process.env.API_SECRET_KEY;

// ✅ 클라이언트 노출 환경 변수 (NEXT_PUBLIC_ 접두사)
const publicUrl = process.env.NEXT_PUBLIC_API_URL;

// .env.local
DATABASE_URL=postgresql://...
API_SECRET_KEY=secret123
NEXT_PUBLIC_API_URL=https://api.example.com
```

### 10. 이미지 최적화

```typescript
import Image from 'next/image';

// ✅ Next.js Image 컴포넌트 (자동 최적화)
export function UserAvatar({ user }: { user: User }) {
  return (
    <Image
      src={user.avatar}
      alt={user.name}
      width={100}
      height={100}
      priority // LCP 이미지는 priority
    />
  );
}

// ✅ 외부 이미지 (next.config.js 설정 필요)
// next.config.js
module.exports = {
  images: {
    domains: ['example.com', 'cdn.example.com'],
  },
};
```

## 안티패턴

```typescript
// ❌ 클라이언트 컴포넌트에서 서버 전용 코드
'use client';

function BadComponent() {
  const data = await db.user.findMany(); // ❌ 클라이언트에서 DB 접근 불가
}

// ❌ 서버 컴포넌트에서 브라우저 API
async function BadServerComponent() {
  const width = window.innerWidth; // ❌ window는 브라우저에만 존재
}

// ❌ API Route에서 다른 API Route 호출
export async function GET() {
  const response = await fetch('http://localhost:3000/api/users'); // ❌
  // 대신 직접 DB 함수 호출
  const users = await getUsers(); // ✅
}

// ❌ 환경 변수 노출
'use client';

function BadClient() {
  const apiKey = process.env.API_SECRET_KEY; // ❌ undefined (클라이언트에서)
}
```

## 성능 최적화

```typescript
// ✅ Static Generation (SSG)
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map(post => ({ id: post.id }));
}

// ✅ Incremental Static Regeneration (ISR)
export const revalidate = 60; // 60초마다 재생성

// ✅ Dynamic Rendering (SSR)
export const dynamic = 'force-dynamic';

// ✅ Partial Prerendering (실험적)
export const experimental_ppr = true;
```

## 체크리스트

Next.js 코드 작성 시:

- [ ] App Router 사용 (Pages Router 지양)
- [ ] 서버 컴포넌트 우선 (클라이언트 최소화)
- [ ] API Route 대신 Server Action 고려
- [ ] 메타데이터 정의 (SEO)
- [ ] Suspense로 Streaming
- [ ] Next.js Image 컴포넌트 사용
- [ ] 환경 변수 올바르게 사용
- [ ] Middleware로 인증/권한 체크
- [ ] 캐싱 전략 설정 (revalidate)
- [ ] TypeScript 엄격 모드
