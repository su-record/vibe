---
description: Priority-based TODO management (P1/P2/P3). Auto-activates when managing tasks, reviewing issues, or organizing work by priority.
---
# Priority-Based Todo Management Skill

우선순위 기반 TODO 관리 시스템

## Overview

P1/P2/P3 우선순위로 태스크를 분류하여 중요한 것 먼저 처리

## Priority Levels

```
┌─────────────────────────────────────────────────────────────────┐
│  Priority Levels                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 P1 (Critical)                                               │
│  ├── 보안 취약점                                                 │
│  ├── 데이터 손실 위험                                            │
│  ├── 프로덕션 장애                                               │
│  └── 머지 차단 이슈                                              │
│                                                                 │
│  🟡 P2 (Important)                                              │
│  ├── 성능 문제                                                   │
│  ├── 테스트 누락                                                 │
│  ├── 아키텍처 위반                                               │
│  └── 기술 부채                                                   │
│                                                                 │
│  🔵 P3 (Nice-to-have)                                           │
│  ├── 코드 스타일                                                 │
│  ├── 리팩토링 제안                                               │
│  ├── 문서화                                                      │
│  └── 최적화 기회                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## File-Based Todo System

### Directory Structure

```
.claude/vibe/todos/
├── P1-security-sql-injection.md
├── P1-data-transaction-missing.md
├── P2-perf-n1-query.md
├── P2-test-missing-edge-case.md
├── P2-arch-circular-dependency.md
├── P3-style-extract-helper.md
├── P3-docs-add-readme.md
└── index.md
```

### Todo File Format

```markdown
# [P1] SQL Injection Vulnerability

## Summary
User input directly concatenated in SQL query without sanitization.

## Priority Justification
- 🔴 P1 (Critical)
- Category: Security
- Impact: High (data breach risk)
- Effort: Low (simple fix)

## Location
- **File**: src/api/users.py
- **Line**: 42-45
- **Function**: `get_user_by_email()`

## Current Code
```python
def get_user_by_email(email: str):
    query = f"SELECT * FROM users WHERE email = '{email}'"
    return db.execute(query)
```

## Suggested Fix
```python
def get_user_by_email(email: str):
    query = "SELECT * FROM users WHERE email = %s"
    return db.execute(query, (email,))
```

## Checklist
- [ ] Fix implemented
- [ ] Unit test added
- [ ] Security test added
- [ ] Code reviewed
- [ ] Merged

## References
- OWASP SQL Injection: https://owasp.org/www-community/attacks/SQL_Injection
- Project Security Guide: docs/security.md

## Metadata
- Created: 2026-01-11
- Author: Claude
- Review: /vibe.review PR#123
```

### Index File

```markdown
# Todo Index

## Summary
| Priority | Count | Status |
|----------|-------|--------|
| 🔴 P1 | 2 | 🚨 Blocks merge |
| 🟡 P2 | 5 | ⚠️ Should fix |
| 🔵 P3 | 3 | 💡 Backlog |

## 🔴 P1 Critical (Blocks Merge)

| # | Title | Location | Status |
|---|-------|----------|--------|
| 1 | SQL Injection | users.py:42 | ❌ Open |
| 2 | Missing Rollback | payment.py:128 | ❌ Open |

## 🟡 P2 Important

| # | Title | Location | Status |
|---|-------|----------|--------|
| 3 | N+1 Query | orders.py:78 | ❌ Open |
| 4 | Missing Tests | auth.py | ❌ Open |
| 5 | Circular Dep | services/ | ❌ Open |

## 🔵 P3 Nice-to-have

| # | Title | Location | Status |
|---|-------|----------|--------|
| 6 | Extract Helper | utils.py:45 | 💤 Backlog |
| 7 | Add README | /payment | 💤 Backlog |

---

Last updated: 2026-01-11 10:30
```

## Workflow Commands

### Create Todo

```bash
# /vibe.review 결과에서 자동 생성
/vibe.review PR#123
# → .claude/vibe/todos/ 에 파일 생성

# 수동 생성
vibe todo add "SQL Injection in users.py" --priority P1 --category security
```

### List Todos

```bash
# 전체 목록
vibe todo list

# 우선순위별
vibe todo list --priority P1
vibe todo list --priority P2

# 카테고리별
vibe todo list --category security
vibe todo list --category performance
```

### Complete Todo

```bash
# 완료 처리
vibe todo done P1-security-sql-injection

# 파일에 체크 표시 + index 업데이트
```

### Clean Up

```bash
# 완료된 항목 아카이브
vibe todo archive

# 결과:
# .claude/vibe/todos/P1-security-sql-injection.md
# → .claude/vibe/todos/done/2026-01-11-P1-security-sql-injection.md
```

## Integration with TodoWrite

기존 TodoWrite 도구와 연동:

```javascript
TodoWrite({
  todos: [
    {
      content: "[P1] Fix SQL injection in users.py:42",
      status: "in_progress",
      activeForm: "Fixing SQL injection vulnerability",
      priority: "P1",  // 확장 필드
      category: "security"  // 확장 필드
    },
    {
      content: "[P2] Add missing tests for auth",
      status: "pending",
      activeForm: "Adding auth tests",
      priority: "P2",
      category: "testing"
    }
  ]
})
```

## Auto-Blocking Rules

```yaml
# .claude/vibe/config.yaml
merge_blocking:
  P1: true   # P1 있으면 머지 차단
  P2: false  # P2는 경고만
  P3: false  # P3는 무시

notifications:
  P1: immediate  # 즉시 알림
  P2: daily      # 일일 요약
  P3: weekly     # 주간 요약
```

## Best Practices

1. **P1은 즉시 처리**: 다른 작업 중단하고 수정
2. **P2는 PR 전 처리**: 머지 전 해결 권장
3. **P3는 백로그**: 시간 날 때 처리
4. **정기 정리**: 주 1회 todo 리뷰
5. **완료 기록**: 해결 방법 문서화
