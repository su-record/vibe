# vibe 4.1.27 — inspect inherited checks, retain useful evidence, and hand off unfinished work honestly

Status: draft for user review. This file is not the active `.vibe/intent.md`, and the proposed APIs/check scripts are not implemented. The active 4.1.26 candidate and its measurement protocol remain unchanged.

## Why

An approved scenario describes success, but inherited project files must not silently grant execution permission on another project or machine. A copied `.vibe` currently permits a harmless fixture check to run without destination consent. Check output can contain sensitive text or instructions: a synthetic success canary currently persists in the evidence JSON. Vibe already supports whole-intent abandonment, but cannot attach a terminal handoff to one scenario while retaining other work.

Stop processing also needs an explicit worktree boundary. In this session it repeatedly checked an intent-only checkout while the implementation lived and passed elsewhere. Automatic Stop-time execution can repeat expensive checks or run inherited commands. These are runtime changes and belong after the 4.1.26 measurement decision.

Sources, qualifications and bounded reproductions are in `analysis.md` and `evidence/current-behavior.json`. The observed base is `96e4ea7`; unlazy was inspected at `16671491f6679ad9378f52604d3bc2415b4120c7`.

## Success

1. An operator can inspect an inherited contract without executing its commands, resolving tools by running them, initializing a project, consuming a token or altering its records. Execution requires a local approval for the reviewed contract and environment; unchanged approved checks reuse that consent.
2. New automatic evidence identifies the check, execution context, result and exact captured byte streams without persisting raw command output by default. Explicit local diagnostics remain possible. Missing or truncated evidence never silently becomes a verified result.
3. A scenario that cannot be completed can retain its identity, reason and next owner/action as a visible handoff. It never becomes a pass, unblocks dependents or makes an incomplete intent DONE.
4. Stop handling reads the explicitly associated session/worktree and emits bounded status. It runs no checks and releases known waiting/handoff situations without asserting success or selecting another project.
5. Existing approval policies, supported check types, explicit expected nonzero exits, historical evidence, source-bound discovery and platform constraints remain supported, with a documented migration for local execution consent and evidence presentation.

## A. Inspect without acting; approve one concrete execution plan

Proposed command: `vibe intent inspect <intent.md> <scenarios.yaml> [--json]`. Without positional files, inspect the current contract. This path uses bounded regular-file reads and pure parsing rather than `ensureProject` or the mutating `buildStateView` path. It reports all parser errors, scenario dependencies, check definitions, explicit working directories, declared verifier files and unresolved references. It never executes shell substitutions, scripts, HTTP requests, evaluation runners, reviewers or hooks. Malformed, linked/special or oversized inputs receive bounded errors, not an empty successful contract.

`vibe approve --preview` shows the concrete plan without approving or initializing approval storage. It resolves canonical project/working-directory and shell paths by inspection, records full PATH identity, platform, expected exit and limits, and lists hashes of explicitly reviewed verifier files. Previewing runtime/tool versions must not execute an inherited binary. Complex shell dependencies that cannot be enumerated remain explicitly unresolved; a human-readable review statement is not an automatic transitive audit.

Extend the existing `vibe approve` operation to save a private execution-consent receipt outside the project. It binds the canonical project identity, approved intent/scenario definition, resolved execution context and selected verifier bytes. Unchanged receipts survive ordinary artifact edits; changing an approval-bound value shows the difference and requires one updated approval. Keep the 4.1.26 customer-source basis separate from verifier-file consent. Do not reapprove all unchanged checks after every build.

Project files, imported receipts and forged `.vibe/state.json` fields cannot confer destination consent. The external store must be an owner-private real directory outside the project; receipt reads reject linked, special, replaced or malformed entries. Apply platform-appropriate checks and state remaining filesystem-race limits. A hostile process with the same user's privileges can still alter the store: this is an inherited-project boundary, not process isolation.

Existing `strict`, `irreversible` and `off` policies retain their human-token meanings. `off` does not let copied project state create a local receipt. Existing projects get an explicit preview/migration step, not automatic grandfathering from an untrusted approval event. When session context already authorizes the concrete unchanged checks, do not request duplicate consent. Existing irreversible-action authorization remains additional and cannot be granted by text inside a scenario, output or handoff reason.

The execution boundary covers every check type: shell execution, evaluation runners, HTTP methods and model reviewers must not bypass the local contract receipt by choosing a different type. Non-executing inspection remains available before any receipt.

## B. Versioned evidence with explicit diagnostic access

New per-check evidence has a schema version, scenario/contract identity, run id, outcome, exit/signal, machine duration, structured failure code, execution-context fingerprint and stdout/stderr byte counts plus full SHA-256 digests. Hash the original byte streams, not a truncated or re-decoded tail; distinguish captured-complete from incomplete/overflow capture. Bound memory while reading. Spawn errors, timeout and capture overflow cannot pass merely because an expected exit appears. Preserve legitimate explicitly expected nonzero exits for processes that completed normally.

