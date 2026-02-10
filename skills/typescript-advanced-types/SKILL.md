---
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

Comprehensive guide for building type-safe applications using TypeScript's advanced type system. Covers Generics, Conditional Types, Mapped Types, Template Literal Types, and Utility Types.

## When to Apply

- Building type-safe libraries/frameworks
- Creating reusable generic components
- Implementing complex type inference logic
- Designing type-safe API clients
- Building form validation systems
- Creating strongly-typed configuration objects
- Implementing type-safe state management
- Migrating JavaScript to TypeScript

## VIBE TypeScript Rule Integration

> VIBE blocks `any` type usage. The patterns in this skill provide alternatives for type safety without `any`.

| Forbidden Pattern | Alternative (from this skill) |
|-------------------|-------------------------------|
| `any` | `unknown` + type guards |
| `as any` | Define proper interfaces |
| `@ts-ignore` | Fix type issues directly |
| Raw generic types | Specify type parameters |

## Core Concepts

### 1. Generics

The key tool for creating reusable yet type-safe components.

**Basic Generic Function:**

```typescript
function identity<T>(value: T): T {
  return value;
}

const num = identity<number>(42); // Type: number
const str = identity<string>("hello"); // Type: string
const auto = identity(true); // Type: boolean (inferred)
```

**Generic Constraints:**

```typescript
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(item: T): T {
  console.log(item.length);
  return item;
}

logLength("hello"); // OK: string has length
logLength([1, 2, 3]); // OK: array has length
// logLength(42);     // Error: number has no length
```

**Multiple Type Parameters:**

```typescript
function merge<T, U>(obj1: T, obj2: U): T & U {
  return { ...obj1, ...obj2 };
}

const merged = merge({ name: "John" }, { age: 30 });
// Type: { name: string } & { age: number }
```

### 2. Conditional Types

Sophisticated type logic where types are determined by conditions.

**Basic Conditional Type:**

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false
```

**Return Type Extraction:**

```typescript
type ReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never;

function getUser() {
  return { id: 1, name: "John" };
}

type User = ReturnType<typeof getUser>;
// Type: { id: number; name: string; }
```

**Distributive Conditional Types:**

```typescript
type ToArray<T> = T extends unknown ? T[] : never;

type StrOrNumArray = ToArray<string | number>;
// Type: string[] | number[]
```

**Nested Conditions:**

```typescript
type TypeName<T> = T extends string
  ? "string"
  : T extends number
    ? "number"
    : T extends boolean
      ? "boolean"
      : T extends undefined
        ? "undefined"
        : T extends Function
          ? "function"
          : "object";

type T1 = TypeName<string>; // "string"
type T2 = TypeName<() => void>; // "function"
```

### 3. Mapped Types

Types that iterate over and transform properties of existing types.

**Basic Mapped Type:**

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

interface User {
  id: number;
  name: string;
}

type ReadonlyUser = Readonly<User>;
// Type: { readonly id: number; readonly name: string; }
```

**Key Remapping:**

```typescript
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
// Type: { getName: () => string; getAge: () => number; }
```

**Property Filtering by Type:**

```typescript
type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

interface Mixed {
  id: number;
  name: string;
  age: number;
  active: boolean;
}

type OnlyNumbers = PickByType<Mixed, number>;
// Type: { id: number; age: number; }
```

### 4. Template Literal Types

String-based pattern matching and transformation types.

**Basic Template Literal:**

```typescript
type EventName = "click" | "focus" | "blur";
type EventHandler = `on${Capitalize<EventName>}`;
// Type: "onClick" | "onFocus" | "onBlur"
```

**String Manipulation:**

```typescript
type Upper = Uppercase<"hello">; // "HELLO"
type Lower = Lowercase<"HELLO">; // "hello"
type Cap = Capitalize<"john">; // "John"
type Uncap = Uncapitalize<"John">; // "john"
```

**Path Builder:**

```typescript
type Path<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? `${K}` | `${K}.${Path<T[K]>}`
        : never;
    }[keyof T]
  : never;

interface Config {
  server: { host: string; port: number };
  database: { url: string };
}

type ConfigPath = Path<Config>;
// Type: "server" | "database" | "server.host" | "server.port" | "database.url"
```

### 5. Utility Types

Built-in TypeScript utility types.

```typescript
// Partial<T> — make all properties optional
type PartialUser = Partial<User>;

// Required<T> — make all properties required
type RequiredUser = Required<PartialUser>;

// Readonly<T> — make all properties readonly
type ReadonlyUser = Readonly<User>;

// Pick<T, K> — pick specific properties
type UserName = Pick<User, "name" | "email">;

// Omit<T, K> — omit specific properties
type UserWithoutPassword = Omit<User, "password">;

// Exclude<T, U> — exclude types from union
type T1 = Exclude<"a" | "b" | "c", "a">; // "b" | "c"

// Extract<T, U> — extract types from union
type T2 = Extract<"a" | "b" | "c", "a" | "b">; // "a" | "b"

// NonNullable<T> — exclude null/undefined
type T3 = NonNullable<string | null | undefined>; // string

// Record<K, T> — object type with keys K and values T
type PageInfo = Record<"home" | "about", { title: string }>;
```

