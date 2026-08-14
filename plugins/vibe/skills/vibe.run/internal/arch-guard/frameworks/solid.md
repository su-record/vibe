---
name: solid-principles
type: framework
applies-to: [arch-guard]
---

# SOLID Principles — Reference Card

## S — Single Responsibility Principle
> A class/module should have only one reason to change.

**Violation signal**: A function does fetching + parsing + formatting + writing.

```ts
// Bad — UserService handles auth AND email AND db writes
class UserService {
  login(email: string, password: string): void { /* auth logic */ }
  sendWelcomeEmail(user: User): void { /* email logic */ }
  saveToDb(user: User): void { /* db logic */ }
}

// Good — each class owns one concern
class AuthService { login(email: string, password: string): void {} }
class EmailService { sendWelcome(user: User): void {} }
class UserRepository { save(user: User): void {} }
```

## O — Open/Closed Principle
> Open for extension, closed for modification.

**Violation signal**: Adding a new type requires editing existing switch/if chains.

```ts
// Bad — adding payment type requires editing processPayment
function processPayment(type: string, amount: number): void {
  if (type === 'card') { /* ... */ }
  if (type === 'paypal') { /* ... */ }
}

// Good — extend via new class, no existing code changes
interface PaymentProcessor { process(amount: number): void }
class CardProcessor implements PaymentProcessor { process(amount: number): void {} }
class PayPalProcessor implements PaymentProcessor { process(amount: number): void {} }
```

## L — Liskov Substitution Principle
> Subtypes must be substitutable for their base types.

**Violation signal**: Overriding a method to throw `NotImplementedError` or changing preconditions.

```ts
// Bad — Square breaks Rectangle's invariant (width/height independence)
class Rectangle { setWidth(w: number): void {} setHeight(h: number): void {} }
class Square extends Rectangle {
  setWidth(w: number): void { this.width = w; this.height = w; } // breaks contract
}

// Good — separate types, shared interface
interface Shape { area(): number }
class Rectangle implements Shape { area(): number { return this.w * this.h; } }
class Square implements Shape { area(): number { return this.side ** 2; } }
```

## I — Interface Segregation Principle
> Clients should not depend on interfaces they do not use.

**Violation signal**: Implementing an interface and leaving methods as `() => { throw new Error() }`.

```ts
// Bad — Printer forced to implement fax() it doesn't support
interface Machine { print(): void; scan(): void; fax(): void; }

// Good — split into focused interfaces
interface Printer { print(): void }
interface Scanner { scan(): void }
interface FaxMachine { fax(): void }
```

## D — Dependency Inversion Principle
> Depend on abstractions, not concretions.

**Violation signal**: High-level module imports a specific low-level class directly.

```ts
// Bad — OrderService tightly coupled to MySQLDatabase
import { MySQLDatabase } from './MySQLDatabase';
class OrderService { db = new MySQLDatabase(); }

// Good — depend on interface, inject implementation
interface Database { query(sql: string): unknown[] }
class OrderService { constructor(private db: Database) {} }
```

## Quick Checklist

| Principle | Red Flag |
|-----------|----------|
| SRP | Function/class name contains "And" or "Manager" |
| OCP | Adding feature requires editing existing if/switch |
| LSP | Subclass throws `NotImplemented` or removes behavior |
| ISP | Interface has methods unused by most implementors |
| DIP | `new ConcreteClass()` inside a high-level module |
