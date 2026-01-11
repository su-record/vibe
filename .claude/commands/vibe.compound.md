---
description: Auto-document solutions for knowledge compounding
argument-hint: "solution description (optional)"
---

# /vibe.compound

**Knowledge Compounding** - Auto-document solved problems to boost future productivity

> "Each solution documented makes future problems easier to solve."

## Usage

```
/vibe.compound                           # Auto-detect recent solutions
/vibe.compound "Redis cache invalidation" # Document specific solution
```

## Auto-Triggers

Automatically suggested when these patterns detected:
- "it's fixed", "fixed", "solved", "resolved"
- After PR merge
- After `/vibe.verify` passes

## Process

### Phase 1: Solution Extraction

Parallel agents analyze the solution:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 PARALLEL SOLUTION ANALYSIS                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Task 1: problem-analyzer                                       │
│  ├── Identify original problem                                  │
│  ├── Symptoms and error messages                                │
│  └── Impact scope                                               │
│                                                                 │
│  Task 2: solution-extractor                                     │
│  ├── Applied fixes                                              │
│  ├── Key code changes                                           │
│  └── Configuration changes                                      │
│                                                                 │
│  Task 3: root-cause-analyzer                                    │
│  ├── Root cause identification                                  │
│  ├── Why it happened                                            │
│  └── Prevention methods                                         │
│                                                                 │
│  Task 4: pattern-recognizer                                     │
│  ├── Similar problem patterns                                   │
│  ├── Related tech stack                                         │
│  └── Search keywords                                            │
│                                                                 │
│  Task 5: category-classifier                                    │
│  ├── Category classification                                    │
│  ├── Tag generation                                             │
│  └── Related doc links                                          │
│                                                                 │
│  Task 6: code-snippet-extractor                                 │
│  ├── Before/After code                                          │
│  ├── Key change highlights                                      │
│  └── Copy-paste snippets                                        │
│                                                                 │
│  Task 7: prevention-advisor                                     │
│  ├── Prevention checklist                                       │
│  ├── Suggested linter rules                                     │
│  └── Test case suggestions                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Category Classification

```
.vibe/solutions/
├── security/           # Security related
│   ├── sql-injection-prevention.md
│   └── xss-sanitization.md
├── performance/        # Performance optimization
│   ├── n1-query-fix.md
│   └── redis-cache-invalidation.md
├── database/           # Database related
│   ├── migration-rollback.md
│   └── deadlock-resolution.md
├── integration/        # External integrations
│   ├── stripe-webhook-retry.md
│   └── aws-s3-timeout.md
├── frontend/           # Frontend issues
│   ├── react-hydration-mismatch.md
│   └── infinite-scroll-memory.md
├── testing/            # Testing related
│   ├── flaky-test-fix.md
│   └── mock-timezone.md
└── deployment/         # Deployment issues
    ├── docker-layer-cache.md
    └── k8s-rolling-update.md
```

### Phase 3: Document Generation

```markdown
# [Solution] Redis Cache Invalidation

## TL;DR
Added version suffix to Redis cache key to fix invalidation issue

## Problem
### Symptoms
- User profile shows stale data after update
- Refresh doesn't fix the issue

### Error/Logs
```
Cache hit: user:123 (stale data)
```

### Impact Scope
- User profile page
- API: GET /api/users/:id

## Root Cause
Cache key only used user_id, not invalidated on update

```python
# Before
cache_key = f"user:{user_id}"  # No version
```

## Solution
### Key Change
Add updated_at timestamp to cache key

```python
# After
cache_key = f"user:{user_id}:v{updated_at.timestamp()}"
```

### Changed Files
- src/services/cache.py:42
- src/api/users.py:78

## Prevention
- [ ] Always include version/timestamp in cache keys
- [ ] Add cache invalidation tests
- [ ] Linter rule: cache_key pattern check

## Related
- Similar issue: #234 (Session cache)
- Docs: docs/caching-strategy.md
- Tags: #redis #cache #invalidation

## Metadata
- Resolved: 2026-01-11
- Time spent: 2 hours
- Difficulty: Medium
- Reusability: High
```

### Phase 4: Index Update

Auto-update `.vibe/solutions/index.md`:

```markdown
# Solution Index

## Recently Added
| Date | Category | Title | Tags |
|------|----------|-------|------|
| 2026-01-11 | performance | Redis cache invalidation | #redis #cache |
| 2026-01-10 | security | SQL Injection prevention | #sql #security |

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

When similar problem detected:

```
┌─────────────────────────────────────────────────────────────────┐
│  💡 Similar Solution Found!                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  You're working on: "Cache not updating"                        │
│                                                                 │
│  Related solution (85% match):                                  │
│  📄 .vibe/solutions/performance/redis-cache-invalidation.md     │
│                                                                 │
│  Key insight: Add version suffix to cache key                   │
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

Auto-invoke `vibe_save_memory`:

```json
{
  "type": "solution",
  "category": "performance",
  "title": "Redis cache invalidation",
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
