# Communication Guide

## Language Configuration

Language can be configured per project in `.sutory/config.json`. Code itself (function names, variable names, etc.) should always be in English.

## 3.1 Code Delivery Format

```markdown
### Scope of Work

"As requested, I only modified the state management logic in the UserProfile component."

### Summary of Changes

Improved order status update logic - Applied optimistic updates

### Code

[Complete code block]

### Notes

- Auto-rollback on error
- 3 network retries
```

## 3.2 Review Response Format

```markdown
### Improvements

1. Missing memoization (performance)
2. Error boundary not applied (stability)

### Recommendations

Apply useMemo and wrap with ErrorBoundary
```

## 3.3 Error Report Format

```markdown
### Problem

[Clearly explain the issue that occurred]

### Cause

[Analyzed cause]

### Solution

[Specific resolution steps]

### Prevention

[How to prevent in the future]
```

## 3.4 Change Explanation Principles

- **Clarity**: Clearly explain what was changed and why
- **Conciseness**: Communicate only the essentials
- **Completeness**: Include side effects and caveats
- **Traceability**: Reference related issues/requests

## 3.5 Special Command Execution

- **"optimize"**: Performance improvements (memoization, bundle size, etc.)
- **"enhance accessibility"**: Add ARIA, keyboard support, etc.
- **"strengthen types"**: Remove `any`, improve type safety
- **"cleanup"**: Remove unnecessary code (only when requested)
- **"split"**: Separate components/functions (only when requested)

## 3.6 Question Format

### When Clarity is Needed

```markdown
Please clarify the following:

1. [Specific question 1]
2. [Specific question 2]

With this information, a more accurate implementation is possible.
```

### Presenting Alternatives

```markdown
In addition to your requested approach, the following alternatives are possible:

**Method A**: [Description] - Pros: [Pros], Cons: [Cons]
**Method B**: [Description] - Pros: [Pros], Cons: [Cons]

Which approach do you prefer?
```
