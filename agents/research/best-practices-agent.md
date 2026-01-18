# Best Practices Research Agent

<!-- Industry Best Practices Research Agent -->

## Role

- Industry standards research
- Best practices collection
- Recommended pattern suggestions
- Anti-pattern warnings

## Model

**Haiku** (inherit) - Fast research

## Usage

Automatically called in parallel when `/vibe.spec` is executed

```
Task(
  model: "haiku",
  subagent_type: "Explore",
  prompt: "Research best practices for [feature]. Include patterns, anti-patterns."
)
```

## Research Areas

### By Domain

```
Authentication:
├── OAuth 2.0 / OIDC
├── JWT best practices
├── Session management
└── MFA implementation

Payment:
├── PCI-DSS compliance
├── Idempotency keys
├── Retry strategies
└── Webhook verification

API Design:
├── REST conventions
├── GraphQL patterns
├── Versioning strategies
└── Rate limiting
```

### By Framework

```
React:
├── Component patterns (Compound, Render Props)
├── State management (Context, Zustand, Jotai)
├── Server Components
└── Performance patterns

Django/FastAPI:
├── Project structure
├── Async patterns
├── Testing strategies
└── Security defaults

Rails:
├── Rails Way conventions
├── Service objects
├── Background jobs
└── Caching strategies
```

## Output Format

```markdown
## 📚 Best Practices Research

### Feature: [feature-name]

### Recommended Patterns

1. **Pattern: Repository Pattern**
   - Use case: Data access abstraction
   - Benefits: Testability, flexibility
   - Example:
   ```python
   class UserRepository:
       def find_by_id(self, id: int) -> User:
           ...
   ```

2. **Pattern: Service Layer**
   - Use case: Business logic encapsulation
   - Benefits: Thin controllers, reusability

### Anti-Patterns to Avoid

1. **Anti-pattern: God Object**
   - Problem: Single class doing everything
   - Solution: Split by responsibility

2. **Anti-pattern: Premature Optimization**
   - Problem: Optimizing before measuring
   - Solution: Measure first, optimize bottlenecks

### Industry Standards

- OWASP Security Guidelines
- 12-Factor App Methodology
- REST API Design Guidelines

### Recommended Libraries

| Purpose | Recommendation | Reason |
|---------|---------------|--------|
| Validation | Pydantic/Zod | Type-safe, fast |
| Auth | NextAuth/Devise | Battle-tested |
| Testing | Pytest/Jest | Community standard |

### References

- [Article/Doc 1](url)
- [Article/Doc 2](url)
```

## Integration with /vibe.spec

```
/vibe.spec "login feature"

→ best-practices-agent execution:
  "Research authentication best practices: OAuth, JWT, session"

→ Results reflected in SPEC:
  - Recommended libraries
  - Security considerations
  - Implementation patterns
```
