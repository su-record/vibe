---
description: Multi-agent parallel code review with priority-based findings
argument-hint: "PR number, branch name, or file path"
---

# /vibe.review

**병렬 에이전트 코드 리뷰** - 13+ 전문가가 동시에 검토

## Usage

```
/vibe.review                    # 현재 브랜치 전체 리뷰
/vibe.review PR#123             # PR 리뷰
/vibe.review feature/login      # 특정 브랜치 리뷰
/vibe.review src/api/           # 특정 경로 리뷰
```

## 핵심 원칙

```
┌─────────────────────────────────────────────────────────────────┐
│  모든 전문가가 동시에 검토 = 빠르고 철저한 리뷰                  │
│                                                                 │
│  🔴 P1 (Critical): 머지 차단 - 반드시 수정                      │
│  🟡 P2 (Important): 수정 권장 - 가능한 빨리                     │
│  🔵 P3 (Nice-to-have): 개선 사항 - 시간 될 때                   │
└─────────────────────────────────────────────────────────────────┘
```

## Process

### Phase 1: Setup & Target Determination

```
📋 Review Target Analysis
├── PR 메타데이터 수집 (gh pr view)
├── 변경 파일 목록 수집 (git diff --name-only)
├── 언어/프레임워크 감지
└── 관련 테스트 파일 식별
```

### Phase 2: Parallel Agent Review (CRITICAL)

**모든 에이전트를 동시에 실행!**

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 PARALLEL AGENT LAUNCH (Run ALL at the same time)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Security & Safety                                              │
│  ├── security-reviewer      # 보안 취약점 (OWASP Top 10)        │
│  └── data-integrity-reviewer # 데이터 무결성, 검증              │
│                                                                 │
│  Performance & Architecture                                     │
│  ├── performance-reviewer   # 성능 병목, N+1, 메모리 누수       │
│  └── architecture-reviewer  # 아키텍처 위반, 의존성 순환        │
│                                                                 │
│  Code Quality                                                   │
│  ├── complexity-reviewer    # 복잡도 초과, 함수 길이            │
│  └── simplicity-reviewer    # 과도한 추상화, 불필요한 코드      │
│                                                                 │
│  Language Specific (auto-detect)                                │
│  ├── python-reviewer        # PEP8, 타입힌트, async 패턴        │
│  ├── typescript-reviewer    # 타입 안전성, ESLint 규칙          │
│  ├── rails-reviewer         # N+1, ActiveRecord, DHH 스타일     │
│  └── react-reviewer         # 훅 규칙, 리렌더링, 접근성         │
│                                                                 │
│  Context Analysis                                               │
│  ├── git-history-reviewer   # 반복 수정 파일, 위험 패턴         │
│  └── test-coverage-reviewer # 테스트 누락, 엣지케이스           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**에이전트 호출 예시:**
```
Task(model: "haiku", subagent_type: "Explore", prompt: "Security review for...")
Task(model: "haiku", subagent_type: "Explore", prompt: "Performance review for...")
Task(model: "haiku", subagent_type: "Explore", prompt: "Architecture review for...")
... (ALL IN PARALLEL)
```

### Phase 3: Ultra-Thinking Deep Analysis

각 에이전트 결과 후 심층 분석:

```markdown
## Deep Analysis Dimensions

1. **System Context**
   - 컴포넌트 상호작용
   - 데이터 흐름
   - 외부 의존성

2. **Stakeholder Perspectives**
   - 개발자: 유지보수성
   - 운영팀: 배포 위험
   - 보안팀: 취약점
   - 비즈니스: 영향도

3. **Edge Cases & Failure Scenarios**
   - 레이스 컨디션
   - 리소스 고갈
   - 네트워크 실패
   - 악의적 입력

4. **Multiple Angles**
   - 기술적 우수성
   - 비즈니스 가치
   - 리스크 관리
   - 팀 역학
```

