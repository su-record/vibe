# 🚫 자동 안티패턴 회피

## TypeScript 안티패턴

### 1. any 타입 사용

```typescript
// ❌ any 사용
function processData(data: any) {
  return data.value; // 타입 안전성 상실
}

// ✅ unknown + type guard
function processData(data: unknown) {
  if (isValidData(data)) {
    return data.value; // 타입 안전
  }
  throw new Error('Invalid data');
}

function isValidData(data: unknown): data is { value: string } {
  return typeof data === 'object' && data !== null && 'value' in data;
}
```

### 2. as any 강제 타입 캐스팅

```typescript
// ❌ as any로 타입 우회
const user = response as any;
user.name; // 런타임 에러 위험

// ✅ 적절한 타입 정의
interface User {
  name: string;
  email: string;
}

const user = response as User;
user.name; // 타입 안전
```

### 3. @ts-ignore 남용

```typescript
// ❌ @ts-ignore로 에러 무시
// @ts-ignore
const result = problematicCode();

// ✅ 타입 문제 근본 해결
interface Expected {
  id: string;
}

const result: Expected = {
  id: String(problematicCode()),
};
```

## React 안티패턴

### 1. dangerouslySetInnerHTML 사용

```typescript
// ❌ XSS 취약점
function Component({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// ✅ 안전한 렌더링
import DOMPurify from 'dompurify';

function Component({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

// ✅ 더 나은 방법: 마크다운 라이브러리 사용
import ReactMarkdown from 'react-markdown';

function Component({ markdown }: { markdown: string }) {
  return <ReactMarkdown>{markdown}</ReactMarkdown>;
}
```

### 2. Props Drilling (3단계 이상)

```typescript
// ❌ Props drilling
function App() {
  const [user, setUser] = useState<User>();
  return <Parent user={user} />;
}

function Parent({ user }: { user: User }) {
  return <Child user={user} />;
}

function Child({ user }: { user: User }) {
  return <GrandChild user={user} />;
}

function GrandChild({ user }: { user: User }) {
  return <div>{user.name}</div>;
}

// ✅ Context API 사용
const UserContext = createContext<User | undefined>(undefined);

function App() {
  const [user, setUser] = useState<User>();
  return (
    <UserContext.Provider value={user}>
      <Parent />
    </UserContext.Provider>
  );
}

function GrandChild() {
  const user = useContext(UserContext);
  return <div>{user?.name}</div>;
}
```

### 3. useEffect 의존성 배열 누락

```typescript
// ❌ 의존성 누락
function Component({ userId }: { userId: string }) {
  const [user, setUser] = useState<User>();

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, []); // userId 의존성 누락!

  return <div>{user?.name}</div>;
}

// ✅ 모든 의존성 명시
function Component({ userId }: { userId: string }) {
  const [user, setUser] = useState<User>();

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]); // 의존성 명시

  return <div>{user?.name}</div>;
}
```

## JavaScript 안티패턴

### 1. var 사용

```typescript
// ❌ var 사용
var count = 0;
if (true) {
  var count = 1; // 같은 변수!
}
console.log(count); // 1

// ✅ const/let 사용
let count = 0;
if (true) {
  let count = 1; // 블록 스코프
}
console.log(count); // 0
```

### 2. == 사용 (느슨한 비교)

```typescript
// ❌ == 사용
if (value == null) { } // undefined도 매칭
if ('5' == 5) { }      // true (타입 강제 변환)

// ✅ === 사용
if (value === null) { }
if (value === undefined) { }
if ('5' === 5) { }     // false
```

### 3. eval() 사용

```typescript
// ❌ eval() 사용 (보안 위험)
const code = userInput;
eval(code); // 임의 코드 실행 가능

// ✅ 대안 구현
const allowedOperations = {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
};

const operation = allowedOperations[userInput];
if (operation) {
  result = operation(a, b);
}
```

## CSS 안티패턴

### 1. !important 남용

```css
/* ❌ !important 남용 */
.button {
  color: blue !important;
  background: red !important;
}

/* ✅ 구체적인 선택자 사용 */
.navigation .button.primary {
  color: blue;
  background: red;
}
```

### 2. 인라인 스타일 남용

```typescript
// ❌ 인라인 스타일
function Button() {
  return (
    <button
      style={{
        backgroundColor: 'blue',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
      }}
    >
      Click me
    </button>
  );
}

// ✅ CSS 클래스 사용
function Button() {
  return <button className="btn-primary">Click me</button>;
}

// styles.css
.btn-primary {
  background-color: blue;
  color: white;
  padding: 10px;
  border-radius: 5px;
}
```

## 성능 안티패턴

### 1. 불필요한 리렌더링

```typescript
// ❌ 매번 새 객체/함수 생성
function Parent() {
  return <Child config={{ theme: 'dark' }} onClick={() => {}} />;
  // 매 렌더마다 새 객체/함수 생성 → Child 리렌더
}

// ✅ useMemo/useCallback 사용
function Parent() {
  const config = useMemo(() => ({ theme: 'dark' }), []);
  const handleClick = useCallback(() => {}, []);

  return <Child config={config} onClick={handleClick} />;
}
```

### 2. 동기적 무거운 연산

```typescript
// ❌ 메인 스레드 블로킹
function Component({ data }: { data: number[] }) {
  const result = data
    .map(heavyComputation)
    .filter(x => x > 0)
    .reduce((a, b) => a + b);

  return <div>{result}</div>;
}

// ✅ useMemo로 메모이제이션
function Component({ data }: { data: number[] }) {
  const result = useMemo(
    () =>
      data
        .map(heavyComputation)
        .filter(x => x > 0)
        .reduce((a, b) => a + b),
    [data]
  );

  return <div>{result}</div>;
}
```

## 보안 안티패턴

### 1. 민감 정보 하드코딩

```typescript
// ❌ API 키 하드코딩
const API_KEY = 'sk-1234567890abcdef';

// ✅ 환경 변수 사용
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
```

### 2. SQL Injection 취약점

```typescript
// ❌ 직접 문자열 연결
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ 파라미터화된 쿼리
const query = 'SELECT * FROM users WHERE id = ?';
db.execute(query, [userId]);
```

## 에러 처리 안티패턴

### 1. 빈 catch 블록

```typescript
// ❌ 에러 무시
try {
  riskyOperation();
} catch (e) {
  // 아무것도 안 함
}

// ✅ 적절한 에러 처리
try {
  riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  showErrorNotification(error);
  trackError(error);
}
```

### 2. 에러 타입 확인 없이 처리

```typescript
// ❌ 모든 에러 동일하게 처리
try {
  await fetchData();
} catch (error) {
  showError('Failed'); // 구체적이지 않음
}

// ✅ 에러 타입별 처리
try {
  await fetchData();
} catch (error) {
  if (error instanceof NetworkError) {
    showError('네트워크 연결을 확인해주세요');
  } else if (error instanceof AuthError) {
    redirectToLogin();
  } else {
    showError('알 수 없는 오류가 발생했습니다');
  }
}
```
