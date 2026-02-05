---
description: "TypeScript 고급 타입 시스템 마스터 가이드. Generics, Conditional Types, Mapped Types, Template Literals, Utility Types 포함. 복잡한 타입 로직, 재사용 가능한 타입 유틸리티, 컴파일 타임 타입 안전성 확보 시 활성화."
---

# TypeScript Advanced Types

TypeScript의 고급 타입 시스템을 활용하여 타입 안전한 애플리케이션을 구축하기 위한 종합 가이드. Generics, Conditional Types, Mapped Types, Template Literal Types, Utility Types를 다룬다.

## 적용 시점

- 타입 안전한 라이브러리/프레임워크 구축 시
- 재사용 가능한 제네릭 컴포넌트 생성 시
- 복잡한 타입 추론 로직 구현 시
- 타입 안전한 API 클라이언트 설계 시
- 폼 유효성 검증 시스템 구축 시
- 강력한 타입의 설정 객체 생성 시
- 타입 안전한 상태 관리 구현 시
- JavaScript → TypeScript 마이그레이션 시

## vibe TypeScript 규칙 연계

> vibe는 `any` 타입 사용을 차단한다. 이 스킬의 패턴은 `any` 없이 타입 안전성을 확보하는 대안을 제공한다.

| 금지 패턴 | 대안 (이 스킬 참고) |
|----------|-------------------|
| `any` | `unknown` + 타입 가드 |
| `as any` | 적절한 인터페이스 정의 |
| `@ts-ignore` | 타입 문제 직접 해결 |
| Raw generic types | 타입 파라미터 명시 |

## 핵심 개념

### 1. Generics

재사용 가능하면서 타입 안전한 컴포넌트를 만드는 핵심 도구.

**기본 제네릭 함수:**

```typescript
function identity<T>(value: T): T {
  return value;
}

const num = identity<number>(42); // Type: number
const str = identity<string>("hello"); // Type: string
const auto = identity(true); // Type: boolean (추론)
```

**제네릭 제약 (Constraints):**

```typescript
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(item: T): T {
  console.log(item.length);
  return item;
}

logLength("hello"); // OK: string은 length를 가짐
logLength([1, 2, 3]); // OK: array는 length를 가짐
// logLength(42);     // Error: number는 length가 없음
```

**다중 타입 파라미터:**

```typescript
function merge<T, U>(obj1: T, obj2: U): T & U {
  return { ...obj1, ...obj2 };
}

const merged = merge({ name: "John" }, { age: 30 });
// Type: { name: string } & { age: number }
```

### 2. Conditional Types

조건에 따라 타입이 결정되는 정교한 타입 로직.

**기본 Conditional Type:**

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false
```

**반환 타입 추출:**

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

**중첩 조건:**

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

기존 타입의 프로퍼티를 순회하며 변환하는 타입.

**기본 Mapped Type:**

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

**키 리매핑:**

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

**타입 기반 프로퍼티 필터링:**

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

문자열 기반 패턴 매칭 및 변환 타입.

**기본 Template Literal:**

```typescript
type EventName = "click" | "focus" | "blur";
type EventHandler = `on${Capitalize<EventName>}`;
// Type: "onClick" | "onFocus" | "onBlur"
```

**문자열 조작:**

```typescript
type Upper = Uppercase<"hello">; // "HELLO"
type Lower = Lowercase<"HELLO">; // "hello"
type Cap = Capitalize<"john">; // "John"
type Uncap = Uncapitalize<"John">; // "john"
```

**경로 빌더:**

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

TypeScript 내장 유틸리티 타입 활용.

```typescript
// Partial<T> — 모든 프로퍼티를 선택적으로
type PartialUser = Partial<User>;

// Required<T> — 모든 프로퍼티를 필수로
type RequiredUser = Required<PartialUser>;

// Readonly<T> — 모든 프로퍼티를 읽기 전용으로
type ReadonlyUser = Readonly<User>;

// Pick<T, K> — 특정 프로퍼티만 선택
type UserName = Pick<User, "name" | "email">;

// Omit<T, K> — 특정 프로퍼티 제거
type UserWithoutPassword = Omit<User, "password">;

// Exclude<T, U> — 유니온에서 타입 제외
type T1 = Exclude<"a" | "b" | "c", "a">; // "b" | "c"

// Extract<T, U> — 유니온에서 타입 추출
type T2 = Extract<"a" | "b" | "c", "a" | "b">; // "a" | "b"

// NonNullable<T> — null/undefined 제외
type T3 = NonNullable<string | null | undefined>; // string

// Record<K, T> — 키 K, 값 T인 객체 타입
type PageInfo = Record<"home" | "about", { title: string }>;
```

## 고급 패턴

### 패턴 1: 타입 안전한 이벤트 이미터

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
  console.log(data.id, data.name); // 타입 안전!
});
```