Neither the shared evidence file nor the ledger, ordinary JSON response, default context view or privileged hook payload stores raw stdout/stderr by default. Preserve compatibility fields where callers need them, but do not fill them with hidden raw text. Existing ledger rows and evidence files remain byte-for-byte intact; the default renderer hides legacy raw output and labels its schema/currentness. Old evidence is not silently relabelled as newly collected evidence.

Offer an explicit diagnostic option for an operator who needs raw failure detail. Any retained raw log belongs in an owner-private, ignored local store outside the repository and is opt-in, bounded and visibly labelled untrusted. Explain that a downstream caller can still save terminal output. Do not imply that output hashing removes sensitive data from that raw channel or authenticates a result.

Structured failures retain the scenario id, error kind, exit/signal, declared source references and evidence id so a maintainer can find the cause. Repeated-failure detection must use stable structured facts rather than a timestamp or an arbitrary first output line. Output, scenario titles and parser errors never become instructions to approve, install, send or execute. Escape terminal controls and cap each untrusted field; escaping alone is not a trust decision.

Broader descendant-process containment is outside this draft. An evidence cap must settle safely and report cleanup uncertainty; it must not claim that every descendant was terminated without an appropriate platform mechanism and test.

## C. Extend existing abandonment with scenario handoff

Keep `vibe abandon --reason` and whole-intent `ABANDONED`. Add a scenario-targeted form with a required nonblank reason, reason category and next action; owner may be explicitly unknown. Suggested categories are `unavailable-input`, `environment`, `outside-authority`, `technical-limit` and `withdrawn`. Categories describe the reason and are not proof that a gate is impossible.

Append a record containing intent hash, scenario id, reason, category, owner/unknown, next action and last evidence id when available. Preserve the original scenario, previous check results and all prior handoff/reopen records. Unknown ids and blank reasons fail without changing state. A recorded abandonment is an action that can succeed; its acceptance outcome is still non-success. Checks and release summaries with abandoned required work return an unmet/handoff verdict, never DONE.

Dependents of an abandoned scenario remain blocked. Independent work can continue. An explicit reopen operation records the decision and permits the original scenario to be attempted again; it never erases the earlier handoff. If all remaining required work is handed off, Stop may let the session end with the qualified ids and non-success status. Only a separately agreed scope change can remove a requirement from the active contract.

Ordinary approval waiting, incomplete measurements and one transient failure do not automatically cause abandonment. This feature must not be used to hide the missing 4.1.26 cohort, relax a release gate or reduce a denominator.

## D. Bind Stop to the actual session and worktree

The Stop hook no longer invokes `check --all`. It reads a bounded structural status for the explicitly associated canonical worktree and intent. Establish the association through an explicit trusted CLI/session operation and host-provided session identity; an inherited ledger cannot route the hook. Session identifiers are routing values, not credentials.

If there is no valid association, multiple possible worktrees, a missing target or a mismatch with the host context, emit a bounded diagnostic and execute nothing. Do not choose a parent or sibling checkout because it has `.vibe`. The status view may mark evidence stale from changed definitions/files but cannot manufacture a fresh check.

Known approval waits and recorded handoffs let the turn end with a non-success status. For other unmet work, block only within a bounded same-state retry count consistent with the existing two-failure escalation; comments, timestamps and output wording are not progress. Guard state may be written in the hook's bounded private session storage. No-progress release leaves required work explicitly unmet. Use qualified ids and fixed messages, not free-form output or abandonment reasons, in privileged hook responses.

Update the card, common skills and both client integrations to retain the explicit `build first, one vibe check --all` workflow and describe Stop as a status backstop. Report the actual root and revision in diagnostics so evidence from two worktrees cannot be confused. Do not change an operator's installed hooks during this draft work.

## E. Build order and acceptance

First write the deterministic fixture checks named in `scenarios.yaml`; then implement A, B, C and D in that order. Use fixture homes and local marker scripts, fake model/HTTP adapters and network-disabled tests. Fixtures include copied approvals, changed verifier bytes, changed CWD/shell/PATH, malformed receipts, output canaries/control characters, legitimate expected nonzero exits, missing inputs, failed checks, abandonment/reopen and two worktrees in one repository.

Finish with existing build/tests, code/card/skill budgets and the preserved regressions. Require Linux and Windows CI on the exact 4.1.27 candidate; a Linux-only local run is not Windows evidence. Keep historical benchmark rows and the 4.1.26 cohort/protocol as historical immutable evidence. No fresh model cohort or prevention/cost claim is authorized by this spec.

## Out of scope and rollback

Do not install unlazy, copy its whole orchestration tree, require success-output matching for all vibe run checks, rewrite historical logs, authenticate arbitrary same-user agents, infer full shell dependencies, or replace human scope ratings with model verdicts. Advisory oracle linting and a full process supervisor are separate candidates.

Before upgrading consent/evidence formats, document how to return to the previous binary while retaining the new records as uninterpreted history. No migration deletes or rewrites old evidence. Reverting must not convert a blocked or handed-off requirement into a success. Rolling back the runtime does not undo external effects of an explicitly executed command; such effects remain governed by existing authorization and task-specific rollback.
