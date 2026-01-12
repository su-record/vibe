# 🟢 TypeScript + Nuxt 3 품질 규칙

## 핵심 원칙 (Vue에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 함수 ≤ 30줄, Template ≤ 100줄
✅ 중첩 ≤ 3단계
✅ Composition API + script setup
```

## Nuxt 3 특화 규칙

### 1. Auto-imports 활용

```typescript
// ✅ Nuxt 3는 자동 import (명시적 import 불필요)
<script setup lang="ts">
// ref, computed, watch 등 Vue API 자동 import
const count = ref(0);
const doubled = computed(() => count.value * 2);

// useFetch, useAsyncData 등 Nuxt composables 자동 import
const { data } = await useFetch('/api/users');

// components/ 폴더의 컴포넌트 자동 import
// <UserCard /> 바로 사용 가능
</script>

// ❌ 불필요한 import
import { ref, computed } from 'vue';
import { useFetch } from '#app';
```

### 2. Server API Routes

```typescript
// ✅ server/api/users/index.get.ts (GET /api/users)
export default defineEventHandler(async (event) => {
  const users = await prisma.user.findMany();
  return users;
});

// ✅ server/api/users/index.post.ts (POST /api/users)
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // 유효성 검사
  if (!body.email || !body.name) {
    throw createError({
      statusCode: 400,
      message: '이메일과 이름은 필수입니다',
    });
  }

  const user = await prisma.user.create({ data: body });
  return user;
});

// ✅ server/api/users/[id].get.ts (GET /api/users/:id)
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw createError({
      statusCode: 404,
      message: '사용자를 찾을 수 없습니다',
    });
  }

  return user;
});

// ✅ server/api/users/[id].put.ts (PUT /api/users/:id)
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  const user = await prisma.user.update({
    where: { id },
    data: body,
  });

  return user;
});

// ✅ server/api/users/[id].delete.ts (DELETE /api/users/:id)
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  await prisma.user.delete({ where: { id } });
  return { success: true };
});
```

### 3. Data Fetching (SSR 지원)

```typescript
// ✅ useFetch - 기본 데이터 페칭
<script setup lang="ts">
const { data: user, pending, error, refresh } = await useFetch<User>(
  `/api/users/${props.userId}`
);

// 옵션 사용
const { data: posts } = await useFetch('/api/posts', {
  query: { limit: 10, offset: 0 },
  headers: { 'X-Custom': 'value' },
  pick: ['id', 'title'], // 필요한 필드만 선택
  transform: (data) => data.items, // 응답 변환
});
</script>

// ✅ useAsyncData - 커스텀 페칭 로직
<script setup lang="ts">
const { data, pending } = await useAsyncData(
  'user-posts', // 캐시 키
  () => $fetch(`/api/users/${props.userId}/posts`),
  {
    default: () => [], // 기본값
    lazy: true, // 클라이언트에서만 실행
    server: false, // SSR 비활성화
  }
);
</script>

// ✅ useLazyFetch - 지연 로딩 (Suspense 없이)
<script setup lang="ts">
const { data, pending } = useLazyFetch('/api/heavy-data');

// pending 상태 처리
</script>
<template>
  <div v-if="pending">로딩 중...</div>
  <div v-else>{{ data }}</div>
</template>
```

### 4. State Management

```typescript
// ✅ useState - 서버/클라이언트 공유 상태
<script setup lang="ts">
// 모든 컴포넌트에서 공유되는 상태
const counter = useState('counter', () => 0);

function increment() {
  counter.value++;
}
</script>

// ✅ Pinia Store (복잡한 상태)
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null);
  const isLoggedIn = computed(() => !!user.value);

  async function login(credentials: LoginCredentials) {
    const data = await $fetch('/api/auth/login', {
      method: 'POST',
      body: credentials,
    });
    user.value = data.user;
  }

  function logout() {
    user.value = null;
    navigateTo('/login');
  }

  return { user, isLoggedIn, login, logout };
});
```

### 5. Middleware

```typescript
// ✅ middleware/auth.ts (Named middleware)
export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useUserStore();

  // 로그인 필요한 페이지 보호
  if (!isLoggedIn && to.meta.requiresAuth) {
    return navigateTo('/login');
  }
});

