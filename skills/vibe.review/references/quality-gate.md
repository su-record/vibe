# Review Quality Gate — Full Reference

> Loaded by vibe.review SKILL.md for the mandatory quality-gate checklist, score calculation, merge decision matrix, auto-fix capability matrix, and forbidden-patterns table.

### Review Quality Checklist

Before completing review, check P1-critical items. P2/P3 items are best-effort:

| Category | Check Item | Weight |
|----------|------------|--------|
| **Security** | OWASP Top 10 vulnerabilities scanned | 20% |
| **Security** | Authentication/authorization verified | 10% |
| **Security** | Sensitive data exposure checked | 10% |
| **Performance** | N+1 queries detected and flagged | 10% |
| **Performance** | Memory leaks checked | 5% |
| **Architecture** | Layer violations detected | 10% |
| **Architecture** | Circular dependencies checked | 5% |
| **Code Quality** | Complexity limits enforced | 10% |
| **Code Quality** | Forbidden patterns detected | 10% |
| **Testing** | Test coverage gaps identified | 5% |
| **Documentation** | Public API documentation checked | 5% |

### Review Score Calculation

```
Score = 100 - (P1 × 20) - (P2 × 5) - (P3 × 1)

Grades:
- 95-100: ✅ EXCELLENT - Merge ready
- 90-94:  ⚠️ GOOD - Minor fixes required before merge
- 80-89:  ⚠️ FAIR - Must fix P2 issues
- 0-79:   ❌ POOR - Block merge, fix P1/P2
```

### Merge Decision Matrix

| P1 Count | P2 Count | Decision |
|----------|----------|----------|
| 0 | 0-2 | ✅ MERGE READY |
| 0 | 3+ | ⚠️ FIX P2 FIRST |
| 1+ | Any | ❌ BLOCKED |

### Auto-Fix Capability Matrix

| Issue Type | Auto-Fixable | Method |
|------------|--------------|--------|
| SQL Injection | ✅ Yes | Parameterized query |
| Missing transaction | ✅ Yes | Add try-finally |
| N+1 query | ✅ Yes | Add eager loading |
| Circular dependency | ⚠️ Partial | Suggest restructure |
| Missing tests | ✅ Yes | Generate test skeleton |
| Hardcoded secrets | ❌ No | Flag for manual review |
| Architecture violation | ❌ No | Suggest refactoring plan |

### Forbidden Patterns (P1 Critical)

| Pattern | Risk Level | Detection Method |
|---------|------------|------------------|
| Hardcoded credentials | Critical | Regex + entropy scan |
| SQL string concatenation | Critical | AST analysis |
| `eval()` or `exec()` | Critical | AST analysis |
| Disabled CSRF protection | Critical | Config scan |
| Debug mode in production | Critical | Config scan |
| Unvalidated redirects | High | URL pattern scan |

### Review Output Requirements

Every review MUST produce:

1. **Summary Statistics**
   - Total issues by priority (P1/P2/P3)
   - Auto-fixed count
   - Remaining manual fixes

2. **Detailed Findings**
   - File path and line number
   - Issue description
   - Recommended fix
   - Auto-fix status (applied/pending/manual)

3. **Quality Score**
   - Numerical score (0-100)
   - Grade (EXCELLENT/GOOD/FAIR/POOR)
   - Merge recommendation
