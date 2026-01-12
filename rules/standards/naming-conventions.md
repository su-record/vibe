# 📖 자동 네이밍 규칙

## 기본 규칙

```
변수: 명사 (userList, userData)
함수: 동사+명사 (fetchData, updateUser)
이벤트: handle 접두사 (handleClick, handleSubmit)
Boolean: is/has/can 접두사 (isLoading, hasError, canEdit)
상수: UPPER_SNAKE_CASE (MAX_RETRY_COUNT, API_TIMEOUT)
컴포넌트: PascalCase (UserProfile, HeaderSection)
훅: use 접두사 (useUserData, useAuth)
```

## 변수 네이밍

### ✅ 좋은 예

```typescript
const userList = [...];
const totalAmount = 0;
const currentPage = 1;
```

### ❌ 나쁜 예

```typescript
const list = [...];  // 무엇의 리스트?
const total = 0;     // 무엇의 총합?
const page = 1;      // 명확하지 않음
```

## 함수 네이밍

### ✅ 좋은 예

```typescript
function fetchUserData() { }
function updateProfile() { }
function validateEmail() { }
function calculateTotal() { }
```

### ❌ 나쁜 예

```typescript
function user() { }       // 동사 없음
function data() { }       // 불명확
function process() { }    // 무엇을 처리?
```

## 이벤트 핸들러

### ✅ 좋은 예

```typescript
function handleClick() { }
function handleSubmit() { }
function handleInputChange() { }
```

### ❌ 나쁜 예

```typescript
function onClick() { }      // handle 접두사 권장
function submit() { }       // 이벤트임이 불명확
function change() { }       // 무엇의 변경?
```

## Boolean 변수

### ✅ 좋은 예

```typescript
const isLoading = false;
const hasError = false;
const canEdit = true;
const shouldUpdate = false;
```

### ❌ 나쁜 예

```typescript
const loading = false;    // is 접두사 권장
const error = false;      // has 권장
const editable = true;    // can 권장
```

## 상수

### ✅ 좋은 예

```typescript
const MAX_RETRY_COUNT = 3;
const API_TIMEOUT_MS = 5000;
const DEFAULT_PAGE_SIZE = 20;
```

### ❌ 나쁜 예

```typescript
const maxRetry = 3;       // UPPER_SNAKE_CASE 사용
const timeout = 5000;     // 단위 명시 부족
```

## 컴포넌트 & 클래스

### ✅ 좋은 예

```typescript
class UserProfile { }
class DataRepository { }
function ProfileCard() { }
function NavigationBar() { }
```

### ❌ 나쁜 예

```typescript
class userProfile { }     // PascalCase 사용
class data { }            // 불명확
function profile() { }    // PascalCase 권장
```

## 커스텀 훅 (React)

### ✅ 좋은 예

```typescript
function useUserData() { }
function useAuth() { }
function useLocalStorage() { }
```

### ❌ 나쁜 예

```typescript
function getUserData() { } // use 접두사 필수
function auth() { }        // use 접두사 필수
```

## 타입 & 인터페이스 (TypeScript)

### ✅ 좋은 예

```typescript
interface User { }
type UserRole = 'admin' | 'user';
interface ApiResponse<T> { }
```

### ❌ 나쁜 예

```typescript
interface IUser { }       // I 접두사 불필요 (TypeScript)
type user = { };          // PascalCase 사용
```

## 파일 네이밍

### ✅ 좋은 예

```
user-profile.component.tsx
user.service.ts
auth.utils.ts
constants.ts
```

### ❌ 나쁜 예

```
UserProfile.tsx           // kebab-case 권장
user_service.ts           // kebab-case 권장
utils.ts                  // 불명확
```

## 약어 사용 원칙

- 일반적인 약어만 사용 (URL, API, ID, HTML, CSS)
- 프로젝트 특정 약어는 문서화 필수
- 의미가 명확하지 않으면 전체 단어 사용

### ✅ 좋은 예

```typescript
const userId = '123';
const apiEndpoint = '/users';
const htmlContent = '<div>';
```

### ❌ 나쁜 예

```typescript
const usrId = '123';      // 불명확한 약어
const endpt = '/users';   // 과도한 축약
const cnt = '<div>';      // content로 명확히
```
