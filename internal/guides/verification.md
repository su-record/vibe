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

For generated files that must remain available, a scenario may declare `artifacts: [dist/result.json]` alongside its substantive `check`. After a passing check, the engine records each file's byte count and SHA-256 in the existing evidence. Missing or unreadable files fail that check; changed or deleted files invalidate its reusable pass and DONE. This includes Git-ignored outputs. The fingerprint establishes byte identity, not semantic correctness: inspect the real output or test its behavior. No artifact declaration means no additional output scanning.

Paths are project-relative regular files, with no traversal or symlinks, outside `.git` and `.vibe`: 1–16 entries, at most 16 MiB per file and 64 MiB total. For large media, use a substantive check that opens and validates the actual media plus a small result manifest; hashing a manifest alone cannot establish that the media still exists. External acceptance and files changing after inspection remain outside a point-in-time local verdict.

## Select and resume without repeating work

For an existing tracked task, use `vibe internal verification [ids] [--all] --json` when deciding what to run or resuming after interruption. It shares the executor's selection rules and reads current evidence without checking, reserving a run or changing state. Read its blockers before using any reusable result. Default `vibe check` runs checks without a fresh pass; explicit ids rerun those checks and include prerequisites without a fresh pass; `--all` explicitly reruns everything. Checks outside an explicit selection remain required for completion. A preview is not execution permission or a DONE verdict; execution revalidates the contract, consent and risks.

Keep existing repository-required gates. During development, select the smallest meaningful check that covers the change; before integration, satisfy required broader checks. Reuse evidence only within its known inputs and environment. Vibe currently invalidates passes conservatively when the source tree changes; do not infer narrower dependency coverage from filenames alone. Remote service state, environment changes and undeclared ignored inputs are not fingerprinted by that rule: explicitly rerun affected checks. Do not add an automatic full-suite run to Stop or every edit.

On resumption, confirm the saved objective belongs to the current request, inspect reusable evidence and outstanding work, then continue at the first unresolved dependency. Check an external job by its saved ID before resubmitting it. If the evidence is missing, stale or cannot establish the target environment's behavior, report that limit instead of repeating completed work merely to reconstruct a narrative.
