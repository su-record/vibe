---
name: typescript-advanced-types
tier: core
description: "TypeScript advanced type system master guide. Covers Generics, Conditional Types, Mapped Types, Template Literals, Utility Types. Activates for complex type logic, reusable type utilities, and compile-time type safety."
sections:
  - name: "Core Concepts"
    triggers: [generic, generics, constraint, conditional, infer, mapped, utility, Pick, Omit, Partial, Required, Record, Exclude, Extract, readonly]
  - name: "Advanced Patterns"
    triggers: [template literal, branded, opaque, phantom, discriminated union, exhaustive, builder pattern, recursive type, variadic tuple]
  - name: "Type Inference"
    triggers: [inference, infer, type narrowing, type guard, satisfies, const assertion]
  - name: "Best Practices"
    triggers: [best practice, type safety, convention]
  - name: "Type Testing"
    triggers: [type test, type assertion, expectType, tsd]
  - name: "Common Mistakes"
    triggers: [mistake, pitfall, error, wrong]
  - name: "Performance"
    triggers: [performance, compile time, type complexity, depth limit]
---

# TypeScript Advanced Types

## Pre-check (K1)

> Is this a VIBE-specific type safety issue? Standard TypeScript generics/conditionals/mapped types are well-known — read the code instead. This skill exists for VIBE's strict rules and non-obvious gotchas only.

## VIBE Forbidden Patterns

| Forbidden | Why | Use Instead |
|-----------|-----|-------------|
| `any` | Disables all type checking | `unknown` + type guard |
| `as any` | Bypasses type system | Define proper interface |
| `@ts-ignore` | Hides real errors | Fix the type issue at root |
| Raw generic `T` without constraint | Too permissive | `T extends SomeInterface` |

## `unknown` + Type Guard (VIBE's `any` Replacement)

```typescript
// Instead of: function process(data: any)
function process(data: unknown): string {
  if (typeof data === 'string') return data.toUpperCase();
  if (isUser(data)) return data.name;
  throw new Error('Unexpected data type');
}

function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'name' in value;
}
```

## Gotchas

| Gotcha | Why Non-obvious | Fix |
|--------|----------------|-----|
| Distributive conditionals | `ToArray<string \| number>` → `string[] \| number[]`, not `(string \| number)[]` | Wrap in tuple: `[T] extends [U]` |
| Recursive type depth | TS has ~50 level depth limit | Use tail-recursive patterns or simplify |
| `satisfies` vs `as const` | `satisfies` validates + keeps literal types; `as` skips validation | Prefer `satisfies` |
| Type assertions (`as X`) | Skips checking entirely | Use type guards instead |
| `interface` vs `type` | `interface` gives better error messages for objects | Use `type` for unions/complex, `interface` for shapes |

## Done Criteria (K4)

- [ ] No `any`, `as any`, or `@ts-ignore` in code
- [ ] All `unknown` usages have corresponding type guards
- [ ] Complex types have `AssertEqual` type tests
- [ ] Recursive types are bounded (no infinite depth)
