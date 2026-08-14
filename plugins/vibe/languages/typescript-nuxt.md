# TypeScript + Nuxt 3 Quality Rules

## Core Principles (inherited from Vue)

```markdown
# Core Principles (inherited from Vue)
Single Responsibility (SRP)
No Duplication (DRY)
Reusability
Low Complexity
Function <= 30 lines, Template <= 100 lines
Nesting <= 3 levels
Composition API + script setup
```

## Nuxt 3 Specific Rules

### 1. Auto-imports Usage

```typescript
// Good: Nuxt 3 auto-imports (no explicit import needed)
<script setup lang="ts">
// ref, computed, watch etc Vue API auto-imported
const count = ref(0);
const doubled = computed(() => count.value * 2);

// useFetch, useAsyncData etc Nuxt composables auto-imported
const { data } = await useFetch('/api/users');

// Components from components/ folder auto-imported
// <UserCard /> can be used directly
</script>

// Bad: Unnecessary imports
import { ref, computed } from 'vue';
import { useFetch } from '#app';
```

### 2. Server API Routes

```typescript
// Good: server/api/users/index.get.ts (GET /api/users)
export default defineEventHandler(async (event) => {
  const users = await prisma.user.findMany();
  return users;
});

// Good: server/api/users/index.post.ts (POST /api/users)
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // Validation
  if (!body.email || !body.name) {
    throw createError({
      statusCode: 400,
      message: 'Email and name are required',
    });
  }

  const user = await prisma.user.create({ data: body });
  return user;
});

// Good: server/api/users/[id].get.ts (GET /api/users/:id)
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    });
  }

  return user;
});

// Good: server/api/users/[id].put.ts (PUT /api/users/:id)
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  const user = await prisma.user.update({
    where: { id },
    data: body,
  });

  return user;
});

// Good: server/api/users/[id].delete.ts (DELETE /api/users/:id)
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  await prisma.user.delete({ where: { id } });
  return { success: true };
});
```

### 3. Data Fetching (SSR Supported)

```typescript
// Good: useFetch - basic data fetching
<script setup lang="ts">
const { data: user, pending, error, refresh } = await useFetch<User>(
  `/api/users/${props.userId}`
);

// With options
const { data: posts } = await useFetch('/api/posts', {
  query: { limit: 10, offset: 0 },
  headers: { 'X-Custom': 'value' },
  pick: ['id', 'title'], // Select only needed fields
  transform: (data) => data.items, // Transform response
});
</script>

// Good: useAsyncData - custom fetching logic
<script setup lang="ts">
const { data, pending } = await useAsyncData(
  'user-posts', // Cache key
  () => $fetch(`/api/users/${props.userId}/posts`),
  {
    default: () => [], // Default value
    lazy: true, // Execute only on client
    server: false, // Disable SSR
  }
);
</script>

// Good: useLazyFetch - lazy loading (without Suspense)
<script setup lang="ts">
const { data, pending } = useLazyFetch('/api/heavy-data');

// Handle pending state
</script>
<template>
  <div v-if="pending">Loading...</div>
  <div v-else>{{ data }}</div>
</template>
```

### 4. State Management

```typescript
// Good: useState - server/client shared state
<script setup lang="ts">
// State shared across all components
const counter = useState('counter', () => 0);

function increment() {
  counter.value++;
}
</script>

// Good: Pinia Store (complex state)
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
// Good: middleware/auth.ts (Named middleware)
export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useUserStore();

  // Protect pages requiring login
  if (!isLoggedIn && to.meta.requiresAuth) {
    return navigateTo('/login');
  }
});

// Usage in page
<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  requiresAuth: true,
});
</script>

// Good: middleware/auth.global.ts (Global middleware)
export default defineNuxtRouteMiddleware((to, from) => {
  // Applies to all routes
});

// Good: Server middleware
// server/middleware/auth.ts
export default defineEventHandler((event) => {
  const token = getCookie(event, 'auth-token');

  if (!token && event.path.startsWith('/api/protected')) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required',
    });
  }
});
```

### 6. Layouts & Pages

