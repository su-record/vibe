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

## Immutability Anti-Patterns

### 1. Direct State Mutation

```typescript
// ❌ Directly mutating state
const [user, setUser] = useState({ name: 'John', age: 30 });

function updateAge() {
  user.age = 31; // Direct mutation!
  setUser(user); // React won't detect the change
}

// ✅ Use spread operator for immutable update
function updateAge() {
  setUser({ ...user, age: 31 }); // New object created
}

// ✅ Or use functional update
function updateAge() {
  setUser(prev => ({ ...prev, age: prev.age + 1 }));
}
```

### 2. Array Mutation Methods

```typescript
// ❌ Mutating array methods
const [items, setItems] = useState(['a', 'b', 'c']);

function addItem(item: string) {
  items.push(item); // Mutates original array!
  setItems(items);
}

function removeItem(index: number) {
  items.splice(index, 1); // Mutates original array!
  setItems(items);
}

// ✅ Immutable array operations
function addItem(item: string) {
  setItems([...items, item]); // Spread creates new array
}

function removeItem(index: number) {
  setItems(items.filter((_, i) => i !== index)); // filter returns new array
}

function updateItem(index: number, newValue: string) {
  setItems(items.map((item, i) => i === index ? newValue : item));
}
```

### 3. Nested Object Mutation

```typescript
// ❌ Deeply nested mutation
const [state, setState] = useState({
  user: {
    profile: {
      name: 'John',
      settings: { theme: 'dark' }
    }
  }
});

function updateTheme(theme: string) {
  state.user.profile.settings.theme = theme; // Deep mutation!
  setState(state);
}

// ✅ Immutable deep update
function updateTheme(theme: string) {
  setState({
    ...state,
    user: {
      ...state.user,
      profile: {
        ...state.user.profile,
        settings: {
          ...state.user.profile.settings,
          theme
        }
      }
    }
  });
}

// ✅ Better: Use immer for complex updates
import { produce } from 'immer';

function updateTheme(theme: string) {
  setState(produce(draft => {
    draft.user.profile.settings.theme = theme; // Safe with immer
  }));
}
```

### 4. Object.assign Misuse

```typescript
// ❌ Object.assign mutating first argument
const original = { a: 1, b: 2 };
const updated = Object.assign(original, { b: 3 }); // Mutates original!

// ✅ Use empty object as first argument
const updated = Object.assign({}, original, { b: 3 });

// ✅ Or use spread (preferred)
const updated = { ...original, b: 3 };
```

### 5. Reducer State Mutation

```typescript
// ❌ Mutating state in reducer
function reducer(state: State, action: Action) {
  switch (action.type) {
    case 'ADD_ITEM':
      state.items.push(action.payload); // Mutation!
      return state;
    default:
      return state;
  }
}

// ✅ Return new state
function reducer(state: State, action: Action) {
  switch (action.type) {
    case 'ADD_ITEM':
      return {
        ...state,
        items: [...state.items, action.payload]
      };
    default:
      return state;
  }
}
```

### 6. Mutating Function Parameters

```typescript
// ❌ Mutating input parameter
function addTimestamp(data: Record<string, unknown>) {
  data.timestamp = Date.now(); // Mutates caller's object!
  return data;
}

// ✅ Create new object
function addTimestamp(data: Record<string, unknown>) {
  return {
    ...data,
    timestamp: Date.now()
  };
}
```

### Immutable Methods Reference

| Mutating (Avoid) | Immutable (Use) |
|------------------|-----------------|
| `push()` | `[...arr, item]` |
| `pop()` | `arr.slice(0, -1)` |
| `shift()` | `arr.slice(1)` |
| `unshift()` | `[item, ...arr]` |
| `splice()` | `filter()` / `slice()` + spread |
| `sort()` | `[...arr].sort()` |
| `reverse()` | `[...arr].reverse()` |
| `obj.prop = x` | `{ ...obj, prop: x }` |

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
