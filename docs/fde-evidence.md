# Evidence and economical execution

This change applies the accepted repository research to the existing personal FDE. The public entry remains `vibe`; game-specific extensions are excluded. No second execution service, approval store, reviewer chain or mandatory feasibility stage is introduced.

## What changed

- An on-demand feasibility guide distinguishes documented support, observed behavior and inference. It uses the smallest real boundary experiment and distinguishes blocked, invalid and inconclusive experiments from refutation.
- Verification can bind a passing scenario to concrete output files through optional `artifacts`. Existing results and immutable run evidence store their byte counts and SHA-256 values. Deleted, unreadable or changed outputs prevent reuse and completion, including outputs ignored by Git. Missing output after process success produces `artifact-unavailable`, preserving the actual process exit code.
- The scheduler checks prerequisite output freshness before downstream execution and checks output freshness again before completion. A file fingerprint proves identity at inspection time, not correctness, external acceptance or immunity to concurrent writes.
- Personal Stop returns without parsing input or evaluating session state. Explicit legacy Stop behavior remains available. This removes unused project fingerprint work; it is not a diagnosis of an untraced desktop “Hook failed” incident.
- Delivery guidance asks for observation at the point of use and concise evidence-backed failure notes. Optimization guidance reuses provider job IDs, distinguishes download from regeneration, bounds retries and records unknown cost honestly. Handoff instructions are prepared only when work must move to another executor.

## Cost and compatibility

Ordinary scenarios need no artifact declaration and read no additional output files. Declared files are limited to 16 entries, 16 MiB per file and 64 MiB per capture. Paths must be project-relative regular files without traversal or symlinks, outside `.git` and `.vibe`. Large output validation belongs in a substantive existing check; a small manifest alone does not prove the referenced output still exists.

There are no new default model calls, public skills or branches. Feasibility guidance is read only when relevant through the existing CLI/MCP guide operation. Existing approval, source freshness and risk requirements remain in force. Installed host caches are unchanged by local implementation. Package and plugin versions are prepared as 4.2.2 for release.

## Verification and limits

Automated fixtures cover process success with missing output, blocked dependent execution, ignored output deletion and same-length modification, immutable past evidence, later output corruption before completion, bounded artifact reads and personal Stop with a session evaluator that throws if called. Existing tests cover undeclared ordinary checks and legacy hook behavior. Guide routing and package surface checks establish local availability without a model call.

These tests do not establish better model judgment, end-to-end token savings or desktop GUI reliability. External job recovery is operating guidance: without a provider adapter, Vibe cannot mechanically prevent duplicate remote submissions. Representative real-use evaluation should separately measure whether the agent distinguishes preparation from execution, blocked access from unsupported capability, and a reproduced hypothesis from a confirmed incident cause.

## Research basis

Original implementation and wording draw on the analysis of [godogen](https://github.com/htdt/godogen/tree/05cebffc8b10c5817e8a3db495b82e7b6004ab84) and [technical-feasibility-skills](https://github.com/rkttu/technical-feasibility-skills/tree/a26ef3a3799efd7d78a34e22c121fdb8fe34eabd). Borrowed principles are actual-output verification, bounded experiments, evidence scope and economical reuse. Their engines and report schemas are not copied into Vibe.

Local validation on 2026-09-14: the build and complete suite passed (69 files, 386 tests). Subsequent output-dependency fixes passed the rebuilt targeted suite (37 tests), including changed producer output with a previously successful consumer. Additional checks passed for package contents and the single public entry, plugin manifest consistency, card/skill/source size limits, reviewer packs, public benchmark contracts, discovery, work opportunities, release compatibility, execution trust, evidence privacy, handoff and Stop behavior. No live model, paid generation, publication or desktop GUI evaluation ran.

Windows hook follow-up: home hook detection previously recognized only `hooks/notify.js`, while Windows installation paths could contain `hooks\notify.js`. Detection and removal now normalize separators, generated home commands use forward slashes, and plugin duplicate suppression parses hook commands rather than searching raw JSON. Migration preserves unrelated commands even within the same hook entry. Build and 29 focused installation/hook tests passed with Windows path fixtures, including spaces and Korean text. This Linux-host validation does not establish actual Windows desktop execution or the cause of the user's untraced hook error; the correction was not deployed during that validation.

4.2.2 release preparation: build and the complete local suite passed (70 files, 396 tests), together with package contents, plugin consistency and size checks. Release publication additionally waits for Linux and Windows CI.