```typescript
// Good: layouts/default.vue
<template>
  <div class="layout">
    <AppHeader />
    <main>
      <slot />
    </main>
    <AppFooter />
  </div>
</template>

// Good: layouts/admin.vue
<template>
  <div class="admin-layout">
    <AdminSidebar />
    <main>
      <slot />
    </main>
  </div>
</template>

// Good: pages/admin/index.vue
<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin-only'],
});
</script>

// Good: pages/users/[id].vue (dynamic route)
<script setup lang="ts">
const route = useRoute();
const userId = route.params.id;

const { data: user } = await useFetch(`/api/users/${userId}`);
</script>

// Good: pages/posts/[...slug].vue (Catch-all route)
<script setup lang="ts">
const route = useRoute();
const slugParts = route.params.slug; // ['a', 'b', 'c']
</script>
```

### 7. SEO & Meta

```typescript
// Good: Per-page meta configuration
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

// Or useSeoMeta
useSeoMeta({
  title: post.value?.title,
  ogTitle: post.value?.title,
  description: post.value?.summary,
  ogDescription: post.value?.summary,
  ogImage: post.value?.thumbnail,
});
</script>

// Good: nuxt.config.ts global configuration
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
// Good: plugins/api.ts
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

// Usage
const { $api } = useNuxtApp();
const users = await $api('/users');

// Good: plugins/dayjs.client.ts (client only)
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

export default defineNuxtPlugin(() => {
  dayjs.extend(relativeTime);
  return { provide: { dayjs } };
});
```

### 9. Composables

```typescript
// Good: composables/useAuth.ts
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

// Good: composables/usePagination.ts
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
// Good: error.vue (global error page)
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
    <button @click="handleError">Go Home</button>
  </div>
</template>

// Good: Component level error handling
<script setup lang="ts">
const { data, error } = await useFetch('/api/data');

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode,
    message: error.value.message,
  });
}
</script>

// Good: NuxtErrorBoundary usage
<template>
  <NuxtErrorBoundary @error="logError">
    <SomeComponent />
    <template #error="{ error, clearError }">
      <p>Error occurred: {{ error.message }}</p>
      <button @click="clearError">Retry</button>
    </template>
  </NuxtErrorBoundary>
</template>
```

## File Structure (Nuxt 3)

```text
project/
├── .nuxt/               # Build output (git ignored)
├── assets/              # Assets included in build
├── components/          # Auto-imported components
│   ├── ui/              # Base UI components
│   ├── features/        # Feature-specific components
│   └── App*.vue         # App common components
├── composables/         # Auto-imported composables
├── layouts/             # Layouts
├── middleware/          # Route middleware
├── pages/               # File-based routing
├── plugins/             # Nuxt plugins
├── public/              # Static files
├── server/
│   ├── api/             # API routes
│   ├── middleware/      # Server middleware
│   └── utils/           # Server utilities
├── stores/              # Pinia stores
├── types/               # TypeScript types
├── utils/               # Utility functions
├── app.vue              # App root
├── nuxt.config.ts       # Nuxt configuration
└── tsconfig.json        # TypeScript configuration
```

## Anti-patterns

```typescript
// Bad: Direct DB access from client
<script setup>
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient(); // Cannot run on client
</script>

// Good: Access through Server API
const { data } = await useFetch('/api/users');

// Bad: Conditional useFetch
if (someCondition) {
  const { data } = await useFetch('/api/data'); // Error
}

// Good: Use enabled option
const { data } = await useFetch('/api/data', {
  immediate: someCondition,
});

// Bad: Using navigateTo outside setup
function handleClick() {
  navigateTo('/page'); // Possible but not recommended
}

// Good: Use useRouter
const router = useRouter();
function handleClick() {
  router.push('/page');
}
```

## Checklist

- [ ] Use auto-imports (remove unnecessary imports)
- [ ] Follow Server API file naming convention (*.get.ts, *.post.ts)
- [ ] SSR-supported data fetching with useFetch/useAsyncData
- [ ] Server/client state sharing with useState
- [ ] Per-page meta with definePageMeta
- [ ] Route protection with middleware
- [ ] Error handling with NuxtErrorBoundary
- [ ] SEO optimization with useHead/useSeoMeta
- [ ] Logic reuse with Composables
- [ ] Use TypeScript strict mode
