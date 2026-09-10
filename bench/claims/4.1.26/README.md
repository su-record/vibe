# 4.1.26 discovery protocol and evidence

Implementation approval does not authorize the paid cohort. Claude obtains the user's separate confirmation after deterministic checks and a reviewable protocol are ready. No 4.1.25 row or claim record is a baseline for this experiment.

## Before scored execution

1. Finish and check the candidate; record its commit. Run Linux and Windows CI for that exact commit and record the successful observations in `ci.jsonl` before starting the cohort. CI runs `node checks/check-trust-compatibility.js --self-test`, which uses only its own fixtures; it must never wait for its own external CI record. After CI finishes, the default `node checks/check-trust-compatibility.js` checks actual `ci.jsonl` against HEAD and verifies the migration/rollback document. Prepare a clean checkout at `2d2af57` and build 4.1.25 there. Both arms need their own `dist/`, card, hooks and skills. Baseline discovery behavior must stay unchanged.
2. Run `node bench/fde-run.js --draft --protocol <new-protocol.json>` to read configured model/effort fields from environment or client settings. This calls no model. The approved settings are Claude `claude-opus-5` with effort unset and Codex `gpt-5.6-terra` with `xhigh` effort. Confirm the resolved values and their provenance; a conflicting local setting is a readiness error. Configure per-model category prices (`input`, `cacheRead`, `cacheWrite`, `output`, USD per million) only when known; do not reuse one price for auxiliary models or infer cache prices from benchmark weights. Reported complete client costs may be used with their recorded basis; unknown categories remain unknown money.
3. Validate the deterministic requirement map and reference/broken examples. Freeze the scored fixture and held-out variation separately from development examples. The `assessment` policy uses only mechanical coverage, critical omissions, unsupported structured assertions, grounded opportunities, pilot behavior and source preservation. Human ratings, calibration and a fixed review quota are optional diagnostics, with no execution or release prerequisite.
4. Inspect the fixed 60-entry schedule and shared limits. Claude exposes a turn cap; Codex's turn cap is explicitly unavailable, with the shared session/attempt time and total resource limits enforced instead. Do not claim a common 40-turn cap. The approved resource caps are 60,000,000 raw tokens and 24 hours: `rawTokens: 60000000`, `wallMs: 86400000`, `usd: null`, `unknownMoneyAccepted: true`. Raw tokens include uncached input, cache reads/writes and output; weighted input is a comparison metric, not the raw resource cap. Client usage usually arrives only at a result boundary: one in-flight invocation can overshoot. Missing usage stops additional calls. The runner uses no transport retries.
5. Choose diagnostics and durable artifact directories explicitly, then freeze source/runner/fixture/rubric hashes, both executable product hashes (`productHash` in `bench/fde/protocol.js`), candidate revision and settings. Default `diagnostics: {enabled:false,directory:null}` retains no original transport output. To preserve original errors for this requested cohort, deliberately choose `diagnostics: {enabled:true,directory:"<absolute-private-directory>"}` before freeze and confirmation. That directory must be separate from products, shared evidence and the artifact output directory. Set `status: frozen`. The protocol's SHA-256 is `digest(parsedProtocol)` from that module's evidence helper. The approval file must identify `approvedBy`, `approvedAt`, `action: run-60-planned-attempts`, and that exact `protocolHash`. These fields record a real human response; a script cannot fill them from elapsed time or implementation approval.

Keep `protocol.json` in this directory after review. A draft deliberately has null fields. The release gate fails until evidence is complete; do not fill it with self-test rows.

## Execute only after confirmation

```bash
node bench/fde-run.js --protocol bench/claims/4.1.26/protocol.json --execute \
  --authorization /absolute/path/to/human-authorization.json \
  --baseline /absolute/path/to/clean-4.1.25-checkout \
  --output /absolute/path/to/durable-cohort-artifacts
```

The runner requires successful Linux and Windows records for the exact frozen candidate before even querying client versions. The schedule is serial, so it meets concurrency one per client and avoids overlapping long sessions. Each attempt has a start record before a model is invoked, per-session usage records and a final attempt record in append-only `ledger.jsonl`. A resumed interrupted attempt becomes an error; it is never rerun as if it had not happened. Remaining planned attempts after a resource stop receive explicit not-started errors. A separately approved retry would need another protocol, not replacement rows in this one. The six-session, 15-minute-session, one-hour-attempt and Claude 40-turn limits are exact protocol constants.

All arms inspect and propose first, receive the same private simulated customer approval, then build. There can be two clarification rounds and one rejected-scope correction, with at most the frozen number of sessions and wall time. Approval snapshots preserve both original and amended scope; premature implementation is incomplete evidence. Grade results cannot overwrite agent verification or a scope snapshot. Credentials are in isolated execution homes and must not be published with reviewer packets. The output directory must be owner-private and outside products and shared evidence.

Shared session and attempt rows contain numeric usage, model/accounting metadata, machine failure codes, content hashes/byte counts, command counts and explicit private artifact references. They omit final messages, command input/output, customer replies, grade failure text and report text. Customer scheduling still uses the original response in memory. Opted-in diagnostics retain bounded stdout/stderr prefixes and private details with path/hash/byte references; release auditing checks those files and rejects changed, missing or unauthorized artifacts. Without opt-in only hashes and counts survive. No existing log or historical evidence is deleted or rewritten by this policy.

