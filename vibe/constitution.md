# Project Constitution

This document defines the core principles and coding standards for the project.

---

## Conversation Language

**Response Language**: Auto-detected from OS (en/ko)

This setting controls **conversation language with user only**.
All generated documents (SPEC, Feature, etc.) are **always in English**.

To change, modify in `.claude/vibe/config.json`:

```json
{
  "language": "ko"  // "en" | "ko" - conversation language only
}
```

---

## Document References

All reference documents are stored globally and specified in `.claude/vibe/config.json`:

```json
{
  "references": {
    "rules": [
      "~/.claude/vibe/rules/core/quick-start.md",
      "~/.claude/vibe/rules/core/development-philosophy.md",
      "~/.claude/vibe/rules/core/communication-guide.md",
      "~/.claude/vibe/rules/quality/checklist.md",
      "~/.claude/vibe/rules/quality/bdd-contract-testing.md",
      "~/.claude/vibe/rules/quality/testing-strategy.md",
      "~/.claude/vibe/rules/standards/anti-patterns.md",
      "~/.claude/vibe/rules/standards/code-structure.md",
      "~/.claude/vibe/rules/standards/complexity-metrics.md",
      "~/.claude/vibe/rules/standards/naming-conventions.md"
    ],
    "languages": [
      "~/.claude/vibe/languages/{detected-stack}.md"
    ],
    "templates": [
      "~/.claude/vibe/templates/spec-template.md",
      "~/.claude/vibe/templates/feature-template.md",
      "~/.claude/vibe/templates/constitution-template.md",
      "~/.claude/vibe/templates/contract-backend-template.md",
      "~/.claude/vibe/templates/contract-frontend-template.md"
    ]
  }
}
```

- **rules**: Core principles, quality standards, coding conventions (10 documents)
- **languages**: Stack-specific coding standards (auto-detected from package.json)
- **templates**: Document templates for SPEC, Feature, Contract tests (5 documents)

---

## 1. Project Principles

### Values
1. **User-Centric**: User experience first
2. **Quality**: Correct over fast
3. **Simplicity**: Simple over complex
4. **Collaboration**: Team over individual

### Decision Criteria
1. Security > Performance > Convenience
2. Clarity > Cleverness
3. Testable > Abstract Design

---

## 2. Coding Standards

### Common Principles
- **DRY**: Don't Repeat Yourself
- **SRP**: Single Responsibility Principle
- **YAGNI**: You Aren't Gonna Need It
- **Functions ≤30 lines** (recommended), ≤50 lines (allowed)
- **Cyclomatic Complexity ≤10**
- **Cognitive Complexity ≤15**

### Naming Rules
- Variables: nouns (`userData`, `userList`)
- Functions: verb+noun (`fetchData`, `updateUser`)
- Boolean: `is/has/can` (`isLoading`, `hasError`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_RETRY_COUNT`)

---

## 3. Quality Standards (TRUST 5)

### T - Test-first
- ✅ Contract Testing (highest priority)
- ✅ Integration Testing (70%+ coverage)
- 🔵 Unit Testing (pure functions only)

### R - Readable
- Clear comments and docstrings
- Descriptive variable names
- Comments for complex logic

### U - Unified
- Consistent coding style
- Same patterns across project

### S - Secured
- SQL Injection prevention
- XSS prevention
- Sensitive info via environment variables

### T - Trackable
- Clear git commit messages
- Use TODO/FIXME comments
- Document important decisions

---

## 4. Tech Stack

### Backend
- Language: TypeScript/Node.js
- Framework: Express/Fastify
- Database: SQLite

### Frontend
- Framework: {Flutter / React / etc.}
- State Management: (configure per project)

### Infrastructure
- Hosting: (configure per project)
- CI/CD: (configure per project)

---

## 5. Git Workflow

### Branch Strategy
- `main`: Production
- `develop`: Development (default branch)
- `feature/{feature-name}`: New features
- `fix/{bug-name}`: Bug fixes

### Commit Message Rules
```
feat: Add new feature
fix: Fix bug
docs: Update documentation
refactor: Refactoring
test: Add/modify tests
chore: Build, config changes
```

### PR Rules
1. SPEC-based development
2. Code review required
3. Tests must pass
4. SPEC verification complete

---

## 6. Code Review Criteria

### Required Checks
- [ ] SPEC requirements met
- [ ] TRUST 5 compliant
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] No security issues

### Recommendations
- [ ] Performance optimization considered
- [ ] Scalability considered
- [ ] Error handling complete

---

## 7. Documentation Rules

### Code Comments
- All functions: docstrings
- Complex logic: inline comments
- TODO/FIXME: include issue number

### API Documentation
- OpenAPI (Swagger) auto-generated
- Include example Request/Response

### README
- Project overview
- Installation and run instructions
- Main features description

---

## 8. Security Policy

### Authentication
- JWT-based authentication
- Refresh token usage

### Authorization
- Role-based Access Control
- Least privilege principle

### Data Protection
- Encrypt personal information
- HTTPS required
- Manage secrets via environment variables

---

## 9. Performance Goals

### Response Time
- API: P95 < 500ms
- Web page: FCP < 1.5s

### Availability
- Uptime: 99.9%
- RTO: 1 hour
- RPO: 15 minutes
