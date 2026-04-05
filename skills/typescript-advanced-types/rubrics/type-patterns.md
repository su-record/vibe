# Advanced TypeScript Type Patterns

## Discriminated Unions

Use a literal `kind`/`type` field to let TypeScript narrow exhaustively.

```typescript
type Result<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'err'; error: string };

function handle<T>(r: Result<T>): T {
  if (r.kind === 'ok') return r.value;   // narrowed: r.value exists
  throw new Error(r.error);              // narrowed: r.error exists
}
```

**Exhaustive check pattern** — compile-time guard against missing branches:

```typescript
function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}
// In switch default: case: return assertNever(action);
```

## Template Literal Types

Compose string types at the type level.

```typescript
type EventName = 'click' | 'focus' | 'blur';
type Handler = `on${Capitalize<EventName>}`;
// → 'onClick' | 'onFocus' | 'onBlur'

type RouteParam<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? Param | RouteParam<Rest>
    : T extends `${infer _Start}:${infer Param}`
    ? Param
    : never;
// RouteParam<'/user/:id/post/:postId'> → 'id' | 'postId'
```

**Gotcha**: Template literals distribute over unions — one type per combination.

## Conditional Types

Branch the type system on type relationships.

```typescript
type NonNullable<T> = T extends null | undefined ? never : T;
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
```

**Distributive gotcha** — to prevent distribution, wrap in a tuple:

```typescript
type IsArray<T> = T extends unknown[] ? true : false;
// IsArray<string | number[]> → boolean (distributed!)

type IsArrayExact<T> = [T] extends [unknown[]] ? true : false;
// IsArrayExact<string | number[]> → false (no distribution)
```

## Mapped Types

Transform every property in a type.

```typescript
type Readonly<T> = { readonly [K in keyof T]: T[K] };
type Optional<T> = { [K in keyof T]?: T[K] };

// Key remapping with 'as'
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
// Getters<{ name: string }> → { getName: () => string }
```

## Branded / Opaque Types

Prevent mixing semantically different strings/numbers.

```typescript
type UserId = string & { readonly _brand: 'UserId' };
type PostId = string & { readonly _brand: 'PostId' };

function toUserId(id: string): UserId {
  return id as UserId;  // only one cast, at the boundary
}
// toUserId('abc') satisfies UserId ✅
// 'raw-string' satisfies UserId    ✗ (compile error)
```

## `satisfies` vs `as const`

```typescript
const config = {
  port: 3000,
  host: 'localhost',
} satisfies Record<string, string | number>;
// satisfies: validates shape AND keeps literal types (port: 3000, not number)

const colors = ['red', 'green', 'blue'] as const;
// as const: freezes to readonly tuple of literals
```

Use `satisfies` when you need both **validation** and **literal type preservation**.
