# 🟢 TypeScript + Vue/Nuxt 품질 규칙

## 핵심 원칙 (core에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 함수 ≤ 30줄, Template ≤ 100줄
✅ 중첩 ≤ 3단계
✅ Cyclomatic complexity ≤ 10
```

## Vue 3 + TypeScript 특화 규칙

### 1. Composition API 사용 (Options API 지양)

```typescript
// ❌ Options API (레거시)
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

// ✅ Composition API + script setup
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const count = ref(0);
const doubled = computed(() => count.value * 2);

function increment() {
  count.value++;
}

onMounted(() => {
  console.log('컴포넌트 마운트됨');
});
</script>
```

### 2. 타입 안전한 Props/Emits

```typescript
// ✅ Props 타입 정의
interface Props {
  userId: string;
  title?: string;
  items: Item[];
}

const props = withDefaults(defineProps<Props>(), {
  title: '기본 제목',
});

// ✅ Emits 타입 정의
interface Emits {
  (e: 'update', value: string): void;
  (e: 'delete', id: number): void;
  (e: 'select', item: Item): void;
}

const emit = defineEmits<Emits>();

// 사용
emit('update', '새 값');
emit('delete', 123);
```

### 3. Composables로 로직 분리

```typescript
// ✅ composables/useUser.ts
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
      error.value = '사용자를 불러오지 못했습니다';
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

// 컴포넌트에서 사용
<script setup lang="ts">
const { user, isLoading, fetchUser } = useUser(props.userId);

onMounted(fetchUser);
</script>
```

### 4. Pinia 상태 관리

```typescript
// ✅ stores/user.ts
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

// Setup Store 스타일 (권장)
export const useUserStore = defineStore('user', () => {
  const currentUser = ref<User | null>(null);
  const isLoggedIn = computed(() => !!currentUser.value);

  async function login(email: string, password: string) {
    currentUser.value = await authApi.login(email, password);
  }

  return { currentUser, isLoggedIn, login };
});
```

### 5. Nuxt 3 특화 규칙

```typescript
// ✅ Server API Routes (server/api/)
// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID가 필요합니다',
    });
  }

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw createError({
      statusCode: 404,
      message: '사용자를 찾을 수 없습니다',
    });
  }

  return user;
});

// ✅ useFetch / useAsyncData
<script setup lang="ts">
// SSR 지원 데이터 페칭
const { data: user, pending, error } = await useFetch<User>(
  `/api/users/${props.userId}`
);

// 캐싱 키 지정
const { data: posts } = await useAsyncData(
  `user-${props.userId}-posts`,
  () => $fetch(`/api/users/${props.userId}/posts`)
);
</script>

// ✅ Middleware
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useUserStore();

  if (!isLoggedIn && to.path !== '/login') {
    return navigateTo('/login');
  }
});
```

### 6. 컴포넌트 구조

```vue
<!-- ✅ 권장 컴포넌트 구조 -->
<script setup lang="ts">
// 1. 타입 import
import type { User, Item } from '@/types';

// 2. 컴포넌트 import
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
  console.log('컴포넌트 준비됨');
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
      저장
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

## 안티패턴

```typescript
// ❌ v-if와 v-for 함께 사용
<li v-for="user in users" v-if="user.isActive">

// ✅ computed로 필터링
const activeUsers = computed(() => users.value.filter(u => u.isActive));
<li v-for="user in activeUsers">

// ❌ Props 직접 수정
props.user.name = '새 이름';

// ✅ emit으로 부모에게 알림
emit('update', { ...props.user, name: '새 이름' });

// ❌ $refs 남용
this.$refs.input.focus();

// ✅ template ref + expose
const inputRef = ref<HTMLInputElement>();
defineExpose({ focus: () => inputRef.value?.focus() });
```

## 파일 구조 (Nuxt 3)

```
project/
├── components/
│   ├── ui/              # 기본 UI 컴포넌트
│   ├── features/        # 기능별 컴포넌트
│   └── layouts/         # 레이아웃 컴포넌트
├── composables/         # Composition 함수
├── stores/              # Pinia 스토어
├── server/
│   ├── api/             # API 라우트
│   ├── middleware/      # 서버 미들웨어
│   └── utils/           # 서버 유틸리티
├── pages/               # 파일 기반 라우팅
├── middleware/          # 클라이언트 미들웨어
├── types/               # TypeScript 타입
└── utils/               # 유틸리티 함수
```

## 체크리스트

- [ ] Composition API + `<script setup>` 사용
- [ ] Props/Emits 타입 정의
- [ ] Composables로 로직 분리
- [ ] Pinia Setup Store 스타일 사용
- [ ] `any` 타입 사용 금지
- [ ] v-if/v-for 분리
- [ ] scoped 스타일 사용
