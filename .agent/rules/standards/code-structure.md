# 🏗️ 코드 구조 자동화 규칙

## 컴포넌트 구조 (엄격한 순서)

```typescript
// 1. Import 문
import React, { useState, useEffect } from 'react';

// 2. 타입/인터페이스 정의
interface Props {
  userId: string;
}

// 3. 컴포넌트 정의
function UserProfile({ userId }: Props) {
  // 4. State & Refs
  const [user, setUser] = useState<User | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 5. Custom Hooks
  const { isAuthenticated } = useAuth();
  const { data, loading } = useUserData(userId);

  // 6. Event Handlers
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // ...
  };

  // 7. Effects
  useEffect(() => {
    // ...
  }, [userId]);

  // 8. Early returns
  if (loading) return <Spinner />;
  if (!user) return <NotFound />;

  // 9. Main return JSX
  return (
    <div>
      {/* ... */}
    </div>
  );
}
```

## 함수 분리 기준

### 1. 함수 길이 기준

```typescript
// ❌ 20줄 초과 - 분리 필요
function processUserData(user: User) {
  // 30줄의 복잡한 로직
}

// ✅ 단일 책임으로 분리
function processUserData(user: User) {
  const validated = validateUser(user);
  const transformed = transformUserData(validated);
  return saveUserData(transformed);
}

function validateUser(user: User) { /* ... */ }
function transformUserData(user: User) { /* ... */ }
function saveUserData(user: User) { /* ... */ }
```

### 2. 컴포넌트 JSX 길이 기준

```typescript
// ❌ JSX 50줄 초과 - 분리 필요
function Dashboard() {
  return (
    <div>
      {/* 60줄의 복잡한 JSX */}
    </div>
  );
}

// ✅ 서브 컴포넌트 추출
function Dashboard() {
  return (
    <div>
      <DashboardHeader />
      <DashboardContent />
      <DashboardFooter />
    </div>
  );
}

function DashboardHeader() { /* ... */ }
function DashboardContent() { /* ... */ }
function DashboardFooter() { /* ... */ }
```

### 3. 중첩 깊이 기준

```typescript
// ❌ 중첩 3단계 초과
function processData(data: Data) {
  if (data) {
    if (data.isValid) {
      if (data.user) {
        if (data.user.isActive) {
          // 너무 깊은 중첩
        }
      }
    }
  }
}

// ✅ Early return으로 평탄화
function processData(data: Data) {
  if (!data) return null;
  if (!data.isValid) return null;
  if (!data.user) return null;
  if (!data.user.isActive) return null;

  // 로직 실행
}
```

### 4. Cyclomatic Complexity > 10

```typescript
// ❌ 복잡도 높음 (15)
function calculatePrice(item: Item) {
  let price = item.basePrice;
  if (item.discount) price *= 0.9;
  if (item.bulk) price *= 0.8;
  if (item.seasonal) price *= 0.95;
  if (item.member) price *= 0.85;
  if (item.firstTime) price *= 0.9;
  // ... 더 많은 조건
  return price;
}

// ✅ 복잡도 감소 (3)
function calculatePrice(item: Item) {
  const basePrice = item.basePrice;
  const discounts = getApplicableDiscounts(item);
  return applyDiscounts(basePrice, discounts);
}
```

### 5. Cognitive Complexity > 15

```typescript
// ❌ 인지 복잡도 높음
function processOrder(order: Order) {
  if (order.isPremium) {
    for (let item of order.items) {
      if (item.category === 'electronics') {
        if (item.price > 1000) {
          // 중첩된 복잡한 로직
        }
      }
    }
  }
}

// ✅ 인지 복잡도 감소
function processOrder(order: Order) {
  if (!order.isPremium) return;

  const electronics = filterElectronics(order.items);
  const expensive = filterExpensive(electronics);

  processItems(expensive);
}
```

## 파일 구조 표준

```typescript
// 📁 user-profile.component.tsx

// 1. Imports
import { ... } from 'react';
import { ... } from '@/lib';

// 2. Types
interface UserProfileProps { }
type UserRole = 'admin' | 'user';

// 3. Constants
const MAX_BIO_LENGTH = 500;
const DEFAULT_AVATAR = '/avatar.png';

// 4. Helper Functions (내부 전용)
function formatUserName(name: string) { }

// 5. Main Component
export function UserProfile() { }

// 6. Sub Components (export하지 않음)
function ProfileHeader() { }
function ProfileContent() { }
```

## 모듈 구성 원칙

### 1. 응집도 (Cohesion)

```typescript
// ✅ 높은 응집도 - 관련 기능만 모음
// 📁 user.service.ts
export class UserService {
  getUser(id: string) { }
  updateUser(id: string, data: User) { }
  deleteUser(id: string) { }
}

// ❌ 낮은 응집도 - 관련 없는 기능 혼재
// 📁 utils.ts (안티패턴)
export class Utils {
  validateEmail(email: string) { }
  formatCurrency(amount: number) { }
  uploadFile(file: File) { }
}
```

### 2. 결합도 (Coupling)

```typescript
// ✅ 느슨한 결합 - 인터페이스 의존
interface Storage {
  save(key: string, value: unknown): void;
  load(key: string): unknown;
}

class UserService {
  constructor(private storage: Storage) { }
}

// ❌ 강한 결합 - 구현체 직접 의존
class UserService {
  private storage = new LocalStorage(); // 직접 의존
}
```

## 함수 매개변수 제한

```typescript
// ❌ 매개변수 5개 초과
function createUser(
  name: string,
  email: string,
  age: number,
  address: string,
  phone: string,
  role: string
) { }

// ✅ 객체로 그룹화
interface CreateUserParams {
  name: string;
  email: string;
  age: number;
  address: string;
  phone: string;
  role: string;
}

function createUser(params: CreateUserParams) { }
```

## 순환 의존성 방지

```typescript
// ❌ 순환 의존성
// fileA.ts
import { funcB } from './fileB';
export function funcA() { funcB(); }

// fileB.ts
import { funcA } from './fileA'; // 순환!
export function funcB() { funcA(); }

// ✅ 공통 모듈 분리
// shared.ts
export function sharedFunc() { }

// fileA.ts
import { sharedFunc } from './shared';

// fileB.ts
import { sharedFunc } from './shared';
```