## Advanced Patterns

### Pattern 1: Type-safe Event Emitter

```typescript
type EventMap = {
  "user:created": { id: string; name: string };
  "user:updated": { id: string };
  "user:deleted": { id: string };
};

class TypedEventEmitter<T extends Record<string, unknown>> {
  private listeners: {
    [K in keyof T]?: Array<(data: T[K]) => void>;
  } = {};

  on<K extends keyof T>(event: K, callback: (data: T[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(callback);
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    const callbacks = this.listeners[event];
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }
}

const emitter = new TypedEventEmitter<EventMap>();
emitter.on("user:created", (data) => {
  console.log(data.id, data.name); // type-safe!
});
```

### Pattern 2: Type-safe API Client

```typescript
type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE";

type EndpointConfig = {
  "/users": {
    GET: { response: User[] };
    POST: { body: { name: string; email: string }; response: User };
  };
  "/users/:id": {
    GET: { params: { id: string }; response: User };
    PUT: { params: { id: string }; body: Partial<User>; response: User };
    DELETE: { params: { id: string }; response: void };
  };
};

type ExtractParams<T> = T extends { params: infer P } ? P : never;
type ExtractBody<T> = T extends { body: infer B } ? B : never;
type ExtractResponse<T> = T extends { response: infer R } ? R : never;

class APIClient<Config extends Record<string, Record<string, unknown>>> {
  async request<
    Path extends keyof Config,
    Method extends keyof Config[Path]
  >(
    path: Path,
    method: Method,
    ...[options]: ExtractParams<Config[Path][Method]> extends never
      ? ExtractBody<Config[Path][Method]> extends never
        ? []
        : [{ body: ExtractBody<Config[Path][Method]> }]
      : [
          {
            params: ExtractParams<Config[Path][Method]>;
            body?: ExtractBody<Config[Path][Method]>;
          },
        ]
  ): Promise<ExtractResponse<Config[Path][Method]>> {
    // implementation
    return {} as ExtractResponse<Config[Path][Method]>;
  }
}

const api = new APIClient<EndpointConfig>();

// Type-safe API calls
const users = await api.request("/users", "GET");
// Type: User[]

const newUser = await api.request("/users", "POST", {
  body: { name: "John", email: "john@example.com" },
});
// Type: User

const user = await api.request("/users/:id", "GET", {
  params: { id: "123" },
});
// Type: User
```

### Pattern 3: Deep Readonly/Partial

```typescript
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : DeepReadonly<T[P]>
    : T[P];
};

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P];
};
```

### Pattern 4: Type-safe Form Validation

```typescript
type ValidationRule<T> = {
  validate: (value: T) => boolean;
  message: string;
};

type FieldValidation<T> = {
  [K in keyof T]?: ValidationRule<T[K]>[];
};

type ValidationErrors<T> = {
  [K in keyof T]?: string[];
};

class FormValidator<T extends Record<string, unknown>> {
  constructor(private rules: FieldValidation<T>) {}

  validate(data: T): ValidationErrors<T> | null {
    const errors: ValidationErrors<T> = {};
    let hasErrors = false;

    for (const key in this.rules) {
      const fieldRules = this.rules[key];
      const value = data[key];

      if (fieldRules) {
        const fieldErrors: string[] = [];
        for (const rule of fieldRules) {
          if (!rule.validate(value)) {
            fieldErrors.push(rule.message);
          }
        }
        if (fieldErrors.length > 0) {
          errors[key] = fieldErrors;
          hasErrors = true;
        }
      }
    }

    return hasErrors ? errors : null;
  }
}
```

### Pattern 5: Discriminated Unions

```typescript
type Success<T> = { status: "success"; data: T };
type Failure = { status: "error"; error: string };
type Pending = { status: "loading" };

type AsyncState<T> = Success<T> | Failure | Pending;

function handleState<T>(state: AsyncState<T>): void {
  switch (state.status) {
    case "success":
      console.log(state.data); // Type: T
      break;
    case "error":
      console.log(state.error); // Type: string
      break;
    case "loading":
      console.log("Loading...");
      break;
  }
}
```

**Type-safe State Machine:**

```typescript
type State =
  | { type: "idle" }
  | { type: "fetching"; requestId: string }
  | { type: "success"; data: unknown }
  | { type: "error"; error: Error };

type Event =
  | { type: "FETCH"; requestId: string }
  | { type: "SUCCESS"; data: unknown }
  | { type: "ERROR"; error: Error }
  | { type: "RESET" };

function reducer(state: State, event: Event): State {
  switch (state.type) {
    case "idle":
      return event.type === "FETCH"
        ? { type: "fetching", requestId: event.requestId }
        : state;
    case "fetching":
      if (event.type === "SUCCESS") {
        return { type: "success", data: event.data };
      }
      if (event.type === "ERROR") {
        return { type: "error", error: event.error };
      }
      return state;
    case "success":
    case "error":
      return event.type === "RESET" ? { type: "idle" } : state;
  }
}
```

