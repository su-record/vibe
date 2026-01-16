# ⚛️ TypeScript + React 품질 규칙

## 핵심 원칙 (core에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 함수 ≤ 30줄, JSX ≤ 50줄
✅ 중첩 ≤ 3단계
✅ Cyclomatic complexity ≤ 10
```

## TypeScript/React 특화 규칙

### 1. 타입 안전성 100%

```typescript
// ❌ any 사용
function processData(data: any) {
  return data.value;
}

// ✅ 명확한 타입 정의
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

function processUser(user: User): string {
  return user.name;
}

// ✅ Generic 활용
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

type UserResponse = ApiResponse<User>;
type ProductResponse = ApiResponse<Product>;
```

### 2. 함수형 컴포넌트 + Hooks

```typescript
// ✅ 함수형 컴포넌트 (권장)
interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
}

export function UserCard({ user, onEdit }: UserCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit(user);
    }
  }, [user, onEdit]);

  return (
    <div>
      <h2>{user.name}</h2>
      <button onClick={handleEdit}>Edit</button>
    </div>
  );
}

// ❌ 클래스 컴포넌트 (레거시)
class UserCard extends React.Component<UserCardProps> {
  // 복잡하고 장황함
}
```

### 3. Custom Hook으로 로직 분리

```typescript
// ✅ Custom Hook (재사용 가능한 로직)
interface UseUserOptions {
  userId: string;
}

interface UseUserReturn {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useUser({ userId }: UseUserOptions): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, isLoading, error, refetch: fetchUser };
}

// 사용
function UserProfile({ userId }: { userId: string }) {
  const { user, isLoading, error } = useUser({ userId });

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error} />;
  if (!user) return <NotFound />;

  return <UserCard user={user} />;
}
```

### 4. Props 타입 정의

```typescript
// ✅ Props 타입 명확히
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

// ✅ PropsWithChildren 활용
import { PropsWithChildren } from 'react';

interface CardProps {
  title: string;
  subtitle?: string;
}

export function Card({
  title,
  subtitle,
  children,
}: PropsWithChildren<CardProps>) {
  return (
    <div>
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  );
}
```

### 5. React Query (서버 상태 관리)

```typescript
// ✅ React Query로 서버 상태 관리
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function useUser(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000, // 5분
  });
}

function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateUserData) => updateUser(data),
    onSuccess: (updatedUser) => {
      // 캐시 업데이트
      queryClient.setQueryData(['user', updatedUser.id], updatedUser);
    },
  });
}

// 사용
function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading, error } = useUser(userId);
  const updateMutation = useUpdateUser();

  if (isLoading) return <Spinner />;
  if (error) return <Error />;

  return (
    <div>
      <h1>{user.name}</h1>
      <button
        onClick={() => updateMutation.mutate({ id: userId, name: 'New Name' })}
        disabled={updateMutation.isPending}
      >
        Update
      </button>
    </div>
  );
}
```

### 6. Zod로 Contract 정의

```typescript
// ✅ Zod 스키마 (런타임 + 타입 검증)
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  age: z.number().min(0).max(150),
});

type CreateUserRequest = z.infer<typeof createUserSchema>;

