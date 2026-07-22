# React Performance Patterns

## memo — Skip Re-render

Wrap components that receive stable props but re-render from parent updates.

```typescript
const ItemRow = memo(function ItemRow({ item }: { item: Item }) {
  return <tr>{item.name}</tr>;
});
```

**When to use**: Pure display components in long lists, or children of frequently-updating parents.
**When NOT to use**: Components that almost always re-render anyway (memo check costs CPU too).

## useMemo — Cache Expensive Computation

```typescript
// Expensive filter/sort that depends on list + query
const filtered = useMemo(
  () => items.filter(i => i.name.includes(query)).sort(byDate),
  [items, query]
);
```

**Rule**: Only memoize when the computation is genuinely expensive (> 1ms). Measuring before adding is best practice.

**Gotcha**: Object/array deps break memoization — use primitive values:

```typescript
// Bad: new object reference every render breaks memo
useMemo(() => compute(config), [config]);

// Good: primitive values stay stable
useMemo(() => compute(config), [config.id, config.mode]);
```

## useCallback — Stable Function References

```typescript
// Without useCallback: new function ref → effect re-runs every render
const handleSubmit = useCallback(
  (e: FormEvent) => { submitForm(formData); },
  [formData]
);
```

**Use when**: passing callbacks to memo-wrapped children, or as useEffect dependencies.
**Skip when**: the component receiving it is not memoized (no benefit).

## Suspense — Stream Slow Components

```tsx
// Without Suspense: entire page waits for slowComponent
// With Suspense: page streams, slot renders when ready
<Suspense fallback={<Skeleton />}>
  <SlowDataComponent />   {/* server component with slow fetch */}
</Suspense>
```

**Gotcha**: Suspense boundaries must be placed at the **component that fetches**, not a parent.

## useTransition — Keep UI Responsive

```typescript
const [isPending, startTransition] = useTransition();

// Mark state update as non-urgent — keeps input responsive
startTransition(() => setSearchQuery(inputValue));
```

Use for filtering, sorting, navigation — updates that can briefly lag without hurting UX.

## Quick Reference

| Pattern | Use Case | Skip When |
|---------|----------|-----------|
| `memo` | Pure component in updating tree | Almost always re-renders anyway |
| `useMemo` | Expensive calculation | Fast computation (< 1ms) |
| `useCallback` | Stable dep for memo/effect | Recipient is not memoized |
| `Suspense` | Slow async data in subtree | Synchronous rendering |
| `useTransition` | Non-urgent state updates | Critical/immediate feedback |
