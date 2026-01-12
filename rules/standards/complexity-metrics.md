# 🔬 소프트웨어 엔지니어링 복잡도 측정

## 4.1 복잡도 메트릭

### Cyclomatic Complexity (순환 복잡도)

**정의**: 코드의 독립적인 실행 경로 수

**목표**: ≤ 10

```typescript
// ❌ 높은 순환 복잡도 (6)
function processUser(user) {
  if (user.isActive) {        // +1
    if (user.hasPermission) { // +1
      if (user.email) {       // +1
        if (user.verified) {  // +1
          return processData();
        }
      }
    }
  }
  return null;
}

// ✅ 낮은 순환 복잡도 (4) - Early returns 사용
function processUser(user) {
  if (!user.isActive) return null;      // +1
  if (!user.hasPermission) return null; // +1
  if (!user.email) return null;         // +1
  if (!user.verified) return null;      // +1

  return processData();
}
```

### Cognitive Complexity (인지 복잡도)

**정의**: 코드를 이해하는 데 필요한 정신적 노력

**목표**: ≤ 15

```typescript
// ❌ 높은 인지 복잡도
function calculateDiscount(user, items) {
  let discount = 0;
  if (user.isPremium) {              // +1
    for (let item of items) {        // +1 (nesting)
      if (item.category === 'electronics') { // +2 (nested if)
        discount += item.price * 0.1;
      } else if (item.category === 'books') { // +1
        discount += item.price * 0.05;
      }
    }
  }
  return discount;
}

// ✅ 낮은 인지 복잡도 - 함수 분리
function calculateDiscount(user, items) {
  if (!user.isPremium) return 0; // +1
  return items.reduce((total, item) => total + getItemDiscount(item), 0);
}

function getItemDiscount(item) {
  const discountRates = {
    electronics: 0.1,
    books: 0.05,
  };
  return item.price * (discountRates[item.category] || 0);
}
```

### Halstead Metrics (할스테드 메트릭)

**측정 항목**:
- **Operators**: 연산자 (=, +, -, *, if, for 등)
- **Operands**: 피연산자 (변수, 상수, 함수명)
- **Vocabulary**: 고유 연산자 + 고유 피연산자
- **Length**: 전체 토큰 수
- **Difficulty**: 코드 이해 난이도
- **Effort**: 코드 작성에 필요한 정신적 노력

```typescript
// Halstead 메트릭 측정 예시
function calculateArea(radius: number): number {
  const pi = 3.14159;
  return pi * radius * radius;
}

/*
Operators: =, *, const, function, :, return (6개)
Operands: calculateArea, radius, number, pi, 3.14159 (5개)
Vocabulary: 6 + 5 = 11
Length: 전체 토큰 수
Difficulty: Vocabulary와 operand 반복으로 계산
Effort: Difficulty × Volume
*/
```

## 4.2 결합도 & 응집도

### 느슨한 결합 (Loose Coupling)

**목표**: 모듈 간 의존성 최소화

```typescript
// ❌ 강한 결합 - 직접 의존성
class UserService {
  constructor() {
    this.database = new PostgreSQLDatabase(); // 직접 의존
    this.emailService = new SendGridEmail();  // 직접 의존
  }
}

// ✅ 느슨한 결합 - 의존성 주입
interface IDatabase {
  save(data: unknown): Promise<void>;
  load(id: string): Promise<unknown>;
}

interface IEmailService {
  send(to: string, message: string): Promise<void>;
}

class UserService {
  constructor(
    private database: IDatabase,
    private emailService: IEmailService
  ) {}
}

// 사용
const userService = new UserService(
  new PostgreSQLDatabase(),
  new SendGridEmail()
);
```

### 높은 응집도 (High Cohesion)

**목표**: 관련된 기능만 모음

