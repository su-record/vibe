---
name: clean-architecture
type: framework
applies-to: [arch-guard]
---

# Clean Architecture — Reference Card

## Layer Model

```
┌─────────────────────────────────┐
│  Frameworks & Drivers           │  ← UI, DB, HTTP, CLI, external APIs
├─────────────────────────────────┤
│  Interface Adapters             │  ← Controllers, Presenters, Gateways
├─────────────────────────────────┤
│  Application Use Cases          │  ← Business rules orchestration
├─────────────────────────────────┤
│  Entities (Domain)              │  ← Core business objects & rules
└─────────────────────────────────┘
```

**Dependency Rule**: Dependencies point inward only. Inner layers know nothing about outer layers.

## Layer Responsibilities

| Layer | Contains | Must NOT contain |
|-------|----------|-----------------|
| Entities | Domain models, value objects, domain rules | Framework imports, DB calls |
| Use Cases | Application workflows, business logic | HTTP, DB drivers, UI logic |
| Adapters | Controllers, mappers, repository impls | Business rules, domain logic |
| Frameworks | Express routes, Prisma, React, CLI | Business or application logic |

## Dependency Rule in Code

```ts
// Good — Use Case depends on abstraction (repository interface)
// src/use-cases/CreateUser.ts
interface UserRepository { save(user: User): Promise<void> }

export class CreateUserUseCase {
  constructor(private users: UserRepository) {}
  execute(data: CreateUserInput): Promise<User> { /* business logic only */ }
}

// Good — Adapter implements the interface
// src/adapters/PrismaUserRepository.ts
import { PrismaClient } from '@prisma/client'; // framework import OK here
class PrismaUserRepository implements UserRepository {
  save(user: User): Promise<void> { /* prisma call */ }
}

// Bad — Use Case imports Prisma directly (crosses boundary)
// src/use-cases/CreateUser.ts
import { PrismaClient } from '@prisma/client'; // VIOLATION
```

## Boundary Crossing Patterns

### Data Transfer Objects (DTOs)
Cross boundaries using plain data structures, not domain entities.

```ts
// Input DTO — from outer layer into use case
type CreateUserInput = { email: string; name: string }

// Output DTO — from use case out to adapter
type CreateUserOutput = { id: string; email: string; createdAt: Date }
```

### Repository Pattern
Isolates data access behind an interface defined in the domain layer.

```ts
// Defined in domain layer
interface UserRepository {
  findById(id: string): Promise<User | null>
  save(user: User): Promise<void>
  delete(id: string): Promise<void>
}
```

## Common Violations

| Violation | Example | Fix |
|-----------|---------|-----|
| Framework import in entity | `import express from 'express'` in `User.ts` | Move to adapter layer |
| DB call in use case | `prisma.user.findMany()` in use case | Use repository interface |
| Business logic in controller | `if (price > 100) applyDiscount()` in route handler | Move to use case |
| Entity exposed via HTTP | Return `User` domain object as JSON directly | Map to response DTO |
| Use case depends on use case | `CreateOrder` imports `CreateUser` | Extract shared logic to domain service |

## Directory Structure Convention

```
src/
  domain/          ← Entities, value objects, domain interfaces
  use-cases/       ← Application business rules
  adapters/        ← Controllers, repository implementations, mappers
  infrastructure/  ← DB, HTTP, external services (framework layer)
```

## Arch-Guard Checks

- No `import` crossing inward (outer → inner only)
- No framework imports (`express`, `prisma`, `mongoose`) in `domain/` or `use-cases/`
- No `fetch`/`axios` in entities or use cases
- All use case dependencies are interfaces, not concrete classes
