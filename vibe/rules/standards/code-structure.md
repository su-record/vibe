# Code Structure Automation Rules

## Component Structure (Strict Order)

```typescript
// 1. Import statements
import React, { useState, useEffect } from 'react';

// 2. Type/Interface definitions
interface Props {
  userId: string;
}

// 3. Component definition
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

## Function Separation Criteria

### 1. Function Length Criteria

```typescript
// ❌ Over 20 lines - needs separation
function processUserData(user: User) {
  // 30 lines of complex logic
}

// ✅ Separate by single responsibility
function processUserData(user: User) {
  const validated = validateUser(user);
  const transformed = transformUserData(validated);
  return saveUserData(transformed);
}

function validateUser(user: User) { /* ... */ }
function transformUserData(user: User) { /* ... */ }
function saveUserData(user: User) { /* ... */ }
```

### 2. Component JSX Length Criteria

```typescript
// ❌ JSX over 50 lines - needs separation
function Dashboard() {
  return (
    <div>
      {/* 60 lines of complex JSX */}
    </div>
  );
}

// ✅ Extract sub-components
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

### 3. Nesting Depth Criteria

```typescript
// ❌ Nesting over 3 levels
function processData(data: Data) {
  if (data) {
    if (data.isValid) {
      if (data.user) {
        if (data.user.isActive) {
          // Too deep nesting
        }
      }
    }
  }
}

// ✅ Flatten with early returns
function processData(data: Data) {
  if (!data) return null;
  if (!data.isValid) return null;
  if (!data.user) return null;
  if (!data.user.isActive) return null;

  // Execute logic
}
```

### 4. Cyclomatic Complexity > 10

```typescript
// ❌ High complexity (15)
function calculatePrice(item: Item) {
  let price = item.basePrice;
  if (item.discount) price *= 0.9;
  if (item.bulk) price *= 0.8;
  if (item.seasonal) price *= 0.95;
  if (item.member) price *= 0.85;
  if (item.firstTime) price *= 0.9;
  // ... more conditions
  return price;
}

// ✅ Reduced complexity (3)
function calculatePrice(item: Item) {
  const basePrice = item.basePrice;
  const discounts = getApplicableDiscounts(item);
  return applyDiscounts(basePrice, discounts);
}
```

### 5. Cognitive Complexity > 15

```typescript
// ❌ High cognitive complexity
function processOrder(order: Order) {
  if (order.isPremium) {
    for (let item of order.items) {
      if (item.category === 'electronics') {
        if (item.price > 1000) {
          // Nested complex logic
        }
      }
    }
  }
}

// ✅ Reduced cognitive complexity
function processOrder(order: Order) {
  if (!order.isPremium) return;

  const electronics = filterElectronics(order.items);
  const expensive = filterExpensive(electronics);

  processItems(expensive);
}
```

## File Structure Standard

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

// 4. Helper Functions (internal only)
function formatUserName(name: string) { }

// 5. Main Component
export function UserProfile() { }

// 6. Sub Components (not exported)
function ProfileHeader() { }
function ProfileContent() { }
```

## Module Organization Principles

### 1. Cohesion

```typescript
// ✅ High cohesion - only related functions
// 📁 user.service.ts
export class UserService {
  getUser(id: string) { }
  updateUser(id: string, data: User) { }
  deleteUser(id: string) { }
}

// ❌ Low cohesion - unrelated functions mixed
// 📁 utils.ts (anti-pattern)
export class Utils {
  validateEmail(email: string) { }
  formatCurrency(amount: number) { }
  uploadFile(file: File) { }
}
```

### 2. Coupling

```typescript
// ✅ Loose coupling - depends on interface
interface Storage {
  save(key: string, value: unknown): void;
  load(key: string): unknown;
}

class UserService {
  constructor(private storage: Storage) { }
}

// ❌ Tight coupling - depends on implementation directly
class UserService {
  private storage = new LocalStorage(); // Direct dependency
}
```

## Function Parameter Limit

```typescript
// ❌ Over 5 parameters
function createUser(
  name: string,
  email: string,
  age: number,
  address: string,
  phone: string,
  role: string
) { }

// ✅ Group into object
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

## Preventing Circular Dependencies

```typescript
// ❌ Circular dependency
// fileA.ts
import { funcB } from './fileB';
export function funcA() { funcB(); }

// fileB.ts
import { funcA } from './fileA'; // Circular!
export function funcB() { funcA(); }

// ✅ Separate common module
// shared.ts
export function sharedFunc() { }

// fileA.ts
import { sharedFunc } from './shared';

// fileB.ts
import { sharedFunc } from './shared';
```
