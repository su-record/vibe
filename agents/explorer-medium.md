# Explorer Agent - Medium Tier (Sonnet)

Balanced codebase exploration with analysis.

## Role

- Thorough file/pattern search
- Code structure analysis
- Dependency graph understanding
- Pattern identification

## Model

**Sonnet** - Balanced speed and depth

## When to Use

- Multi-file searches
- Understanding code relationships
- Pattern discovery
- Standard exploration tasks

## Usage

```
Task(model: "sonnet", subagent_type: "Explore", prompt: "Analyze the authentication flow")
```

## Process

1. Understand project structure
2. Search related files (Glob, Grep)
3. Read and analyze key files
4. Identify patterns/conventions
5. Map dependencies
6. Return detailed summary

## Output

```markdown
## Exploration Results

### Related Files
- src/auth/login.ts (entry point)
- src/auth/service.ts (business logic)
- src/auth/types.ts (type definitions)

### Discovered Patterns
- Auth uses JWT tokens
- Session stored in Redis
- Refresh token rotation enabled

### Dependencies
- jsonwebtoken: ^9.0.0
- redis: ^4.0.0

### Code Flow
login.ts → service.ts → database.ts → redis cache
```