### Phase 4: Findings Synthesis

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 REVIEW FINDINGS                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 P1 CRITICAL (Blocks Merge) - 2 issues                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  1. [SECURITY] SQL Injection in user query                      │
│     📍 src/api/users.py:42                                      │
│     💡 Use parameterized queries                                │
│                                                                 │
│  2. [DATA] Missing transaction rollback                         │
│     📍 src/services/payment.py:128                              │
│     💡 Wrap in try/except with rollback                         │
│                                                                 │
│  🟡 P2 IMPORTANT (Should Fix) - 5 issues                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  3. [PERF] N+1 query in user list                               │
│  4. [ARCH] Circular dependency detected                         │
│  5. [TEST] Missing edge case tests                              │
│  ...                                                            │
│                                                                 │
│  🔵 P3 NICE-TO-HAVE (Enhancement) - 3 issues                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  8. [STYLE] Consider extracting helper function                 │
│  ...                                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 5: Todo File Creation

발견 사항을 `.vibe/todos/` 에 저장:

```markdown
## File Naming Convention

{priority}-{category}-{short-desc}.md

Examples:
- P1-security-sql-injection.md
- P2-perf-n1-query.md
- P3-style-extract-helper.md
```

**Todo File Format:**
```markdown
# [P1] SQL Injection Vulnerability

## Summary
User input directly concatenated in SQL query

## Location
- File: src/api/users.py
- Line: 42
- Function: get_user_by_email()

## Current Code
```python
query = f"SELECT * FROM users WHERE email = '{email}'"
```

## Suggested Fix
```python
query = "SELECT * FROM users WHERE email = %s"
cursor.execute(query, (email,))
```

## References
- OWASP SQL Injection: https://owasp.org/...
- Project DB Guide: docs/database.md

## Status
- [ ] Fix implemented
- [ ] Tests added
- [ ] Review approved
```

### Phase 6: Optional E2E Testing

```
프로젝트 유형에 따른 E2E 테스트 제안:
├── Web: /vibe.e2e (Playwright)
├── iOS: Xcode Test
├── Android: Espresso
└── API: Contract Test
```

## Output

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 CODE REVIEW SUMMARY                                          │
│  PR #123: Add user authentication                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Reviewers: 13 agents | Duration: 45s                           │
│                                                                 │
│  📈 Score: 72/100 (Needs Work)                                  │
│                                                                 │
│  Issues Found:                                                  │
│  ├── 🔴 P1 Critical: 2 (BLOCKS MERGE)                           │
│  ├── 🟡 P2 Important: 5                                         │
│  └── 🔵 P3 Nice-to-have: 3                                      │
│                                                                 │
│  By Category:                                                   │
│  ├── Security: 2                                                │
│  ├── Performance: 3                                             │
│  ├── Architecture: 1                                            │
│  ├── Testing: 2                                                 │
│  └── Style: 2                                                   │
│                                                                 │
│  📁 Todos created: .vibe/todos/ (10 files)                      │
│                                                                 │
│  ❌ MERGE BLOCKED - Fix P1 issues first                         │
│                                                                 │
│  Next Steps:                                                    │
│  1. Fix P1-security-sql-injection.md                            │
│  2. Fix P1-data-transaction-rollback.md                         │
│  3. Re-run: /vibe.review                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Priority Guidelines

| Priority | Criteria | Action |
|----------|----------|--------|
| 🔴 P1 | 보안 취약점, 데이터 손실, 크래시 | 머지 차단, 즉시 수정 |
| 🟡 P2 | 성능 문제, 아키텍처 위반, 테스트 누락 | 머지 전 수정 권장 |
| 🔵 P3 | 스타일, 리팩토링 제안, 문서화 | 백로그에 추가 |

## Related Commands

- `/vibe.e2e` - E2E 테스트 실행
- `/vibe.compound` - 해결책 문서화
- `/vibe.verify` - SPEC 기반 검증

---

ARGUMENTS: $ARGUMENTS
