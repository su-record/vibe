# Complexity Scoring Rubric

Use this rubric to decide whether a task needs an ExecPlan and how to decompose it.

## Scoring Dimensions

Score each dimension 1–3. Total determines the approach.

### Dimension 1: File Scope

| Score | Criteria |
|-------|----------|
| 1 | 1–2 files touched |
| 2 | 3–5 files touched |
| 3 | 6+ files, or new module created |

### Dimension 2: Dependency Depth

| Score | Criteria |
|-------|----------|
| 1 | No external deps; isolated change |
| 2 | 1–2 existing modules depended on |
| 3 | Cross-layer dependencies; DB schema; API contract changes |

### Dimension 3: Ambiguity

| Score | Criteria |
|-------|----------|
| 1 | Requirement is explicit; no design decisions needed |
| 2 | 1–2 decision points that need resolution before coding |
| 3 | Architecture-level decisions; unknown patterns; research needed |

### Dimension 4: Test Surface

| Score | Criteria |
|-------|----------|
| 1 | Existing test file; trivial assertion additions |
| 2 | New test file needed; mocking required |
| 3 | Integration tests; DB fixtures; snapshot regeneration |

### Dimension 5: Session Risk

| Score | Criteria |
|-------|----------|
| 1 | Fits in one session; easy to resume |
| 2 | May span sessions; partial state is safe |
| 3 | Long-running; partial state is dangerous; handoff required |

---

## Decision Matrix

| Total Score | Approach |
|-------------|----------|
| 5–7 | Plan Mode (in-head plan, no file needed) |
| 8–10 | Light ExecPlan (phases only, no inline patterns) |
| 11–13 | Full ExecPlan (all fields, inline patterns, phase gates) |
| 14–15 | ExecPlan + parallel research before starting |

---

## Decomposition Rules

When total ≥ 11, decompose into phases:

1. **One phase = one deployable unit** — each phase leaves the codebase in a working state
2. **Max 3 scenarios per phase** — more means the phase is too large; split it
3. **Phase gate before next phase** — build + tests must pass at each boundary
4. **No implicit dependencies between phases** — phase 2 must not assume phase 1 code style; document patterns inline

## Anti-patterns

- Scoring 1 on all dimensions then creating an ExecPlan → overhead without benefit
- Scoring 3 on ambiguity without resolving decisions first → plan will fail
- Skipping phase gates to go faster → regressions compound