```typescript
// ❌ 낮은 응집도 - 관련 없는 기능들
class Utils {
  validateEmail(email: string) { /* */ }
  formatCurrency(amount: number) { /* */ }
  sendNotification(message: string) { /* */ }
  calculateTax(income: number) { /* */ }
}

// ✅ 높은 응집도 - 관련 기능만
class EmailValidator {
  validateFormat(email: string) { /* */ }
  validateDomain(email: string) { /* */ }
  validateMX(email: string) { /* */ }
}

class CurrencyFormatter {
  formatKRW(amount: number) { /* */ }
  formatUSD(amount: number) { /* */ }
  parseAmount(formatted: string) { /* */ }
}

class TaxCalculator {
  calculateIncomeTax(income: number) { /* */ }
  calculateVAT(amount: number) { /* */ }
  calculateTotal(income: number) { /* */ }
}
```

## 복잡도 감소 전략

### 1. Early Return 패턴

```typescript
// ❌ 중첩된 if문
function processOrder(order: Order) {
  if (order) {
    if (order.isValid) {
      if (order.items.length > 0) {
        if (order.user.isActive) {
          return processItems(order.items);
        }
      }
    }
  }
  return null;
}

// ✅ Early return
function processOrder(order: Order) {
  if (!order) return null;
  if (!order.isValid) return null;
  if (order.items.length === 0) return null;
  if (!order.user.isActive) return null;

  return processItems(order.items);
}
```

### 2. 전략 패턴 (Strategy Pattern)

```typescript
// ❌ 복잡한 if-else 체인
function calculateShipping(type: string, weight: number) {
  if (type === 'express') {
    return weight * 5 + 10;
  } else if (type === 'standard') {
    return weight * 3 + 5;
  } else if (type === 'economy') {
    return weight * 2;
  }
  return 0;
}

// ✅ 전략 패턴
interface ShippingStrategy {
  calculate(weight: number): number;
}

class ExpressShipping implements ShippingStrategy {
  calculate(weight: number) {
    return weight * 5 + 10;
  }
}

class StandardShipping implements ShippingStrategy {
  calculate(weight: number) {
    return weight * 3 + 5;
  }
}

const strategies: Record<string, ShippingStrategy> = {
  express: new ExpressShipping(),
  standard: new StandardShipping(),
};

function calculateShipping(type: string, weight: number) {
  const strategy = strategies[type];
  return strategy ? strategy.calculate(weight) : 0;
}
```

### 3. 함수 추출 (Extract Function)

```typescript
// ❌ 긴 함수
function processUserRegistration(userData: UserData) {
  // 20줄: 이메일 검증
  // 15줄: 비밀번호 해싱
  // 10줄: 데이터베이스 저장
  // 5줄: 환영 이메일 발송
}

// ✅ 함수 추출
function processUserRegistration(userData: UserData) {
  validateEmail(userData.email);
  const hashedPassword = hashPassword(userData.password);
  const user = saveToDatabase({ ...userData, password: hashedPassword });
  sendWelcomeEmail(user.email);
  return user;
}

function validateEmail(email: string) { /* ... */ }
function hashPassword(password: string) { /* ... */ }
function saveToDatabase(data: UserData) { /* ... */ }
function sendWelcomeEmail(email: string) { /* ... */ }
```

## 측정 도구

### TypeScript/JavaScript

```bash
# ESLint (복잡도 측정 플러그인)
npm install eslint-plugin-complexity

# .eslintrc.js
{
  "rules": {
    "complexity": ["error", 10],
    "max-depth": ["error", 3],
    "max-lines-per-function": ["error", 20]
  }
}
```

### Python

```bash
# Radon (복잡도 측정 도구)
pip install radon

# Cyclomatic Complexity
radon cc app/ -a -nc

# Maintainability Index
radon mi app/
```

## 목표 메트릭 요약

| 메트릭 | 목표 | 설명 |
|--------|------|------|
| Cyclomatic Complexity | ≤ 10 | 독립적 실행 경로 |
| Cognitive Complexity | ≤ 15 | 이해하기 쉬움 |
| Function Length | ≤ 20 lines | 짧고 집중된 함수 |
| Nesting Depth | ≤ 3 levels | 평탄한 구조 |
| Parameters | ≤ 5 | 함수 매개변수 제한 |
| Dependencies | ≤ 7 | 모듈 의존성 제한 |
