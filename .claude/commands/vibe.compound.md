---
description: Auto-document solutions for knowledge compounding
argument-hint: "solution description (optional)"
---

# /vibe.compound

**지식 복리 효과** - 해결한 문제를 자동 문서화하여 미래 생산성 향상

> "Each solution documented makes future problems easier to solve."

## Usage

```
/vibe.compound                           # 최근 해결 사항 자동 감지
/vibe.compound "Redis 캐시 무효화 문제"   # 특정 해결책 문서화
```

## 자동 트리거

다음 키워드 감지 시 자동 제안:
- "it's fixed", "해결됨", "fixed", "solved"
- PR 머지 직후
- `/vibe.verify` 통과 후

## Process

### Phase 1: Solution Extraction

병렬 에이전트로 해결책 분석:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 PARALLEL SOLUTION ANALYSIS                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Task 1: problem-analyzer                                       │
│  ├── 원래 문제 파악                                              │
│  ├── 증상 및 에러 메시지                                         │
│  └── 영향 범위                                                   │
│                                                                 │
│  Task 2: solution-extractor                                     │
│  ├── 적용된 수정 사항                                            │
│  ├── 핵심 코드 변경                                              │
│  └── 설정 변경                                                   │
│                                                                 │
│  Task 3: root-cause-analyzer                                    │
│  ├── 근본 원인                                                   │
│  ├── 왜 발생했는지                                               │
│  └── 방지 방법                                                   │
│                                                                 │
│  Task 4: pattern-recognizer                                     │
│  ├── 유사 문제 패턴                                              │
│  ├── 관련 기술 스택                                              │
│  └── 검색 키워드                                                 │
│                                                                 │
│  Task 5: category-classifier                                    │
│  ├── 카테고리 분류                                               │
│  ├── 태그 생성                                                   │
│  └── 관련 문서 링크                                              │
│                                                                 │
│  Task 6: code-snippet-extractor                                 │
│  ├── Before/After 코드                                          │
│  ├── 핵심 변경 하이라이트                                        │
│  └── 복사 가능한 스니펫                                          │
│                                                                 │
│  Task 7: prevention-advisor                                     │
│  ├── 재발 방지 체크리스트                                        │
│  ├── 린터 규칙 제안                                              │
│  └── 테스트 케이스 제안                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Category Classification

```
.vibe/solutions/
├── security/           # 보안 관련
│   ├── sql-injection-prevention.md
│   └── xss-sanitization.md
├── performance/        # 성능 최적화
│   ├── n1-query-fix.md
│   └── redis-cache-invalidation.md
├── database/           # DB 관련
│   ├── migration-rollback.md
│   └── deadlock-resolution.md
├── integration/        # 외부 연동
│   ├── stripe-webhook-retry.md
│   └── aws-s3-timeout.md
├── frontend/           # 프론트엔드
│   ├── react-hydration-mismatch.md
│   └── infinite-scroll-memory.md
├── testing/            # 테스트
│   ├── flaky-test-fix.md
│   └── mock-timezone.md
└── deployment/         # 배포
    ├── docker-layer-cache.md
    └── k8s-rolling-update.md
```

### Phase 3: Document Generation

```markdown
# [Solution] Redis 캐시 무효화 문제

## TL;DR
Redis 캐시 키에 버전 접미사 추가로 무효화 문제 해결

## Problem
### 증상
- 사용자 프로필 업데이트 후에도 이전 데이터 표시
- 새로고침해도 동일한 문제

### 에러/로그
```
Cache hit: user:123 (stale data)
```

### 영향 범위
- 사용자 프로필 페이지
- API: GET /api/users/:id

## Root Cause
캐시 키가 user_id만 사용하여 업데이트 시 무효화되지 않음

```python
# Before
cache_key = f"user:{user_id}"  # 버전 없음
```

## Solution
### 핵심 변경
캐시 키에 updated_at 타임스탬프 추가

```python
# After
cache_key = f"user:{user_id}:v{updated_at.timestamp()}"
```

### 변경 파일
- src/services/cache.py:42
- src/api/users.py:78

## Prevention
- [ ] 캐시 키에 항상 버전/타임스탬프 포함
- [ ] 캐시 무효화 테스트 추가
- [ ] 린터 규칙: cache_key 패턴 검사

## Related
- 유사 이슈: #234 (Session cache)
- 문서: docs/caching-strategy.md
- 태그: #redis #cache #invalidation

## Metadata
- 해결일: 2026-01-11
- 소요시간: 2시간
- 난이도: 중
- 재사용성: 높음
```

### Phase 4: Index Update

`.vibe/solutions/index.md` 자동 업데이트:

```markdown
# Solution Index

## Recently Added
| Date | Category | Title | Tags |
|------|----------|-------|------|
| 2026-01-11 | performance | Redis 캐시 무효화 | #redis #cache |
| 2026-01-10 | security | SQL Injection 방지 | #sql #security |

## By Category
- **Security** (5 solutions)
- **Performance** (8 solutions)
- **Database** (4 solutions)
...

## Search Keywords
- redis → performance/redis-cache-invalidation.md
- n+1 → performance/n1-query-fix.md
- sql injection → security/sql-injection-prevention.md
```

## Auto-Suggestion

유사 문제 발생 시 자동 제안:

```
┌─────────────────────────────────────────────────────────────────┐
│  💡 Similar Solution Found!                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  You're working on: "캐시가 업데이트 안 됨"                      │
│                                                                 │
│  Related solution (85% match):                                  │
│  📄 .vibe/solutions/performance/redis-cache-invalidation.md     │
│                                                                 │
│  Key insight: 캐시 키에 버전 접미사 추가                         │
│                                                                 │
│  Apply this solution? [Y/n]                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Output

```
┌─────────────────────────────────────────────────────────────────┐
│  📚 SOLUTION DOCUMENTED                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Created: .vibe/solutions/performance/redis-cache-invalid... │
│                                                                 │
│  📊 Knowledge Base Stats:                                        │
│  ├── Total Solutions: 42                                        │
│  ├── This Month: 8                                              │
│  └── Most Used Category: performance                            │
│                                                                 │
│  🔗 Similar solutions linked: 2                                  │
│  🏷️ Tags: #redis #cache #invalidation #performance              │
│                                                                 │
│  💡 Prevention rules added to .vibe/rules/                       │
│                                                                 │
│  "This solution will help future you (or teammates) save hours" │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Integration with Memory

자동으로 `vibe_save_memory` 호출:

```json
{
  "type": "solution",
  "category": "performance",
  "title": "Redis 캐시 무효화",
  "keywords": ["redis", "cache", "invalidation"],
  "file": ".vibe/solutions/performance/redis-cache-invalidation.md"
}
```

## Workflow Integration

```
/vibe.spec → /vibe.run → /vibe.verify → /vibe.compound
                                              │
                                              ▼
                                    .vibe/solutions/
                                              │
                                              ▼
                                    Future problem?
                                    Auto-suggest!
```

---

ARGUMENTS: $ARGUMENTS
