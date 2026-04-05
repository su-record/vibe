# TODO Prioritization Rubric

Use these criteria to assign P1, P2, or P3 to any TODO item.

## P1 — Blocks Merge

Assign P1 when ANY of the following is true:

| Criterion | Example |
|-----------|---------|
| Security vulnerability | SQL injection, XSS, unprotected endpoint, leaked secret |
| Data loss or corruption risk | Missing transaction, overwrite without backup |
| Type safety bypass | `: any`, `as any`, `@ts-ignore` hiding a real error |
| Production breakage | Throws uncaught exception on valid input |
| Broken CI/test | Failing test committed (not pre-existing) |
| Missing auth/authz check | Unauthenticated access to protected resource |
| Regulatory non-compliance | GDPR PII without consent, HIPAA violation |

**Decision rule**: Would this cause an incident if it shipped? → P1

---

## P2 — Fix Before PR

Assign P2 when ANY of the following is true AND it is not P1:

| Criterion | Example |
|-----------|---------|
| Performance regression | O(n²) loop, N+1 query, synchronous blocking call |
| Missing test coverage | New feature with no tests |
| Architecture violation | Layer boundary crossed (service imports UI) |
| `console.log` in committed code | Debug output in production path |
| Function > 50 lines | Complexity limit exceeded |
| Nesting depth > 4 | Readability and test difficulty |
| Duplicate logic across 2+ files | Maintenance hazard; divergence risk |
| TODO/FIXME without tracking ticket | Ambiguous ownership |

**Decision rule**: Would a reviewer request changes on this in a PR review? → P2

---

## P3 — Backlog

Assign P3 when the issue is real but has no immediate consequence:

| Criterion | Example |
|-----------|---------|
| Style inconsistency | Different quote styles, inconsistent naming |
| Magic numbers with low risk | Timeout values, display constants |
| Commented-out code | Dead code left behind |
| Missing JSDoc on internal helpers | Not public API |
| File nearing complexity limit | 150–200 lines, not there yet |
| Refactoring opportunity | Could be cleaner but works correctly |

**Decision rule**: Could this be deferred a week without risk? → P3

---

## Upgrade / Downgrade Rules

| Situation | Action |
|-----------|--------|
| P3 item appears in 3+ files | Upgrade to P2 (systemic issue) |
| P2 item has no fix path identified | Keep P2, add a note |
| P1 item is in dead code (never executed) | Downgrade to P2 with justification |
| P2 item found in P1 audit | Upgrade to P1 if it compounds the P1 issue |

## When Uncertain

Default to the higher priority. It is cheaper to over-prioritize than to ship a P1 labeled as P3.
