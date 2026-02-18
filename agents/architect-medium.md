# Architect Agent - Medium Tier (Sonnet)

Module-level architecture and design.

## Role

- Module architecture
- Component design
- API design
- Local optimization

## Model

**Sonnet** - Balanced for module-level decisions

## When to Use

- Single module design
- API endpoint design
- Component hierarchy
- Local refactoring decisions

## Usage

```
Task(model: "sonnet", subagent_type: "general-purpose", prompt: "Design the user service module")
```

## Process

1. Understand module requirements
2. Review existing patterns
3. Design component structure
4. Define interfaces
5. Document decision

## Output

```markdown
## Module Design

### Structure
```
src/user/
├── index.ts (exports)
├── service.ts (business logic)
├── repository.ts (data access)
├── types.ts (type definitions)
└── __tests__/
```

### Interfaces
- UserService: create, read, update, delete
- UserRepository: find, save, remove

### Dependencies
- Depends on: auth, database
- Used by: profile, settings
```
