# Project Constitution

This document defines the core principles and coding standards for the project.

---

## Conversation Language

**Response Language**: Auto-detected from OS (en/ko)

This setting controls **conversation language with user only**.
All generated documents (SPEC, Feature, etc.) are **always in English**.

To change, modify in `.vibe/config.json`:

```json
{
  "language": "ko"  // "en" | "ko" - conversation language only
}
```

---

## Document References

All reference documents are stored globally and specified in `.vibe/config.json`:

```json
{
  "references": {
    "rules": [
      "~/.claude/vibe/rules/principles/quick-start.md",
      "~/.claude/vibe/rules/principles/development-philosophy.md",
      "~/.claude/vibe/rules/principles/communication-guide.md",
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
- **Functions ≤50 lines** (SSOT: `CLAUDE.md` Complexity Limits)
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
- **수치에는 출처를 붙인다** — 아래 참조

---

## 3.5 수치 출처 규율 (Numbers Need Provenance)

문서·SPEC·커밋 메시지에 쓰는 **모든 수치는 출처가 있어야 한다.** 출처는 셋 중 하나다:

| 종류 | 표기 | 예 |
|---|---|---|
| **실측** | 무엇을 어떻게 쟀는지 함께 | "세션 로그 60개 실측: `Agent` 13회 / `Task` 0회" |
| **1차 문서** | 공급자 공식 문서·명세 링크 | "동시 상한 min(16, cores-2) — Workflow 도구 명세" |
| **추정** | **추정임을 명시**하고 계산 근거를 남긴다 | "시나리오 상수 × 횟수 (추정)" |

출처가 없으면 **숫자를 쓰지 않는다.** "더 빠르다", "줄어든다" 로 방향만 적는 것이
틀린 배수를 적는 것보다 낫다.

**금지**
- 측정하지 않은 배수·퍼센트 (`3x faster`, `70% 절감`)
- 모델·환경에 따라 달라지는 값의 절대 하드코딩 (`80–100k 토큰` — 컨텍스트 창이
  200k 인지 1M 인지에 따라 뜻이 달라진다. 하네스가 주는 임계 신호를 쓴다)
- 출처 없이 인용된 제3자 수치 — **인용 자체가 1차 출처의 대체물이 아니다**

**WHY**: 근거 없는 수치는 반증되기 전까지 사실처럼 유통되고, 그 위에서 내린 결정은
되돌리기 어렵다. 널리 퍼진 "AI 코딩 비용의 90%는 불필요한 컨텍스트" 인용문은 1차
출처가 확인되지 않았고, 함께 돌던 "린트에 최상위 모델 = 30배" 는 공식 가격표 기준
최대 10배, "배치 70~90% 절감" 은 공식 할인율 50% 였다. 방향은 맞아도 숫자는
근거가 없었다. vibe 는 완료를 자기보고가 아니라 결정론적 게이트로 판정한다 —
같은 기준을 **문서의 수치**에도 적용한다.

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