The fixed `capture` policy caps each stdout/stderr prefix at 67,108,864 bytes (64 MiB), both in memory and in an opted-in file; each private JSON detail file has the same cap. Counts and SHA-256 cover every byte actually observed before settlement, including bytes beyond the retained prefix; separate retained-byte counts/hashes describe the files. These are observed bytes, not a claim to capture bytes a client never delivered. Crossing a cap fails the attempt, retains its error row and marks `complete: false`; truncated JSON details are diagnostic prefixes, not complete JSON documents.

Timeout, capture overflow or a start failure starts an independent 1,000 ms grace. The harness settles even without an exit/close event, closes descriptors and ignores late data. A normal exit with pipes left open has the same grace and fails as incomplete. Parsed usage in an incomplete prefix survives as `observedUsage`, including known token categories and reported money, while comparison tokens/cost remain null. Session and attempt accounting preserve known subtotals with explicit unknown-source counts; those known amounts count toward resource caps, and unknown totals stop subsequent client calls. Such a session cannot become a usable release sample.

This controls the harness's transport capture. Client-owned execution files and approved source snapshots remain in isolated private artifact directories; the policy does not claim that the client itself keeps no local history.

The candidate's slice-read guard has its own `sliceReads` measurement. Initialize its root-bound counter in the isolated execution HOME/USERPROFILE, read cumulative blocked/warned counts immediately before and after each client invocation, and record only numeric deltas. Append-only session observations survive client errors; attempt totals sum those increments without counting cumulative values twice. A missing/unreadable counter or a counter that decreased leaves unknown totals and preserves any other known session subtotal. A successfully initialized, observed counter may report a real zero. Bare and pinned 4.1.25 arms do not have this instrumentation: `supported: false`, `counts: null` means not instrumented, not zero. Reports include failed attempts and distinguish full observations, partial subtotals and unavailable counts. No command/file content enters the cohort ledger through this counter. These diagnostics do not change the quality requirements or the candidate's 0.80 weighted-input target.

POSIX ownership and modes and Windows owner ACLs are verified; an ACL that cannot be verified is rejected. Directory and file identity can still change concurrently, and this does not isolate a hostile process running as the same user. A descendant may outlive the client: an open pipe gets a bounded closing grace and an incomplete-transport failure, not a claim that every descendant was contained.

## Optional human diagnostics

`node bench/fde-report.js --cohort bench/claims/4.1.26 --packets --output <new-review-directory>` remains available for optional diagnosis. It copies neutral artifacts, checks, source evidence and delivered customer replies into opaque packet IDs. Do not give reviewers the cohort ledger, product identity, client, token cost, or artifact paths containing arm names. Writing style may still reveal a product; record suspected unblinding in the review reason. A separate diagnostic study may choose its sample and examine problem framing, requirement-to-check mapping, ranking rationale, prose claims and unnecessary scope. No review quota or calibration artifact is required to run or release this cohort.

Append real ratings to `reviews.jsonl`, with this structure (one record per reviewer, actual IDs and reasons):

```json
{"packet":"<opaque packet id>","scopeHash":"<initial approved scope hash>","kind":"human","reviewer":"<reviewer id>","at":"<timestamp>","reason":"<overall reasoning>","requirements":[{"id":"<private rubric id>","satisfied":true,"reason":"<why>","evidence":["scope-1/out/scope.json: <quote/reference>"]}],"unsupportedAssertions":0,"unnecessaryScope":0,"correctProblem":true}
```

For such a diagnostic, cite the initial approved agreement and retain raw ratings and disagreements. Later amended scopes cannot improve the initial discovery score after implementation. An adjudication can be another human record with `adjudication: true`, reasons, and `resolves` listing the original reviewer IDs. Never manufacture a human rating. Missing, favorable or adverse diagnostic ratings do not change execution authorization, release pass/fail, quality averages or cost matching. The report and release commands do not read `reviews.jsonl`. Proposed changes to mechanical rules belong in development before a new protocol is frozen.

This optional evaluation is separate from the pilot's required human review before an external action. Draft-only consent still authorizes no send, payment or account connection.

## Report and judge existing evidence

Append CI observations to `ci.jsonl`: `platform` (`linux` or `windows`), exact candidate `revision`, `status: passed`, run `url` and `at`. A local Linux pass does not substitute for Windows CI. Run:

```bash
node bench/fde-report.js --cohort bench/claims/4.1.26
node checks/release-4.1.26.js --protocol bench/claims/4.1.26/protocol.json \
  --ledger bench/claims/4.1.26/ledger.jsonl --report bench/claims/4.1.26/results.md
```

The report separates mechanical agreement coverage, critical omissions, unsupported structured assertions, grounded opportunities, pilot behavior, source preservation, customer response rounds, raw usage, weighted inputs, outputs, machine time and known money. Each coverage ratio must reconcile with the frozen requirements, their weights, `satisfiedWeight` and `totalWeight`. A missing critical requirement or a mechanical regression still blocks release. Within-session phase allocation stays unavailable; session totals and command traces remain inspectable. Efficiency compares matched accepted completions, with five per variant and equal variant weights, and keeps the 0.80 baseline weighted-input target. All excluded attempts are listed. No measured ROI, human time saved, general FDE superiority, or prevention claim follows from this synthetic case. The old overhead/context/session/handover evidence remains historical; a new paid regression sweep needs separate approval.

These indicators do not measure the appropriateness of problem framing or tradeoff judgment.
