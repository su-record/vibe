# Unlazy comparison and 4.1.27 release decision

Status: proposed scope, not an approved product intent. Product implementation remains at 4.1.26 candidate `96e4ea7a9671f3cc8d3021b47affd61d75cff62d`. No scored model attempt was run for this analysis.

## Decision

Put inspection and execution consent, minimized check evidence, scenario-level handoff, and session-bound non-executing Stop handling in a separate 4.1.27 proposal. Do not change 4.1.26 before its measurement decision. These changes alter approvals, emitted context, failure recovery and when agents run checks: all are experimental inputs, not documentation-only maintenance.

Instruction 11 explicitly permits a 4.1.27 spec draft when release separation is appropriate. This branch implements that deliverable as `intent.md`, `scenarios.yaml`, this comparison and diagnostic evidence. It does not implement the proposed runtime APIs, import the draft into `.vibe`, or claim that the future acceptance checks passed. Existing 4.1.26 source, protocol, release criteria and historical benchmark rows remain unchanged.

## Sources and corrected summary

The inspected [unlazy revision](https://github.com/Leonxlnx/unlazy/tree/16671491f6679ad9378f52604d3bc2415b4120c7) is `16671491f6679ad9378f52604d3bc2415b4120c7`. Its README identifies an untagged 2.1.0 source target. The current skill is 104 lines; `gate-check.mjs` is 960 and `scripts/lib/gates.mjs` is 953. It is no longer accurately described as an 890-line skill. The Node tools have no third-party runtime dependencies; the skill alone is not the enforcement mechanism. [README](https://github.com/Leonxlnx/unlazy/blob/16671491f6679ad9378f52604d3bc2415b4120c7/README.md), [package](https://github.com/Leonxlnx/unlazy/blob/16671491f6679ad9378f52604d3bc2415b4120c7/package.json).

| Candidate | What the source establishes | Current vibe | Decision |
| --- | --- | --- | --- |
| Inspect inherited checks before executing | `--status` avoids runtime resolution and execution. A missing approval produces an execution preview. Approval binds resolved command context in an owner-private store outside the repository. | Intent/source hashes invalidate changed contracts, and `state` displays commands. Execution consent is stored in project state; it is not bound to the destination root or resolved runtime. | Highest priority: distinguish parsing, execution consent and evidence. Extend the existing approval flow once, rather than add an approval for every unchanged run. |
| Persist fingerprints and environment facts | Successful output becomes a digest and byte count. Failure text still appears in a bounded local diagnostic. | `runCheck` returns an eight-line tail for either result; `.vibe/evidence/r-N.json` stores it. The main ledger stores counts and identifiers, not that raw tail. | Adopt versioned structured evidence. Preserve useful diagnostics through an explicit local route. A digest is neither redaction nor proof of correctness. |
| Record inability with a reason | Gate-level `ABANDON` is terminal handoff, never success; unfinished dependent work cannot be promoted. | `vibe abandon --reason`, `ABANDONED`, `abandonedReason` and an `abandon` ledger event already exist for the whole intent. | Extend the existing feature with scenario identity and handoff information. Do not introduce a second abandonment system. |

The unlazy mechanisms are visible in [gate-check](https://github.com/Leonxlnx/unlazy/blob/16671491f6679ad9378f52604d3bc2415b4120c7/scripts/gate-check.mjs#L337), [evidence construction](https://github.com/Leonxlnx/unlazy/blob/16671491f6679ad9378f52604d3bc2415b4120c7/scripts/gate-check.mjs#L812), and [shared gate state](https://github.com/Leonxlnx/unlazy/blob/16671491f6679ad9378f52604d3bc2415b4120c7/scripts/lib/gates.mjs#L445). The skill's treatment of inherited text is an instruction to the agent; it is not a sandbox or a proof that prompt injection is prevented. [SKILL](https://github.com/Leonxlnx/unlazy/blob/16671491f6679ad9378f52604d3bc2415b4120c7/SKILL.md).

## Limits that must survive adoption

Unlazy approval does not hash called scripts, generated files, fixtures or dependencies. Changing those bytes can retain approval when command text and runtime context stay the same. Its automatic evidence digest binds the parsed definition, but a ledger editor can forge such an unkeyed digest. Neither mechanism authenticates a result against an agent with the same operating-system privileges. Its security documentation explicitly describes these limits. [SECURITY](https://github.com/Leonxlnx/unlazy/blob/16671491f6679ad9378f52604d3bc2415b4120c7/SECURITY.md).

For vibe, bind explicitly reviewed check files as well as command definitions. Keep that list separate from the 4.1.26 source basis: customer evidence supports findings, while reviewed verifier files define what may execute. Do not promise automatic transitive dependency discovery for arbitrary shell programs. Report undeclared dependencies, unrelated environment variables and concurrent file replacement as remaining boundaries. Same-user hostile code needs stronger isolation than an approval record.

Full PATH and command arguments can reveal local names or secrets. Show exact values only in the operator's explicit inspection view; durable shared evidence stores hashes and bounded non-sensitive facts. Failure output must not be promoted into a privileged hook instruction. Removing ANSI or bidirectional controls alone does not make arbitrary text trustworthy.

## Three additional findings

1. **Adopt a non-executing, session-bound Stop hook.** Unlazy's hook inspects status; it does not run checks. It resolves a session pipeline, limits repeated no-progress blocks and emits bounded identifiers rather than free-form abandonment reasons. Vibe's `hooks/notify.js:148` invokes `check --all` from the session root. This conversation twice demonstrated checks running in the intent-only checkout while implementation checks passed elsewhere. Avoid automatic execution and require an explicit worktree binding; stale or ambiguous binding should produce a diagnostic, not select another checkout. [Stop source](https://github.com/Leonxlnx/unlazy/blob/16671491f6679ad9378f52604d3bc2415b4120c7/scripts/stop-hook.mjs).
2. **Keep oracle linting advisory; defer it from this release.** Unlazy flags lexical signs such as fixed-output commands and weak expectations. It does not prove that an English outcome matches a command. Vibe's new work-opportunities task already checks whether proposed checks distinguish valid and defective implementations. Preserve that stronger task-specific evidence; a future authoring lint can suggest improvements without turning word patterns into mandatory semantic judgments. [Linter](https://github.com/Leonxlnx/unlazy/blob/16671491f6679ad9378f52604d3bc2415b4120c7/scripts/gate-lint.mjs).
3. **Investigate child-process supervision separately.** Unlazy has a supervisor, byte limits and platform-specific descendant cleanup. Vibe currently kills the immediate child on timeout and caps accumulated JavaScript string length, not an exact byte stream. Source inspection establishes that implementation difference; this analysis did not reproduce a surviving descendant or audit Windows cleanup. Bound evidence capture in 4.1.27, but do not promise complete process containment without a separate design and platform tests. [Supervisor](https://github.com/Leonxlnx/unlazy/blob/16671491f6679ad9378f52604d3bc2415b4120c7/scripts/lib/check-supervisor.mjs), [process tree](https://github.com/Leonxlnx/unlazy/blob/16671491f6679ad9378f52604d3bc2415b4120c7/scripts/lib/process-tree.mjs).

Do not import the whole skill, require a fixed-depth tree, multiply the task budget per leaf, or add a second orchestration/lease hierarchy. None of those changes has demonstrated an advantage for vibe's front-half quality/cost target. Preserve request-to-outcome reconciliation and independent verification through the existing intent and scenario graph.

## Direct observations in vibe

The diagnostic ran through `vibe check --all` in an isolated analysis project, with temporary homes and harmless marker files. It did not execute unlazy checks, install either product, access external accounts, or alter the candidate. The diagnostic's pass means the observations were reproduced, not that these behaviors are secure or that 4.1.27 is implemented. See [recorded facts](evidence/current-behavior.json).

| Observation | Result | Source |
| --- | --- | --- |
| Copy an approved `.vibe` from fixture A to B, then call `check --all` in B without a destination approval | The fixture-local marker executes. | `src/core/check.ts:250` checks contract/source hashes; `src/core/intent.ts:74` records approval in project state. |
| Print a synthetic canary from a successful check | The canary appears in `.vibe/evidence/r-N.json`. | `src/core/checks/run.ts:34`, `src/core/check.ts:296`. |
| Invoke `abandon --reason` | State is `ABANDONED`, reason is retained, and the last ledger event is `abandon`; prior results remain available. | `src/core/intent.ts:101`, `src/core/state.ts`, `src/cli/work.ts:164`. |

The corresponding absolute execution artifact is `/home/ubuntu/sutory/work/vibe-unlazy-20260910/probes/check.json`; the exact source of the diagnostic is [current-contract.cjs](evidence/current-contract.cjs). It pins the inspected local CLI path and must be reviewed before adapting that path elsewhere. Large external files were read through the configured `vibe read` helper and the decisive source excerpts were inspected directly. That source-reading call is separate from the still-unstarted 60-attempt release cohort.

## Delivery and validation boundary

Five proposed acceptance scenarios cover execution consent, evidence minimization, honest handoff, Stop routing, and compatibility. Their commands and test files are an implementation contract, not files that already exist. Validate the draft's YAML/graph and links now; write those deterministic checks before implementing the runtime after the scope is approved. Run Linux and Windows checks on the eventual candidate, with no paid benchmark added implicitly.

No unlazy code is copied into the product. Its repository is MIT licensed; if later implementation copies code or substantial licensed text, retain the required attribution. This analysis makes no claim of measured prevention, reduced tokens, secure sandboxing, or equivalent Windows behavior.