// 페이지에서 사용
<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  requiresAuth: true,
});
</script>

// ✅ middleware/auth.global.ts (Global middleware)
export default defineNuxtRouteMiddleware((to, from) => {
  // 모든 라우트에 적용
});

// ✅ Server middleware
// server/middleware/auth.ts
export default defineEventHandler((event) => {
  const token = getCookie(event, 'auth-token');

  if (!token && event.path.startsWith('/api/protected')) {
    throw createError({
      statusCode: 401,
      message: '인증이 필요합니다',
    });
  }
});
```

### 6. Layouts & Pages

```typescript
// ✅ layouts/default.vue
<template>
  <div class="layout">
    <AppHeader />
    <main>
      <slot />
    </main>
    <AppFooter />
  </div>
</template>

// ✅ layouts/admin.vue
<template>
  <div class="admin-layout">
    <AdminSidebar />
    <main>
      <slot />
    </main>
  </div>
</template>

// ✅ pages/admin/index.vue
<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin-only'],
});
</script>

// ✅ pages/users/[id].vue (동적 라우트)
<script setup lang="ts">
const route = useRoute();
const userId = route.params.id;

const { data: user } = await useFetch(`/api/users/${userId}`);
</script>

// ✅ pages/posts/[...slug].vue (Catch-all 라우트)
<script setup lang="ts">
const route = useRoute();
const slugParts = route.params.slug; // ['a', 'b', 'c']
</script>
```

### 7. SEO & Meta

```typescript
// ✅ 페이지별 메타 설정
<script setup lang="ts">
const { data: post } = await useFetch(`/api/posts/${route.params.id}`);

useHead({
  title: post.value?.title,
  meta: [
    { name: 'description', content: post.value?.summary },
    { property: 'og:title', content: post.value?.title },
    { property: 'og:image', content: post.value?.thumbnail },
  ],
});

// 또는 useSeoMeta
useSeoMeta({
  title: post.value?.title,
  ogTitle: post.value?.title,
  description: post.value?.summary,
  ogDescription: post.value?.summary,
  ogImage: post.value?.thumbnail,
});
</script>

