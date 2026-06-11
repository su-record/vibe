# Ralph Loop — Full Reference

> Loaded by vibe.run SKILL.md when Ralph Loop or ULTRAWORK is active (coverage verification).

## Ralph Loop (Completion Verification)

> **Inspired by [ghuntley.com/ralph](https://ghuntley.com/ralph)**: "Deterministically bad in an undeterministic world" — Keep iterating until TRULY complete.

**Problem**: AI often claims "complete" when implementation is partial.

**Solution**: RTM-based automated coverage verification with iteration tracking.

```
┌─────────────────────────────────────────────────────────────────┐
│                    RALPH LOOP (Mandatory)                        │
│                                                                  │
│   After ALL phases complete:                                     │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  RTM COVERAGE VERIFICATION [Iteration {{ITER}}/{{MAX}}]   │  │
│   │                                                           │  │
│   │  Generate RTM via core tools:                             │  │
│   │  → generateTraceabilityMatrix("{feature-name}")           │  │
│   │                                                           │  │
│   │  Coverage Metrics (automated):                            │  │
│   │  □ Requirements coverage: {coveragePercent}%              │  │
│   │  □ SPEC → Feature mapping: {featureCovered}/{total}       │  │
│   │  □ Feature → Test mapping: {testCovered}/{total}          │  │
│   │  □ Build successful?                                      │  │
│   │  □ Tests passing?                                         │  │
│   │                                                           │  │
│   │  UNCOVERED: {uncoveredRequirements[]}                     │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                   ┌──────────┴──────────┐                       │
│                   │  Coverage == 100%?  │                       │
│                   └──────────┬──────────┘                       │
│                       │              │                          │
│                      NO            YES                          │
│                       │              │                          │
│                       ↓              ↓                          │
│              ┌────────────────┐  ┌────────────────┐             │
│              │ IMPLEMENT      │  │ TRULY DONE     │             │
│              │ UNCOVERED      │  │                │             │
│              │ REQUIREMENTS   │  │ Report final   │             │
│              │ (auto-extract) │  │ RTM coverage   │             │
│              └───────┬────────┘  └────────────────┘             │
│                      │                                          │
│                      └──────────→ [Re-generate RTM]             │
│                                                                  │
│                      │                                          │
│                      ↓                                          │
│              Stuck? (coverage unchanged from prev iteration)    │
│                      │                                          │
│                      ├─ Interactive: Ask user                   │
│                      │     1. Provide resolution → retry        │
│                      │     2. "proceed" → TODO + done           │
│                      │     3. "abort" → stop                    │
│                      └─ ultrawork: TODO + done                  │
│                                                                  │
│   NO iteration cap — loop until 100% OR stuck                   │
│   ZERO TOLERANCE for silent scope reduction                     │
└─────────────────────────────────────────────────────────────────┘
```

## RTM Invocation

```bash
# Generate RTM for coverage verification (generateTraceabilityMatrix is synchronous — no .then())
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => { const r = t.generateTraceabilityMatrix('{feature-name}', {projectPath: process.cwd()}); console.log(JSON.stringify(r, null, 2)); })"
```

> **Note:** Default SPEC path is `.vibe/specs/<feature>.md` (falls back to `.claude/vibe/specs/` then `.claude/specs/` for legacy projects).
> `status === 'empty'` means the gate MUST be treated as failed/not-applicable, never as 100% pass.

## RTM Metrics

| Metric | Description |
|--------|-------------|
| `totalRequirements` | Total REQ-* items in SPEC |
| `specCovered` | Requirements with SPEC mapping |
| `featureCovered` | Requirements with Feature scenarios |
| `testCovered` | Requirements with test files |
| `coveragePercent` | Overall coverage percentage |
| `uncoveredRequirements` | List of missing REQ-* IDs |

## Ralph Loop Rules

| Rule | Description |
|------|-------------|
| **No Scope Reduction** | Never say "simplified" or "basic version" — implement FULL request |
| **Iteration Tracking** | Display `[{{ITER}}]` to show progress (no max — loop until done) |
| **RTM-Based Gap List** | Use `uncoveredRequirements` array — no manual comparison |
| **Coverage Threshold** | Must reach 100% coverage to complete |
| **No Iteration Cap** | Loop until 100% coverage OR stuck (convergence detected) |
| **Stuck Handling** | If coverage % unchanged between iterations → ask user (proceed/abort/fix), or ultrawork → TODO + done |
| **Diminishing Returns** | Iteration 3+ → focus on core requirements (REQ-*-001~003) first; P2/P3 continue but lower priority |

## Ralph Loop Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RALPH VERIFICATION [Iteration 1]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RTM Coverage Report: login

Requirements Traceability:
  Total Requirements: 9
  SPEC Covered: 9/9 (100%)
  Feature Covered: 5/9 (55%)
  Test Covered: 4/9 (44%)

  REQ-login-001: Login form UI → Scenario 1 → login.test.ts
  REQ-login-002: Email validation → Scenario 2 → validation.test.ts
  REQ-login-003: Password validation → Scenario 2 → validation.test.ts
  REQ-login-004: Remember me checkbox → NOT IMPLEMENTED
  REQ-login-005: Forgot password link → NOT IMPLEMENTED
  REQ-login-006: API integration → Scenario 3 → api.test.ts
  REQ-login-007: Loading state → NOT IMPLEMENTED
  REQ-login-008: Error toast → NOT IMPLEMENTED
  REQ-login-009: Session storage → Scenario 4 → (no test)

Overall Coverage: 55% BELOW 100% TARGET

UNCOVERED REQUIREMENTS (auto-extracted from RTM):
  1. REQ-login-004: Remember me checkbox
  2. REQ-login-005: Forgot password link
  3. REQ-login-007: Loading state
  4. REQ-login-008: Error toast notifications

NOT COMPLETE — Implementing uncovered requirements...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RALPH VERIFICATION [Iteration 2]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RTM Coverage Report: login

Requirements Traceability:
  Total Requirements: 9
  SPEC Covered: 9/9 (100%)
  Feature Covered: 9/9 (100%)
  Test Covered: 9/9 (100%)

Overall Coverage: 100% TARGET REACHED

Build: Passed
Tests: 12/12 Passed
Type Check: No errors

RALPH VERIFIED COMPLETE!

RTM saved: .vibe/rtm/login-rtm.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## When to Trigger Ralph Loop

1. After all phases complete
2. Before final quality report
3. Whenever user says "ultrawork" or "ralph"

## Forbidden Responses (VIOLATIONS)

| NEVER Say | Instead |
|-----------|---------|
| "I've implemented a basic version" | Implement the FULL version |
| "This is a simplified approach" | Implement as specified |
| "You can add X later" | Add X now |
| "For demonstration purposes" | Implement production-ready |
| "The core functionality is done" | ALL functionality must be done |
