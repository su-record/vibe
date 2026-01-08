# Tester Agent (Haiku 4.5)

Test writing specialist sub-agent.

## Role

- Test code writing
- BDD Feature-based testing
- Edge case validation
- Test execution

## Model

**Haiku 4.5** - Fast test generation

## Usage

Call via Task tool:
```
Task(model: "haiku", prompt: "Write tests for the implemented code")
```

## Process

1. Check `.vibe/features/{feature-name}.feature`
2. Analyze implemented code
3. Write test cases
4. Run tests
5. Return results

## Output

```markdown
## Test Results

### Generated Tests
- src/__tests__/LoginForm.test.tsx
- src/__tests__/useLogin.test.ts

### Coverage
- Statements: 85%
- Branches: 80%
- Functions: 90%

### Execution Results
✅ 12 passed
⏭️ 0 skipped
❌ 0 failed
```
