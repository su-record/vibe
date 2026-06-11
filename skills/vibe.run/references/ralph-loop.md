# Ralph Loop — Coverage Verification Reference

> Loaded by vibe.run SKILL.md for RTM/coverage verification. **루프 시맨틱(ANCHOR/ACT/JUDGE/RECORD/stuck/max_iterations)의 SSOT는 `vibe/rules/loop-contract.md`다.** 이 파일은 vibe.run-specific한 RTM 기반 커버리지 검증 메커니즘을 문서화한다.
>
> `ralph`는 loop-contract의 deprecated 별칭으로, "exit: coverage-100"이 설정된 기본 루프와 동일하다. 더 이상 별도 모드가 아니다.

## Coverage Verification Loop

> **Inspired by [ghuntley.com/ralph](https://ghuntley.com/ralph)**: "Deterministically bad in an undeterministic world" — Keep iterating until TRULY complete.

**Problem**: AI often claims "complete" when implementation is partial.

**Solution**: RTM-based automated coverage verification — loop-contract의 JUDGE 기준은 `coveragePercent === 100`.

```
┌─────────────────────────────────────────────────────────────────┐
│           COVERAGE VERIFICATION LOOP (loop-contract + RTM)      │
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
│       stuck? (loop-ledger.js check-stuck: 연속 2회 동일 커버리지) │
│                      │                                          │
│                      ├─ automationLevel confirm: Ask user       │
│                      │     1. Provide resolution → retry        │
│                      │     2. "proceed" → TODO + done           │
│                      │     3. "abort" → stop                    │
│                      └─ automationLevel autonomous: TODO + done │
│                                                                  │
│   max_iterations 기본 10 — 도달 시 잔여 인박스 이월             │
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

## Coverage Loop Rules

| Rule | Description |
|------|-------------|
| **No Scope Reduction** | Never say "simplified" or "basic version" — implement FULL request |
| **Iteration Tracking** | Display `[{{ITER}}]` to show progress; max_iterations 기본 10 |
| **RTM-Based Gap List** | Use `uncoveredRequirements` array — no manual comparison |
| **Coverage Threshold** | JUDGE: `coveragePercent === 100` → exit (loop-contract exit=coverage-100) |
| **Stuck Handling** | `loop-ledger.js check-stuck`: 연속 2회 동일 커버리지 → confirm이면 질문; autonomous이면 TODO + done |
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

## When to Trigger Coverage Loop

1. After all phases complete (기본 동작 — 별도 키워드 불필요)
2. Before final quality report
3. `ralph` 별칭 감지 시 — 기본 동작과 동일, exit=coverage-100으로 해석

## Forbidden Responses (VIOLATIONS)

| NEVER Say | Instead |
|-----------|---------|
| "I've implemented a basic version" | Implement the FULL version |
| "This is a simplified approach" | Implement as specified |
| "You can add X later" | Add X now |
| "For demonstration purposes" | Implement production-ready |
| "The core functionality is done" | ALL functionality must be done |