// 사용 (React Hook Form)
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function SignUpForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserRequest>({
    resolver: zodResolver(createUserSchema),
  });

  const onSubmit = async (data: CreateUserRequest) => {
    await registerUser(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}

      <input {...register('username')} />
      {errors.username && <span>{errors.username.message}</span>}

      <input type="password" {...register('password')} />
      {errors.password && <span>{errors.password.message}</span>}

      <input type="number" {...register('age', { valueAsNumber: true })} />
      {errors.age && <span>{errors.age.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        Sign Up
      </button>
    </form>
  );
}
```

### 7. 컴포넌트 분리 (Extract Component)

```typescript
// ❌ 긴 JSX (80줄)
function UserDashboard() {
  return (
    <div>
      <header>
        <h1>Dashboard</h1>
        {/* 20줄 */}
      </header>
      <main>
        {/* 40줄 */}
      </main>
      <footer>
        {/* 20줄 */}
      </footer>
    </div>
  );
}

// ✅ 서브 컴포넌트 분리
function UserDashboard() {
  return (
    <div>
      <DashboardHeader />
      <DashboardMain />
      <DashboardFooter />
    </div>
  );
}

function DashboardHeader() {
  return <header>{/* ... */}</header>;
}

function DashboardMain() {
  return <main>{/* ... */}</main>;
}

function DashboardFooter() {
  return <footer>{/* ... */}</footer>;
}
```

### 8. useCallback + useMemo 최적화

```typescript
// ✅ useCallback (함수 메모이제이션)
function Parent() {
  const [count, setCount] = useState(0);

  // 매번 새 함수 생성 방지
  const handleClick = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  return <Child onClick={handleClick} />;
}

const Child = React.memo<{ onClick: () => void }>(({ onClick }) => {
  return <button onClick={onClick}>Click</button>;
});

// ✅ useMemo (값 메모이제이션)
function ExpensiveComponent({ data }: { data: number[] }) {
  const processedData = useMemo(() => {
    return data
      .map(expensiveCalculation)
      .filter(x => x > 0)
      .reduce((a, b) => a + b, 0);
  }, [data]);

  return <div>{processedData}</div>;
}
```

### 9. Error Boundary

```typescript
// ✅ Error Boundary (클래스 컴포넌트 필수)
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

// 사용
function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <UserDashboard />
    </ErrorBoundary>
  );
}
```

### 10. 타입 가드 활용

```typescript
// ✅ 타입 가드
interface Dog {
  type: 'dog';
  bark: () => void;
}

interface Cat {
  type: 'cat';
  meow: () => void;
}

type Animal = Dog | Cat;

function isDog(animal: Animal): animal is Dog {
  return animal.type === 'dog';
}

function makeSound(animal: Animal) {
  if (isDog(animal)) {
    animal.bark();  // 타입 안전
  } else {
    animal.meow();  // 타입 안전
  }
}

// ✅ Discriminated Union
function AnimalCard({ animal }: { animal: Animal }) {
  switch (animal.type) {
    case 'dog':
      return <DogCard dog={animal} />;
    case 'cat':
      return <CatCard cat={animal} />;
  }
}
```

## 안티패턴

```typescript
// ❌ Props drilling (3단계 이상)
<GrandParent user={user}>
  <Parent user={user}>
    <Child user={user} />
  </Parent>
</GrandParent>

// ✅ Context 사용
const UserContext = createContext<User | undefined>(undefined);

<UserContext.Provider value={user}>
  <GrandParent />
</UserContext.Provider>

// ❌ useEffect 의존성 누락
useEffect(() => {
  fetchUser(userId);
}, []); // userId 의존성 누락!

// ✅ 모든 의존성 명시
useEffect(() => {
  fetchUser(userId);
}, [userId]);

// ❌ 인라인 객체/함수 (리렌더 유발)
<Child config={{ theme: 'dark' }} onClick={() => {}} />

// ✅ useMemo/useCallback
const config = useMemo(() => ({ theme: 'dark' }), []);
const handleClick = useCallback(() => {}, []);
<Child config={config} onClick={handleClick} />
```

## 코드 품질 도구

```bash
# TypeScript 컴파일
tsc --noEmit

# ESLint
eslint src/ --ext .ts,.tsx

# Prettier
prettier --write src/

# 테스트
vitest
# or
jest
```

## 체크리스트

TypeScript/React 코드 작성 시:

- [ ] 타입 안전성 100% (no any)
- [ ] 함수형 컴포넌트 + Hooks
- [ ] Custom Hook으로 로직 분리
- [ ] Props 타입 명확히 정의
- [ ] React Query로 서버 상태 관리
- [ ] Zod로 Contract 정의
- [ ] JSX ≤ 50줄 (컴포넌트 분리)
- [ ] useCallback/useMemo 최적화
- [ ] Error Boundary 사용
- [ ] 타입 가드 활용
- [ ] 복잡도 ≤ 10