### 패턴 2: 타입 안전한 API 클라이언트

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
    // 구현부
    return {} as ExtractResponse<Config[Path][Method]>;
  }
}

const api = new APIClient<EndpointConfig>();

// 타입 안전한 API 호출
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

### 패턴 3: Deep Readonly/Partial

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

### 패턴 4: 타입 안전한 폼 유효성 검증

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

### 패턴 5: Discriminated Unions

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

**타입 안전한 상태 머신:**

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

### 패턴 6: Builder Pattern (타입 안전)

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
  .build(); // OK: 모든 필수 필드 설정됨

// const incomplete = userBuilder
//   .set("id", "1")
//   .build(); // Error: 필수 필드 누락
```

### 패턴 7: Deep Readonly/Partial 활용 예시

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
// 모든 중첩 프로퍼티가 readonly

type PartialConfig = DeepPartial<AppConfig>;
// 모든 중첩 프로퍼티가 optional

// 설정 업데이트 함수에서 활용
function updateConfig(current: AppConfig, patch: DeepPartial<AppConfig>): AppConfig {
  return deepMerge(current, patch);
}
```

### 패턴 8: 폼 유효성 검증 활용 예시

```typescript
interface LoginForm {
  email: string;
  password: string;
}

const loginValidator = new FormValidator<LoginForm>({
  email: [
    {
      validate: (v) => v.includes("@"),
      message: "이메일 형식이 올바르지 않습니다",
    },
    {
      validate: (v) => v.length > 0,
      message: "이메일은 필수입니다",
    },
  ],
  password: [
    {
      validate: (v) => v.length >= 8,
      message: "비밀번호는 8자 이상이어야 합니다",
    },
  ],
});

const errors = loginValidator.validate({
  email: "invalid",
  password: "short",
});
// Type: { email?: string[]; password?: string[]; } | null
```

## 타입 추론 기법

### 1. Infer 키워드

```typescript
// 배열 요소 타입 추출
type ElementType<T> = T extends (infer U)[] ? U : never;
type Num = ElementType<number[]>; // number

// Promise 타입 추출
type PromiseType<T> = T extends Promise<infer U> ? U : never;
type AsyncNum = PromiseType<Promise<number>>; // number

// 함수 파라미터 추출
type Parameters<T> = T extends (...args: infer P) => unknown ? P : never;
```

### 2. 타입 가드

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

### 3. Assertion 함수

```typescript
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error("Not a string");
  }
}

function processValue(value: unknown): void {
  assertIsString(value);
  // value는 이제 string으로 타입됨
  console.log(value.toUpperCase());
}
```

## 모범 사례

1. **`any` 대신 `unknown`**: 타입 검증 강제
2. **객체 형태에는 `interface`**: 더 나은 에러 메시지
3. **유니온/복잡한 타입에는 `type`**: 더 유연
4. **타입 추론 활용**: TypeScript가 추론할 수 있으면 명시 생략
5. **헬퍼 타입 생성**: 재사용 가능한 타입 유틸리티 구축
6. **const assertion 사용**: 리터럴 타입 보존
7. **타입 단언 회피**: 타입 가드 사용
8. **복잡한 타입 문서화**: JSDoc 주석 추가
9. **strict 모드 사용**: 모든 strict 컴파일러 옵션 활성화
10. **타입 테스트**: 타입 동작 검증

## 타입 테스트

```typescript
// 타입 동등성 단언 테스트
type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

type Test1 = AssertEqual<string, string>; // true
type Test2 = AssertEqual<string, number>; // false
```

## 흔한 실수

1. **`any` 남용**: TypeScript의 목적 무효화
2. **strict null 검사 무시**: 런타임 에러 유발
3. **과도하게 복잡한 타입**: 컴파일 속도 저하
4. **Discriminated Unions 미사용**: 타입 내로잉 기회 상실
5. **readonly 수정자 누락**: 의도하지 않은 변경 허용
6. **순환 타입 참조**: 컴파일러 에러 유발
7. **엣지 케이스 미처리**: 빈 배열, null 값 등

## 성능 고려사항

- 깊은 중첩 Conditional Type 회피
- 가능하면 단순한 타입 사용
- 복잡한 타입 계산 캐싱
- 재귀 타입의 깊이 제한
- 프로덕션 빌드에서 타입 검사 생략 도구 활용

## 참고 자료

- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/
- Type Challenges: https://github.com/type-challenges/type-challenges
- Effective TypeScript (Dan Vanderkam 저)

> **vibe 도구 연계**: `core_validate_code_quality`로 `any` 타입 사용 탐지, `core_apply_quality_rules`로 TypeScript 규칙 자동 적용
