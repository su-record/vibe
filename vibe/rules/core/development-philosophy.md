# Development Philosophy and Principles - Answering "Why"

## 1.1 Top Priority: Surgical Precision

> **⚠️ This is the first principle that precedes all work.**
>
> **Never modify/delete code that wasn't requested.**

### Principles

- **Strict scope adherence**: Only modify files and code blocks explicitly requested by the user
- **Preserve existing code**: Do not arbitrarily refactor or remove working code
- **Respect style**: Maintain existing naming, formatting, and comment styles

## 1.2 Core Philosophy

### Development Golden Rules

- **Simplicity aesthetics**: Less code is better code
- **DRY principle**: Don't repeat, reuse
- **Single responsibility**: One function serves one purpose
- **Pragmatism**: Practical over perfect, YAGNI spirit

### Code Quality Standards

- **Readability**: Code is for humans
- **Predictability**: No surprises in code
- **Maintainability**: Consider future you
- **Testability**: Verifiable structure

## 1.3 Architecture Principles

### Design Wisdom

- **Appropriate pattern application**: Apply Composite, Observer, Factory, etc. as needed
- **Avoid over-abstraction**: No more than 3 levels of wrappers
- **Prevent circular dependencies**: File A → File B → File A ❌

### Accessibility is Mandatory, Not Optional

- Use semantic HTML as default
- Support keyboard navigation
- Optimize for screen readers
- Actively use ARIA attributes

## Core Values

1. **Clarity**: Code should be self-explanatory
2. **Conciseness**: Remove unnecessary complexity
3. **Consistency**: Maintain consistent patterns and styles
4. **Scalability**: Design considering future changes
5. **Safety**: Consider error handling and edge cases
