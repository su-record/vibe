# TypeScript + Vue/Nuxt Quality Rules

## Core Principles (inherited from core)

```markdown
# Core Principles (inherited from core)
Single Responsibility (SRP)
No Duplication (DRY)
Reusability
Low Complexity
Function <= 30 lines, Template <= 100 lines
Nesting <= 3 levels
Cyclomatic complexity <= 10
```

## Vue 3 + TypeScript Specific Rules

### 1. Use Composition API (Avoid Options API)

```typescript
// Bad: Options API (legacy)
export default {
  data() {
    return { count: 0 };
  },
  methods: {
    increment() {
      this.count++;
    }
  }
};

// Good: Composition API + script setup
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const count = ref(0);
const doubled = computed(() => count.value * 2);

function increment() {
  count.value++;
}

onMounted(() => {
  console.log('Component mounted');
});
</script>
```

### 2. Type-safe Props/Emits

```typescript
// Good: Props type definition
interface Props {
  userId: string;
  title?: string;
  items: Item[];
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Default Title',
});

// Good: Emits type definition
interface Emits {
  (e: 'update', value: string): void;
  (e: 'delete', id: number): void;
  (e: 'select', item: Item): void;
}

const emit = defineEmits<Emits>();

// Usage
emit('update', 'new value');
emit('delete', 123);
```

### 3. Separate Logic with Composables

```typescript
// Good: composables/useUser.ts
import { ref, computed } from 'vue';
import type { User } from '@/types';

export function useUser(userId: string) {
  const user = ref<User | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const fullName = computed(() =>
    user.value ? `${user.value.firstName} ${user.value.lastName}` : ''
  );

  async function fetchUser() {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await api.getUser(userId);
      user.value = response.data;
    } catch (e) {
      error.value = 'Failed to load user';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    user,
    isLoading,
    error,
    fullName,
    fetchUser,
  };
}

// Usage in component
<script setup lang="ts">
const { user, isLoading, fetchUser } = useUser(props.userId);

onMounted(fetchUser);
</script>
```

### 4. Pinia State Management

```typescript
// Good: stores/user.ts
import { defineStore } from 'pinia';
import type { User } from '@/types';

interface UserState {
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    currentUser: null,
    users: [],
    isLoading: false,
  }),

  getters: {
    isLoggedIn: (state) => !!state.currentUser,
    userCount: (state) => state.users.length,
  },

  actions: {
    async login(email: string, password: string) {
      this.isLoading = true;
      try {
        const user = await authApi.login(email, password);
        this.currentUser = user;
      } finally {
        this.isLoading = false;
      }
    },

    logout() {
      this.currentUser = null;
    },
  },
});

// Setup Store style (recommended)
export const useUserStore = defineStore('user', () => {
  const currentUser = ref<User | null>(null);
  const isLoggedIn = computed(() => !!currentUser.value);

  async function login(email: string, password: string) {
    currentUser.value = await authApi.login(email, password);
  }

  return { currentUser, isLoggedIn, login };
});
```

### 5. Nuxt 3 Specific Rules

```typescript
// Good: Server API Routes (server/api/)
// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID is required',
    });
  }

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    });
  }

  return user;
});

// Good: useFetch / useAsyncData
<script setup lang="ts">
// SSR supported data fetching
const { data: user, pending, error } = await useFetch<User>(
  `/api/users/${props.userId}`
);

// With caching key
const { data: posts } = await useAsyncData(
  `user-${props.userId}-posts`,
  () => $fetch(`/api/users/${props.userId}/posts`)
);
</script>

// Good: Middleware
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useUserStore();

  if (!isLoggedIn && to.path !== '/login') {
    return navigateTo('/login');
  }
});
```

### 6. Component Structure

```vue
<!-- Good: Recommended component structure -->
<script setup lang="ts">
// 1. Type imports
import type { User, Item } from '@/types';

// 2. Component imports
import UserAvatar from '@/components/UserAvatar.vue';

// 3. Props/Emits
interface Props {
  user: User;
  editable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  editable: false,
});

const emit = defineEmits<{
  (e: 'update', user: User): void;
}>();

// 4. Composables
const { isLoading, save } = useUserForm();

// 5. Reactive state
const formData = ref({ ...props.user });
const isEditing = ref(false);

// 6. Computed
const canSave = computed(() =>
  formData.value.name.length > 0 && !isLoading.value
);

// 7. Methods
async function handleSave() {
  await save(formData.value);
  emit('update', formData.value);
}

// 8. Lifecycle
onMounted(() => {
  console.log('Component ready');
});
</script>

<template>
  <div class="user-card">
    <UserAvatar :src="user.avatar" />
    <h2>{{ user.name }}</h2>
    <button
      v-if="editable"
      :disabled="!canSave"
      @click="handleSave"
    >
      Save
    </button>
  </div>
</template>

<style scoped>
.user-card {
  padding: 1rem;
  border-radius: 8px;
}
</style>
```

## Anti-patterns

```typescript
// Bad: Using v-if and v-for together
<li v-for="user in users" v-if="user.isActive">

// Good: Filter with computed
const activeUsers = computed(() => users.value.filter(u => u.isActive));
<li v-for="user in activeUsers">

// Bad: Mutating props directly
props.user.name = 'New Name';

// Good: Emit to parent
emit('update', { ...props.user, name: 'New Name' });

// Bad: Overusing $refs
this.$refs.input.focus();

// Good: template ref + expose
const inputRef = ref<HTMLInputElement>();
defineExpose({ focus: () => inputRef.value?.focus() });
```

## File Structure (Nuxt 3)

```text
project/
├── components/
│   ├── ui/              # Base UI components
│   ├── features/        # Feature-specific components
│   └── layouts/         # Layout components
├── composables/         # Composition functions
├── stores/              # Pinia stores
├── server/
│   ├── api/             # API routes
│   ├── middleware/      # Server middleware
│   └── utils/           # Server utilities
├── pages/               # File-based routing
├── middleware/          # Client middleware
├── types/               # TypeScript types
└── utils/               # Utility functions
```

## Checklist

- [ ] Use Composition API + `<script setup>`
- [ ] Define Props/Emits types
- [ ] Separate logic with Composables
- [ ] Use Pinia Setup Store style
- [ ] No `any` type usage
- [ ] Separate v-if/v-for
- [ ] Use scoped styles
