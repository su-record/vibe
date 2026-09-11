# Required verification for consequential work

Before implementation, identify data loss/migration, authentication or permission changes, public-interface compatibility, deployment and multi-system failure risks from the request and actual code. These require a tracked intent and risk-bearing scenario. Do not treat an unlabeled scenario as evidence of low risk. Run `vibe internal risks --json` to see deterministic signals, uncovered paths/actions and existing checks to reuse. The check engine enforces coverage even when a risk declaration is omitted. Rules cover known sensitive paths and mutating commands; they cannot infer every domain risk or judge arbitrary test quality.

For each affected outcome, add a `risk` object to its scenario. `kind` is data, access, interface, deployment or integration. Describe who/what is affected in `impact`, and the concrete recovery or containment procedure in `recovery`. Bind `failureChecks` and `recoveryChecks` to scenario ids. Use a representative local fixture, denied request, compatibility test, interrupted operation or recovery drill. For an action with no undo, verify prevention and containment and say that rollback is unavailable.

```yaml
- id: denied-request
  then: an unauthorized request cannot change the record
  verifiers: [tests/access.test.js]
  check: {type: run, cmd: node --test tests/access.test.js}
- id: safe-retry
  then: interruption followed by retry preserves the original data
  verifiers: [tests/retry.test.js]
  check: {type: run, cmd: node --test tests/retry.test.js}
- id: update-record
  then: an authorized update changes only the intended record
  risk:
    kind: access
    paths: [src/auth]
    impact: Incorrect authorization could modify another customer's record.
    recovery: Disable the update route and recover affected records from the verified snapshot.
    failureChecks: [denied-request]
    recoveryChecks: [safe-retry]
  verifiers: [tests/update.test.js]
  check: {type: run, cmd: node --test tests/update.test.js}
```

The parser makes the bound checks prerequisites. Missing references, cycles, human/model-only checks, existence-only assertions and irreversible prerequisite actions are rejected. Executable prerequisite checks require explicit verifier files so their bytes are included in execution consent. One substantive check may cover both failure and recovery; do not split it to satisfy a quota.

Draft and approve using existing chat authority; strict policies remain opt-in. `check update-record` pulls in unpassed prerequisites. A failed or stale prerequisite prevents the dependent from running; required work cannot become DONE by handing it off. Keep existing conservative invalidation. Changing the approved contract or verifier bytes requires renewed inspection through the existing approval path, not a second gate.

Test quality remains a judgment: a command that always exits successfully does not prove the stated behavior. Inspect meaningful assertions. Use a focused independent review when requested or when a consequential design uncertainty remains, not as a universal model-review chain. The machine verdict applies only to the recorded contract; do not claim it proves external acceptance or undiscovered risks.

Automatic signals are checked before adapters run and again before recording completion. Git diffs use the task baseline, including subsequent commits, deletions, renames and untracked files. With no baseline or Git, all available paths are inspected conservatively. `.vibe/risk-rules.json` may add rules such as `[{"prefix":"services/billing","kind":"integration"}]`; it cannot disable built-in rules. Rule changes invalidate execution consent. `risk.paths` binds a declaration to exact files or directory prefixes, and command signals require a matching risk on that command scenario. Connect existing substantive checks rather than creating duplicate checks. A signal has no manual suppression flag.
