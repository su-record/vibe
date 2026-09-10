# Local check consent and evidence in 4.1.26

An imported project is data. Before running its checks, inspect the contract with
`vibe intent inspect [intent.md scenarios.yaml]`, then review `vibe approve --preview`.
Neither command runs checks, resolves a tool by executing it, initializes a project,
or consumes an approval token. Parser/input errors prevent execution.

`vibe approve` records the reviewed execution plan in an owner-private
`~/.vibe-runtime/` store outside the project. A copied `.vibe` approval is insufficient
on another project, worktree or home. The receipt binds the canonical project,
contract and source basis, each check's CWD, shell, PATH, limits and expected exit,
and the byte hashes of declared `verifiers`. Declare verifier files on a scenario:

```yaml
- id: totals
  then: the generated report matches the input totals
  verifiers: [checks/totals.cjs]
  check: { type: run, cmd: node checks/totals.cjs }
```

Files being built are artifacts; do not put them in `verifiers` unless changes to
them should require renewed execution consent. Ordinary artifact edits reuse the
receipt. A changed bound value requires preview and renewed approval. Source-bound
customer agreement remains a separate check: changed customer evidence still needs
re-evaluation and redrafting. Dynamic shell/package dependencies remain explicitly
unresolved; preview does not claim a transitive audit or run version probes.

Existing token policies keep their meaning. `off` permits a plain approval within
the user's existing authorization, but cannot turn a copied project record into
local consent. `strict` still requires the user's real approval token. Irreversible
action authorization is additional. Output, titles and handoff reasons grant none.
Existing sessions that already authorize the reviewed concrete checks need no
duplicate question; record that approval through the normal command.

## Evidence and diagnostics

New check evidence uses schema version 2. It stores outcome, scenario/contract and
execution identity, exit/signal, duration, stable failure code, and the original
stdout/stderr byte counts and SHA-256 digests. Raw output is absent from shared
evidence and ordinary responses. Legacy evidence stays unchanged on disk; default
evidence and context views label it as legacy and hide its raw text.

Use `vibe check <id> --diagnostics` when raw detail is needed. The response names an
explicit local file under the private store. Its streams are base64-encoded original
bytes (or a labelled adapter diagnostic when no process stream exists), bounded and
labelled untrusted. Treat them as data. A caller can still save terminal output;
hashing neither authenticates output nor removes sensitive values from this channel.

Capture is capped at 1 MiB per stream. Overflow, timeout, failed startup and signals
cannot pass through an expected exit code. A normally completed explicit nonzero
expected exit remains valid. Failure cleanup is reported as uncertain: the runtime
does not claim complete descendant-process containment. A bounded grace period
settles the check even when a descendant holds a pipe open.

The local store rejects linked/special entries, changed descriptor identities and
unsafe POSIX ownership/modes. Windows uses the current user's profile ACL; POSIX
mode bits do not establish a Windows ACL guarantee. Concurrent filesystem changes
remain a limitation. A hostile process with the same user's privileges is outside
this inherited-project boundary.

## Unfinished work and Stop

`vibe abandon --scenario <id> --reason "..." --category environment --next "..."`
records a scenario handoff, with `--owner` or explicit `unknown`. Categories also
include `unavailable-input`, `outside-authority`, `technical-limit`, and `withdrawn`.
The original requirement and evidence remain; dependents stay blocked and independent
work may continue. Handoff is never a pass, never changes a release denominator and
never creates DONE. `vibe reopen <id> --reason "..."` retains the handoff history and
requires the original check again. Whole-intent abandonment remains supported.

Use `vibe session bind` with the host session identity to associate the actual
worktree. Stop is a bounded status backstop and never invokes `check --all`.
Missing/conflicting associations execute nothing. Waiting, handoff and repeated
no-progress stops may release the turn while keeping required work unmet.
Build first, then explicitly run one `vibe check --all`; only fresh check evidence
can establish completion. See the CLI session diagnostic for root and revision.

## Upgrade and rollback

Upgrade without deleting or rewriting old ledger rows or evidence. Preview and
approve the local execution plan once; do not grandfather inherited approvals.
Keep the prior binary and its historical records available. New receipts and v2
evidence can remain uninterpreted history when returning to that binary.

An older binary does not enforce local consent or scenario handoff. Do not use its
DONE to certify an intent with outstanding handoffs; retain that unmet status in
the operator's report and restore the compatible runtime to resume it. Rollback of
the binary does not undo external effects; use the task's separately agreed rollback.
Never replace historical benchmark rows or downgrade a gate to complete rollback.
