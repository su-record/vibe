# Automatic Anti-Pattern Avoidance

## TypeScript Anti-Patterns

### 1. Using any Type

```typescript
// ❌ Using any
function processData(data: any) {
  return data.value; // Loss of type safety
}

// ✅ unknown + type guard
function processData(data: unknown) {
  if (isValidData(data)) {
    return data.value; // Type safe
  }
  throw new Error('Invalid data');
}

function isValidData(data: unknown): data is { value: string } {
  return typeof data === 'object' && data !== null && 'value' in data;
}
```

### 2. Forced Type Casting with as any

```typescript
// ❌ Bypassing types with as any
const user = response as any;
user.name; // Runtime error risk

// ✅ Proper type definition
interface User {
  name: string;
  email: string;
}

const user = response as User;
user.name; // Type safe
```

### 3. Overusing @ts-ignore

```typescript
// ❌ Ignoring errors with @ts-ignore
// @ts-ignore
const result = problematicCode();

// ✅ Fix the type issue at its root
interface Expected {
  id: string;
}

const result: Expected = {
  id: String(problematicCode()),
};
```

## React Anti-Patterns

### 1. Using dangerouslySetInnerHTML

```typescript
// ❌ XSS vulnerability
function Component({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// ✅ Safe rendering
import DOMPurify from 'dompurify';

function Component({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

// ✅ Better approach: Use markdown library
import ReactMarkdown from 'react-markdown';

function Component({ markdown }: { markdown: string }) {
  return <ReactMarkdown>{markdown}</ReactMarkdown>;
}
```

### 2. Props Drilling (More than 3 levels)

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

// ✅ Use Context API
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

### 3. Missing useEffect Dependency Array

```typescript
// ❌ Missing dependency
function Component({ userId }: { userId: string }) {
  const [user, setUser] = useState<User>();

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, []); // Missing userId dependency!

  return <div>{user?.name}</div>;
}

// ✅ Specify all dependencies
function Component({ userId }: { userId: string }) {
  const [user, setUser] = useState<User>();

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]); // Dependency specified

  return <div>{user?.name}</div>;
}
```

## JavaScript Anti-Patterns

### 1. Using var

```typescript
// ❌ Using var
var count = 0;
if (true) {
  var count = 1; // Same variable!
}
console.log(count); // 1

// ✅ Use const/let
let count = 0;
if (true) {
  let count = 1; // Block scope
}
console.log(count); // 0
```

### 2. Using == (Loose Comparison)

```typescript
// ❌ Using ==
if (value == null) { } // Also matches undefined
if ('5' == 5) { }      // true (type coercion)

// ✅ Use ===
if (value === null) { }
if (value === undefined) { }
if ('5' === 5) { }     // false
```

### 3. Using eval()

```typescript
// ❌ Using eval() (security risk)
const code = userInput;
eval(code); // Can execute arbitrary code

// ✅ Alternative implementation
const allowedOperations = {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
};

const operation = allowedOperations[userInput];
if (operation) {
  result = operation(a, b);
}
```

## CSS Anti-Patterns

### 1. Overusing !important

```css
/* ❌ Overusing !important */
.button {
  color: blue !important;
  background: red !important;
}

/* ✅ Use specific selectors */
.navigation .button.primary {
  color: blue;
  background: red;
}
```

### 2. Overusing Inline Styles

```typescript
// ❌ Inline styles
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

// ✅ Use CSS classes
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

## Performance Anti-Patterns

### 1. Unnecessary Re-renders

```typescript
// ❌ Creating new objects/functions every render
function Parent() {
  return <Child config={{ theme: 'dark' }} onClick={() => {}} />;
  // New object/function created every render → Child re-renders
}

// ✅ Use useMemo/useCallback
function Parent() {
  const config = useMemo(() => ({ theme: 'dark' }), []);
  const handleClick = useCallback(() => {}, []);

  return <Child config={config} onClick={handleClick} />;
}
```

### 2. Synchronous Heavy Computations

```typescript
// ❌ Blocking main thread
function Component({ data }: { data: number[] }) {
  const result = data
    .map(heavyComputation)
    .filter(x => x > 0)
    .reduce((a, b) => a + b);

  return <div>{result}</div>;
}

// ✅ Memoization with useMemo
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

## Security Anti-Patterns

### 1. Hardcoding Sensitive Information

```typescript
// ❌ Hardcoded API key
const API_KEY = 'sk-1234567890abcdef';

// ✅ Use environment variables
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
```

### 2. SQL Injection Vulnerability

```typescript
// ❌ Direct string concatenation
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Parameterized query
const query = 'SELECT * FROM users WHERE id = ?';
db.execute(query, [userId]);
```

## Error Handling Anti-Patterns

### 1. Empty catch Block

```typescript
// ❌ Ignoring errors
try {
  riskyOperation();
} catch (e) {
  // Does nothing
}

// ✅ Proper error handling
try {
  riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  showErrorNotification(error);
  trackError(error);
}
```

### 2. Handling Without Error Type Check

```typescript
// ❌ Treating all errors the same
try {
  await fetchData();
} catch (error) {
  showError('Failed'); // Not specific
}

// ✅ Handle by error type
try {
  await fetchData();
} catch (error) {
  if (error instanceof NetworkError) {
    showError('Please check your network connection');
  } else if (error instanceof AuthError) {
    redirectToLogin();
  } else {
    showError('An unknown error occurred');
  }
}
```