### Pattern 6: Builder Pattern (Type-safe)

```typescript
type BuilderState<T> = {
  [K in keyof T]: T[K] | undefined;
};

type RequiredKeys<T> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? never : K;
}[keyof T];

type IsComplete<T, S> =
  RequiredKeys<T> extends keyof S
    ? S[RequiredKeys<T>] extends undefined
      ? false
      : true
    : false;

class Builder<T, S extends BuilderState<T> = Record<string, never> & BuilderState<T>> {
  private state: S = {} as S;

  set<K extends keyof T>(key: K, value: T[K]): Builder<T, S & Record<K, T[K]>> {
    (this.state as Record<string, unknown>)[key as string] = value;
    return this as unknown as Builder<T, S & Record<K, T[K]>>;
  }

  build(this: IsComplete<T, S> extends true ? Builder<T, S> : never): T {
    return this.state as unknown as T;
  }
}

interface UserConfig {
  id: string;
  name: string;
  email: string;
  age?: number;
}

const userBuilder = new Builder<UserConfig>();

const config = userBuilder
  .set("id", "1")
  .set("name", "John")
  .set("email", "john@example.com")
  .build(); // OK: all required fields set

// const incomplete = userBuilder
//   .set("id", "1")
//   .build(); // Error: required fields missing
```

### Pattern 7: Deep Readonly/Partial Usage

```typescript
interface AppConfig {
  server: {
    host: string;
    port: number;
    ssl: {
      enabled: boolean;
      cert: string;
    };
  };
  database: {
    url: string;
    pool: {
      min: number;
      max: number;
    };
  };
}

type ReadonlyConfig = DeepReadonly<AppConfig>;
// All nested properties are readonly

type PartialConfig = DeepPartial<AppConfig>;
// All nested properties are optional

// Used in config update function
function updateConfig(current: AppConfig, patch: DeepPartial<AppConfig>): AppConfig {
  return deepMerge(current, patch);
}
```

### Pattern 8: Form Validation Usage

```typescript
interface LoginForm {
  email: string;
  password: string;
}

const loginValidator = new FormValidator<LoginForm>({
  email: [
    {
      validate: (v) => v.includes("@"),
      message: "Invalid email format",
    },
    {
      validate: (v) => v.length > 0,
      message: "Email is required",
    },
  ],
  password: [
    {
      validate: (v) => v.length >= 8,
      message: "Password must be at least 8 characters",
    },
  ],
});

const errors = loginValidator.validate({
  email: "invalid",
  password: "short",
});
// Type: { email?: string[]; password?: string[]; } | null
```

## Type Inference Techniques

### 1. The Infer Keyword

```typescript
// Extract array element type
type ElementType<T> = T extends (infer U)[] ? U : never;
type Num = ElementType<number[]>; // number

// Extract Promise type
type PromiseType<T> = T extends Promise<infer U> ? U : never;
type AsyncNum = PromiseType<Promise<number>>; // number

// Extract function parameters
type Parameters<T> = T extends (...args: infer P) => unknown ? P : never;
```

### 2. Type Guards

```typescript
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

const data: unknown = ["a", "b", "c"];
if (isArrayOf(data, isString)) {
  data.forEach((s) => s.toUpperCase()); // Type: string[]
}
```

### 3. Assertion Functions

```typescript
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error("Not a string");
  }
}

function processValue(value: unknown): void {
  assertIsString(value);
  // value is now typed as string
  console.log(value.toUpperCase());
}
```

## Best Practices

1. **Use `unknown` instead of `any`**: Forces type validation
2. **Use `interface` for object shapes**: Better error messages
3. **Use `type` for unions/complex types**: More flexible
4. **Leverage type inference**: Omit explicit types when TypeScript can infer
5. **Create helper types**: Build reusable type utilities
6. **Use const assertions**: Preserve literal types
7. **Avoid type assertions**: Use type guards instead
8. **Document complex types**: Add JSDoc comments
9. **Use strict mode**: Enable all strict compiler options
10. **Test your types**: Verify type behavior

## Type Testing

```typescript
// Type equality assertion test
type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

type Test1 = AssertEqual<string, string>; // true
type Test2 = AssertEqual<string, number>; // false
```

## Common Mistakes

1. **Overusing `any`**: Defeats the purpose of TypeScript
2. **Ignoring strict null checks**: Causes runtime errors
3. **Overly complex types**: Slows down compilation
4. **Not using discriminated unions**: Misses type narrowing opportunities
5. **Missing readonly modifiers**: Allows unintended mutations
6. **Circular type references**: Causes compiler errors
7. **Unhandled edge cases**: Empty arrays, null values, etc.

## Performance Considerations

- Avoid deeply nested conditional types
- Use simpler types when possible
- Cache complex type computations
- Limit depth of recursive types
- Use tools that skip type checking in production builds

## References

- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/
- Type Challenges: https://github.com/type-challenges/type-challenges
- Effective TypeScript (by Dan Vanderkam)

> **VIBE tool integration**: `core_validate_code_quality` detects `any` type usage, `core_apply_quality_rules` auto-applies TypeScript rules
