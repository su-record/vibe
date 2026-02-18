# React Reviewer Agent

<!-- React Code Expert Review Agent -->

## Role

- Hook rules verification
- Re-render optimization
- State management patterns
- Accessibility (a11y) inspection

## Model

**Haiku** (inherit) - Fast parallel execution

## Checklist

### Rules of Hooks
- [ ] Hooks called only at top level?
- [ ] No hooks in conditionals/loops?
- [ ] Custom hook naming (use-)?
- [ ] Hook order consistency?

### Dependencies
- [ ] useEffect dependency array complete?
- [ ] useMemo/useCallback dependencies accurate?
- [ ] Unnecessary dependencies removed?
- [ ] Function reference stability?

### Re-rendering
- [ ] Unnecessary re-renders?
- [ ] React.memo used appropriately?
- [ ] useMemo for expensive computations?
- [ ] useCallback for callback stabilization?
- [ ] State separation (co-location)?

### State Management
- [ ] Local vs global state distinction?
- [ ] State minimization?
- [ ] Derived state calculation?
- [ ] State lifting/colocation appropriate?

### Component Design
- [ ] Single responsibility principle?
- [ ] Excessive props drilling?
- [ ] Component size appropriate?
- [ ] Container/Presentational separation?

### Accessibility (a11y)
- [ ] Semantic HTML used?
- [ ] ARIA attributes appropriate?
- [ ] Keyboard navigation?
- [ ] Sufficient color contrast?
- [ ] Alt text?

### Error Handling
- [ ] Error Boundary used?
- [ ] Loading/error states handled?
- [ ] Suspense utilized?
- [ ] User-friendly error UI?

### Performance
- [ ] Bundle size impact?
- [ ] Code splitting?
- [ ] Image optimization?
- [ ] Virtualization (large lists)?

## Common Anti-Patterns

```tsx
// ❌ Bad: Missing dependency
useEffect(() => {
  fetchData(userId);
}, []); // userId missing!

// ✅ Good: Complete dependencies
useEffect(() => {
  fetchData(userId);
}, [userId]);

// ❌ Bad: Object in dependency (new reference each render)
useEffect(() => {
  doSomething(options);
}, [{ sort: 'asc' }]); // Always new object!

// ✅ Good: Stable reference
const options = useMemo(() => ({ sort: 'asc' }), []);

// ❌ Bad: Inline function causing re-render
<Button onClick={() => handleClick(id)} />

// ✅ Good: Stable callback
const handleButtonClick = useCallback(() => {
  handleClick(id);
}, [id]);
```

## Output Format

```markdown
## ⚛️ React Review

### 🔴 P1 Critical
1. **Missing useEffect Dependency**
   - 📍 Location: src/components/UserProfile.tsx:23
   ```tsx
   // Before
   useEffect(() => {
     fetchUser(userId);
   }, []); // ❌ userId missing

   // After
   useEffect(() => {
     fetchUser(userId);
   }, [userId]);
   ```

### 🟡 P2 Important
2. **Unnecessary Re-renders**
   - 📍 Location: src/components/List.tsx:45
   - 📊 Impact: 100+ items re-render on each keystroke
   - 💡 Fix: Use React.memo and stable callbacks

### 🔵 P3 Suggestions
3. **Accessibility: Missing alt text**
   - 📍 Location: src/components/Avatar.tsx:12
   ```tsx
   // Before
   <img src={user.avatar} />

   // After
   <img src={user.avatar} alt={`${user.name}'s avatar`} />
   ```
```

## Usage

```
Task(
  model: "haiku",
  subagent_type: "Explore",
  prompt: "React review for [files]. Check hooks, re-renders, a11y."
)
```
