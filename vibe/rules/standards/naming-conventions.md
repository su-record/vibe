# Automatic Naming Rules

## Basic Rules

```text
Variables: nouns (userList, userData)
Functions: verb+noun (fetchData, updateUser)
Events: handle prefix (handleClick, handleSubmit)
Boolean: is/has/can prefix (isLoading, hasError, canEdit)
Constants: UPPER_SNAKE_CASE (MAX_RETRY_COUNT, API_TIMEOUT)
Components: PascalCase (UserProfile, HeaderSection)
Hooks: use prefix (useUserData, useAuth)
```

## Variable Naming

### ✅ Good Examples

```typescript
const userList = [...];
const totalAmount = 0;
const currentPage = 1;
```

### ❌ Bad Examples

```typescript
const list = [...];  // List of what?
const total = 0;     // Total of what?
const page = 1;      // Not clear
```

## Function Naming

### ✅ Good Examples

```typescript
function fetchUserData() { }
function updateProfile() { }
function validateEmail() { }
function calculateTotal() { }
```

### ❌ Bad Examples

```typescript
function user() { }       // No verb
function data() { }       // Unclear
function process() { }    // Process what?
```

## Event Handlers

### ✅ Good Examples

```typescript
function handleClick() { }
function handleSubmit() { }
function handleInputChange() { }
```

### ❌ Bad Examples

```typescript
function onClick() { }      // handle prefix recommended
function submit() { }       // Unclear it's an event
function change() { }       // Change of what?
```

## Boolean Variables

### ✅ Good Examples

```typescript
const isLoading = false;
const hasError = false;
const canEdit = true;
const shouldUpdate = false;
```

### ❌ Bad Examples

```typescript
const loading = false;    // is prefix recommended
const error = false;      // has recommended
const editable = true;    // can recommended
```

## Constants

### ✅ Good Examples

```typescript
const MAX_RETRY_COUNT = 3;
const API_TIMEOUT_MS = 5000;
const DEFAULT_PAGE_SIZE = 20;
```

### ❌ Bad Examples

```typescript
const maxRetry = 3;       // Use UPPER_SNAKE_CASE
const timeout = 5000;     // Missing unit specification
```

## Components & Classes

### ✅ Good Examples

```typescript
class UserProfile { }
class DataRepository { }
function ProfileCard() { }
function NavigationBar() { }
```

### ❌ Bad Examples

```typescript
class userProfile { }     // Use PascalCase
class data { }            // Unclear
function profile() { }    // PascalCase recommended
```

## Custom Hooks (React)

### ✅ Good Examples

```typescript
function useUserData() { }
function useAuth() { }
function useLocalStorage() { }
```

### ❌ Bad Examples

```typescript
function getUserData() { } // use prefix required
function auth() { }        // use prefix required
```

## Types & Interfaces (TypeScript)

### ✅ Good Examples

```typescript
interface User { }
type UserRole = 'admin' | 'user';
interface ApiResponse<T> { }
```

### ❌ Bad Examples

```typescript
interface IUser { }       // I prefix unnecessary (TypeScript)
type user = { };          // Use PascalCase
```

## File Naming

### ✅ Good Examples

```text
user-profile.component.tsx
user.service.ts
auth.utils.ts
constants.ts
```

### ❌ Bad Examples

```text
UserProfile.tsx           // kebab-case recommended
user_service.ts           // kebab-case recommended
utils.ts                  // Unclear
```

## Abbreviation Principles

- Use only common abbreviations (URL, API, ID, HTML, CSS)
- Project-specific abbreviations must be documented
- Use full words if meaning is not clear

### ✅ Good Examples

```typescript
const userId = '123';
const apiEndpoint = '/users';
const htmlContent = '<div>';
```

### ❌ Bad Examples

```typescript
const usrId = '123';      // Unclear abbreviation
const endpt = '/users';   // Over-abbreviated
const cnt = '<div>';      // Use "content" for clarity
```
