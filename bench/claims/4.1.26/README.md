# 4.1.26 discovery protocol and evidence

Implementation approval does not authorize the paid cohort. Claude obtains the user's separate confirmation after deterministic checks and a reviewable protocol are ready. No 4.1.25 row or claim record is a baseline for this experiment.

## Before scored execution

1. Finish and check the candidate; record its commit. Prepare a clean checkout at `2d2af57` and build 4.1.25 there. Both arms need their own `dist/`, card, hooks and skills. Baseline discovery behavior must stay unchanged.
2. Run `node bench/fde-run.js --draft --protocol <new-protocol.json>` to read only configured model/effort fields from environment or client settings. This calls no model. Missing identifiers are missing settings; never silently choose a catalogue default. Record the exact resolved models, efforts and provenance. Configure per-model input/output prices when available; do not reuse one price for auxiliary models.
3. Calibrate human reviewers on development examples, before scored attempts. Store the actual calibration artifact, its SHA-256 and reviewer identities. Use the task's requirement map as the frozen rubric. The fixture and its held-out variation are synthetic and separate from real customer data. A generated human rating is prohibited.
4. Inspect the fixed 60-entry schedule and shared limits. Set finite total raw-token and wall-time caps. Set a USD cap with known prices, or explicitly approve unknown money while enforcing the token cap. Raw tokens include uncached input, cache reads/writes and output; weighted input is a comparison metric, not the raw resource cap. Client usage usually arrives only at a result boundary: one in-flight invocation can overshoot. Missing usage stops additional calls. The runner uses no transport retries.
5. Freeze source/runner/fixture/rubric hashes, both executable product hashes (`productHash` in `bench/fde/protocol.js`), candidate revision and settings. Set `status: frozen`. The protocol's SHA-256 is `digest(parsedProtocol)` from that module's evidence helper. The approval file must identify `approvedBy`, `approvedAt`, `action: run-60-planned-attempts`, and that exact `protocolHash`. These fields record a real human response; a script cannot fill them from elapsed time or implementation approval.

Keep `protocol.json` in this directory after review. A draft deliberately has null fields. The release gate fails until evidence is complete; do not fill it with self-test rows.

## Execute only after confirmation

```bash
node bench/fde-run.js --protocol bench/claims/4.1.26/protocol.json --execute \
  --authorization /absolute/path/to/human-authorization.json \
  --baseline /absolute/path/to/clean-4.1.25-checkout \
  --output /absolute/path/to/durable-cohort-artifacts
```

The schedule is serial, so it meets concurrency one per client and avoids overlapping long sessions. Each attempt has a start record before a model is invoked, per-session usage records and a final attempt record in append-only `ledger.jsonl`. A resumed interrupted attempt becomes an error; it is never rerun as if it had not happened. Remaining planned attempts after a resource stop receive explicit not-started errors. A separately approved retry would need another protocol, not replacement rows in this one.

All arms inspect and propose first, receive the same private simulated customer approval, then build. There can be two clarification rounds and one rejected-scope correction, with at most the frozen number of sessions and wall time. Approval snapshots preserve both original and amended scope; premature implementation is incomplete evidence. Grade results cannot overwrite agent verification or a scope snapshot. Credentials are in isolated execution homes and must not be published with reviewer packets.

## Human scope review

`node bench/fde-report.js --cohort bench/claims/4.1.26 --packets --output <new-review-directory>` copies neutral artifacts, checks, source evidence and delivered customer replies into opaque packet IDs. Do not give reviewers the cohort ledger, product identity, client, token cost, or artifact paths containing arm names. Writing style may still reveal a product; record suspected unblinding in the review reason. The fixed double-review set is attempt 1 of each cell, 12 packets. Review the problem framing, requirement-to-check mapping, priority/ranking rationale, unsupported claims and unnecessary scope; schema validity alone earns no credit.

Append real ratings to `reviews.jsonl`, with this structure (one record per reviewer, actual IDs and reasons):

```json
{"packet":"<opaque packet id>","kind":"human","reviewer":"<reviewer id>","at":"<timestamp>","reason":"<overall reasoning>","requirements":[{"id":"<private rubric id>","satisfied":true,"reason":"<why>","evidence":["scope-1/out/scope.json: <quote/reference>"]}],"unsupportedAssertions":0,"unnecessaryScope":0,"correctProblem":true}
```

Rate every requirement exactly once with cited evidence. Keep raw ratings even if reviewers disagree. An adjudication is another human record with `adjudication: true`, the agreed ratings/reasons, and `resolves` listing the original reviewer IDs. Missing, model-authored or unresolved ratings do not pass. Defensible alternative decompositions should receive semantic credit from the rubric; a novel opportunity requiring changed mechanical rules must be resolved on development examples before freeze, not after seeing arm scores.

## Report and judge existing evidence

Append CI observations to `ci.jsonl`: `platform` (`linux` or `windows`), exact candidate `revision`, `status: passed`, run `url` and `at`. A local Linux pass does not substitute for Windows CI. Run:

```bash
node bench/fde-report.js --cohort bench/claims/4.1.26
node checks/release-4.1.26.js --protocol bench/claims/4.1.26/protocol.json \
  --ledger bench/claims/4.1.26/ledger.jsonl --report bench/claims/4.1.26/results.md
```

The report separates quality, customer response rounds, raw usage categories in the ledger, weighted inputs, outputs, machine time and known money. Within-session phase allocation stays unavailable; session totals and command traces remain inspectable. Efficiency compares matched accepted completions, with five per variant and equal variant weights. All excluded attempts are listed. No measured ROI, human time saved, general FDE superiority, or prevention claim follows from this synthetic case. The old overhead/context/session/handover evidence remains historical; a new paid regression sweep needs separate approval.
