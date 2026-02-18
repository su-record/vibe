# Software Engineering Complexity Measurement

## 4.1 Complexity Metrics

### Cyclomatic Complexity

**Definition**: Number of independent execution paths in code

**Target**: ≤ 10

```typescript
// ❌ High cyclomatic complexity (6)
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

// ✅ Low cyclomatic complexity (4) - Using early returns
function processUser(user) {
  if (!user.isActive) return null;      // +1
  if (!user.hasPermission) return null; // +1
  if (!user.email) return null;         // +1
  if (!user.verified) return null;      // +1

  return processData();
}
```

### Cognitive Complexity

**Definition**: Mental effort required to understand code

**Target**: ≤ 15

```typescript
// ❌ High cognitive complexity
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

// ✅ Low cognitive complexity - Function separation
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

### Halstead Metrics

**Measurements**:

- **Operators**: Operators (=, +, -, *, if, for, etc.)
- **Operands**: Operands (variables, constants, function names)
- **Vocabulary**: Unique operators + unique operands
- **Length**: Total token count
- **Difficulty**: Code comprehension difficulty
- **Effort**: Mental effort required to write code

```typescript
// Halstead metrics measurement example
function calculateArea(radius: number): number {
  const pi = 3.14159;
  return pi * radius * radius;
}

/*
Operators: =, *, const, function, :, return (6)
Operands: calculateArea, radius, number, pi, 3.14159 (5)
Vocabulary: 6 + 5 = 11
Length: Total token count
Difficulty: Calculated from Vocabulary and operand repetition
Effort: Difficulty × Volume
*/
```

## 4.2 Coupling & Cohesion

### Loose Coupling

**Goal**: Minimize dependencies between modules

```typescript
// ❌ Tight coupling - Direct dependencies
class UserService {
  constructor() {
    this.database = new PostgreSQLDatabase(); // Direct dependency
    this.emailService = new SendGridEmail();  // Direct dependency
  }
}

// ✅ Loose coupling - Dependency injection
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

// Usage
const userService = new UserService(
  new PostgreSQLDatabase(),
  new SendGridEmail()
);
```

### High Cohesion

**Goal**: Group only related functions together

```typescript
// ❌ Low cohesion - Unrelated functions
class Utils {
  validateEmail(email: string) { /* */ }
  formatCurrency(amount: number) { /* */ }
  sendNotification(message: string) { /* */ }
  calculateTax(income: number) { /* */ }
}

// ✅ High cohesion - Only related functions
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

## Complexity Reduction Strategies

### 1. Early Return Pattern

```typescript
// ❌ Nested if statements
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

### 2. Strategy Pattern

```typescript
// ❌ Complex if-else chain
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

// ✅ Strategy pattern
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

### 3. Extract Function

```typescript
// ❌ Long function
function processUserRegistration(userData: UserData) {
  // 20 lines: Email validation
  // 15 lines: Password hashing
  // 10 lines: Database save
  // 5 lines: Welcome email
}

// ✅ Extract functions
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

## Measurement Tools

### TypeScript/JavaScript

```bash
# ESLint (complexity measurement plugin)
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
# Radon (complexity measurement tool)
pip install radon

# Cyclomatic Complexity
radon cc app/ -a -nc

# Maintainability Index
radon mi app/
```

## Target Metrics Summary

| Metric | Target | Description |
|--------|--------|-------------|
| Cyclomatic Complexity | ≤ 10 | Independent execution paths |
| Cognitive Complexity | ≤ 15 | Easy to understand |
| Function Length | ≤ 20 lines | Short, focused functions |
| Nesting Depth | ≤ 3 levels | Flat structure |
| Parameters | ≤ 5 | Function parameter limit |
| Dependencies | ≤ 7 | Module dependency limit |
