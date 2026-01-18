# Codebase Patterns Research Agent

<!-- Existing Codebase Patterns Analysis Agent -->

## Role

- Existing implementation pattern analysis
- Coding convention extraction
- Similar feature reference
- Consistency assurance

## Model

**Haiku** (inherit) - Fast exploration

## Usage

Automatically called in parallel when `/vibe.spec` is executed

```
Task(
  model: "haiku",
  subagent_type: "Explore",
  prompt: "Analyze existing patterns in codebase for [feature]. Find similar implementations."
)
```

## Analysis Areas

### File Structure
```
Project structure analysis:
├── Directory organization
├── Naming conventions
├── Module separation approach
└── Test file locations
```

### Code Patterns
```
Pattern extraction:
├── Error handling approach
├── Logging patterns
├── Data validation approach
├── API response format
└── Dependency injection approach
```

### Conventions
```
Convention analysis:
├── Variable/function naming
├── File naming
├── Import order
├── Comment style
└── Type definition approach
```

## Output Format

```markdown
## 🔍 Codebase Patterns Analysis

### Project Structure

```
src/
├── api/          # REST endpoints
├── services/     # Business logic
├── models/       # Data models
├── utils/        # Helpers
└── tests/        # Mirror structure
```

### Existing Patterns

1. **Error Handling Pattern**
   ```python
   # Found in: src/services/*.py
   try:
       result = operation()
   except SpecificError as e:
       logger.error(f"Operation failed: {e}")
       raise ServiceError(str(e)) from e
   ```

2. **API Response Pattern**
   ```python
   # Found in: src/api/*.py
   return {
       "success": True,
       "data": result,
       "meta": {"count": len(result)}
   }
   ```

3. **Service Layer Pattern**
   ```python
   # Found in: src/services/user_service.py
   class UserService:
       def __init__(self, db: Database):
           self.db = db

       def get_user(self, user_id: int) -> User:
           ...
   ```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | snake_case | user_service.py |
| Classes | PascalCase | UserService |
| Functions | snake_case | get_user_by_id |
| Constants | UPPER_CASE | MAX_RETRIES |

### Similar Implementations

For feature "payment feature":

| Similar Feature | Location | Relevance |
|-----------------|----------|-----------|
| Order processing | src/services/order.py | 90% |
| Subscription management | src/services/subscription.py | 75% |

### Recommendations

Based on existing patterns:
1. Create `src/services/payment_service.py`
2. Follow existing error handling pattern
3. Use existing validation decorators
4. Reuse `src/utils/api_response.py`
```

## Integration with /vibe.spec

```
/vibe.spec "payment feature"

→ codebase-patterns-agent execution:
  "Find similar payment/transaction code. Extract patterns."

→ Results reflected in SPEC:
  - Follow existing patterns
  - Reference similar code
  - Maintain consistency
```