// ✅ nuxt.config.ts 전역 설정
export default defineNuxtConfig({
  app: {
    head: {
      title: 'My App',
      meta: [
        { name: 'description', content: 'My awesome app' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico' },
      ],
    },
  },
});
```

### 8. Plugins & Modules

```typescript
// ✅ plugins/api.ts
export default defineNuxtPlugin(() => {
  const api = $fetch.create({
    baseURL: '/api',
    onRequest({ options }) {
      const token = useCookie('auth-token');
      if (token.value) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token.value}`,
        };
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        navigateTo('/login');
      }
    },
  });

  return {
    provide: { api },
  };
});

// 사용
const { $api } = useNuxtApp();
const users = await $api('/users');

// ✅ plugins/dayjs.client.ts (클라이언트 전용)
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

export default defineNuxtPlugin(() => {
  dayjs.extend(relativeTime);
  return { provide: { dayjs } };
});
```

### 9. Composables

```typescript
// ✅ composables/useAuth.ts
export function useAuth() {
  const user = useState<User | null>('auth-user', () => null);
  const isLoggedIn = computed(() => !!user.value);

  async function login(email: string, password: string) {
    const data = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    user.value = data.user;
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' });
    user.value = null;
    await navigateTo('/login');
  }

  return { user, isLoggedIn, login, logout };
}

// ✅ composables/usePagination.ts
export function usePagination<T>(
  fetchFn: (page: number) => Promise<{ items: T[]; total: number }>
) {
  const items = ref<T[]>([]);
  const page = ref(1);
  const total = ref(0);
  const isLoading = ref(false);

  const hasMore = computed(() => items.value.length < total.value);

  async function loadMore() {
    if (isLoading.value || !hasMore.value) return;

    isLoading.value = true;
    const data = await fetchFn(page.value);
    items.value.push(...data.items);
    total.value = data.total;
    page.value++;
    isLoading.value = false;
  }

  return { items, isLoading, hasMore, loadMore };
}
```

### 10. Error Handling

```typescript
// ✅ error.vue (전역 에러 페이지)
<script setup lang="ts">
const props = defineProps<{
  error: {
    statusCode: number;
    message: string;
  };
}>();

const handleError = () => clearError({ redirect: '/' });
</script>

<template>
  <div class="error-page">
    <h1>{{ error.statusCode }}</h1>
    <p>{{ error.message }}</p>
    <button @click="handleError">홈으로</button>
  </div>
</template>

// ✅ 컴포넌트 레벨 에러 처리
<script setup lang="ts">
const { data, error } = await useFetch('/api/data');

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode,
    message: error.value.message,
  });
}
</script>

// ✅ NuxtErrorBoundary 사용
<template>
  <NuxtErrorBoundary @error="logError">
    <SomeComponent />
    <template #error="{ error, clearError }">
      <p>오류 발생: {{ error.message }}</p>
      <button @click="clearError">다시 시도</button>
    </template>
  </NuxtErrorBoundary>
</template>
```

## 파일 구조 (Nuxt 3)

```
project/
├── .nuxt/               # 빌드 산출물 (git 제외)
├── assets/              # 빌드에 포함되는 에셋
├── components/          # 자동 import 컴포넌트
│   ├── ui/              # 기본 UI 컴포넌트
│   ├── features/        # 기능별 컴포넌트
│   └── App*.vue         # 앱 공통 컴포넌트
├── composables/         # 자동 import composables
├── layouts/             # 레이아웃
├── middleware/          # 라우트 미들웨어
├── pages/               # 파일 기반 라우팅
├── plugins/             # Nuxt 플러그인
├── public/              # 정적 파일
├── server/
│   ├── api/             # API 라우트
│   ├── middleware/      # 서버 미들웨어
│   └── utils/           # 서버 유틸리티
├── stores/              # Pinia 스토어
├── types/               # TypeScript 타입
├── utils/               # 유틸리티 함수
├── app.vue              # 앱 루트
├── nuxt.config.ts       # Nuxt 설정
└── tsconfig.json        # TypeScript 설정
```

## 안티패턴

```typescript
// ❌ 클라이언트에서 직접 DB 접근
<script setup>
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient(); // 클라이언트에서 실행 불가
</script>

// ✅ Server API 통해 접근
const { data } = await useFetch('/api/users');

// ❌ useFetch를 조건부로 사용
if (someCondition) {
  const { data } = await useFetch('/api/data'); // 에러 발생
}

// ✅ enabled 옵션 사용
const { data } = await useFetch('/api/data', {
  immediate: someCondition,
});

// ❌ navigateTo를 setup 밖에서 사용
function handleClick() {
  navigateTo('/page'); // 가능하지만 비권장
}

// ✅ useRouter 사용
const router = useRouter();
function handleClick() {
  router.push('/page');
}
```

## 체크리스트

- [ ] Auto-imports 활용 (불필요한 import 제거)
- [ ] Server API 파일 네이밍 규칙 준수 (*.get.ts, *.post.ts)
- [ ] useFetch/useAsyncData로 SSR 지원 데이터 페칭
- [ ] useState로 서버/클라이언트 상태 공유
- [ ] definePageMeta로 페이지별 메타 설정
- [ ] 미들웨어로 라우트 보호
- [ ] NuxtErrorBoundary로 에러 처리
- [ ] useHead/useSeoMeta로 SEO 최적화
- [ ] Composables로 로직 재사용
- [ ] TypeScript 엄격 모드 사용
