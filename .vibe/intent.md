# vibe 4.1.26 — find worthwhile work to automate, agree on success, and prove one working automation

Status: draft for user approval, 2026-09-10. This is a proposed release contract, not an approved vibe intent or an implementation report. The accompanying scenarios name checks to implement after approval. No new check currently passes by virtue of this document.

## Why

vibe's purpose is to use AI as an FDE: discover the customer's problem, agree on success, build, prove, and hand off. Verified completion and continuity are demonstrated progress toward that purpose. The next release makes the first two stages useful at an acceptable cost while preserving the later stages.

The 4.1.25 scoped arm used 1.3–5.8 times the weighted input tokens of off with equal observed final artifact scores. Those scores did not measure the quality of the agreement, and many briefs already supplied detailed requirements. Separately, anomaly and ask put judge-key-dependent checks in approved agent scenarios, so an agent could not finish its own verification. Neither limitation supports a claim that discovery is useless or that the current overhead is necessary.

The first discovery case is a customer's request to find work AI can take over. A useful result must connect observed recurring work to an agreed improvement and one working automation. Counts of messages are not counts of tasks; meeting duration is not manual preparation time; current effort is not demonstrated future savings. Missing evidence must remain visible.

## What counts as success

### A. Agent checks and private grading have separate contracts

- A task has public evidence, public runnable checks, and a separate judge-only grading bundle. Public checks can read accessible task evidence and customer answers, but require no hidden key, private expected result, judge path, or judge-only environment variable. They may initially fail on an incomplete solution; the failure must concern the solution, not unavailable grading infrastructure.
- The pre-scoped `on` arm receives a public intent and public scenarios. `off` and `scoped` receive the same public evidence and check capability without a supplied solution scope. No arm receives the private oracle, fake customer's undisclosed answers, reference implementation, or negative examples.
- The runner saves the agent's exact approved intent, scenarios, referenced check files, evidence references, customer answers, and hashes before implementation. Private grading runs in a separate scratch copy after the agent ends; it never replaces the recorded agent scope or changes the artifact being graded. Agent verification and private artifact scores are separate results.
- Exercise the actual preparation and grading paths, not only a filename scan. With judge-only environment variables removed, public checks accept a valid public fixture and reject a relevant broken fixture. A private sentinel is absent from agent files and environment. Judge execution leaves the scope snapshot unchanged.
- Apply this separation to the new task and the preserved anomaly/ask diagnostics. Keep both retired; their historical rows and retirement decisions do not change. Audit active tasks for the same dependency without changing their quality thresholds.

### B. Discovery resolves consequential unknowns and stops when agreement is sufficient

- Start from accessible samples, documents, and the customer's stated objective. Inspect relevant material and use deterministic counting/profiling where appropriate. Retain compact, source-linked findings so approval, building, and resumption can reuse them without blindly repeating the same reads.
- Ask only for missing decisions that can change the problem, success criteria, constraints, or permitted action. Batch up to three high-impact questions in a round. Clear requests need no interview. If a material unknown remains, explain it and ask a focused follow-up; do not silently adopt a default because the question quota or time elapsed.
- Move to approval when the selected outcome, evidence basis, unresolved limitations, executable acceptance checks, and action boundaries are clear. One checkable sentence alone is insufficient if a critical decision is still unresolved. Reports go to chat, not `vibe ask`.
- Research, tool discovery, profiling, and skill suggestions need a task-specific reason. Reuse an available capability before proposing a new integration. Do not require an MCP connection, model delegation, or network research for a local file task that can already be completed and checked.
- Reuse unchanged findings and an existing approved intent within the task after validating source hashes and relevant assumptions. Show and approve material changes. Do not carry an old authorization into a new external action. Cross-project memory and a general intent-template system are outside this release.
- Preserve the current token-policy defaults. Existing authorization supplied by the user remains valid within its scope; uncertainty about the customer's preference is not authority to send, delete, spend, or change permissions. An unanswered material question pauses dependent work and is never answered by the agent itself.

### C. A work-automation request reaches one demonstrated result

1. Establish the observation window and accessible sources: work logs, exported mail, documents, tables, and meeting notes. Report coverage and missing sources. Inaccessible tools or absent duration records are facts to report, not numbers to infer. When no usable sample exists, request a small sample or a prospective time log and explain what can still be assessed.
2. Group distinct work events using stable IDs and source references. Count duplicates once and distinguish repeated representations of one event across sources. Report observed frequency and the number of events with measured active time. Do not extrapolate an observed window to a week, year, or organization without a stated, supported basis.
3. Produce an opportunity register with, for each candidate: the customer problem; evidence references and counting rule; observed frequency and duration coverage; proposed input/output; existing capability or required tool; installation/configuration needs; failure cases; permissions and external effects; human review point; rollback; and a runnable acceptance-check command or an explicit pending prerequisite. Mark unsupported quantities as unknown.
4. Separate observed manual effort, a hypothesis about automatable steps, and measured automation results. A time-saving claim needs a comparable manual baseline and measured human setup, correction, and review effort on equivalent work. Machine runtime is reported separately and is not human time saved. Monetary ROI or payback remains unknown when labor value, implementation cost, maintenance, or expected usage is missing. Do not invent a failure probability or implementation-hours estimate.
5. Rank eligible opportunities with the customer: first feasibility and permissions, then the customer's objective, then evidenced recurring burden and demonstrated implementation needs. Explain the ordering and uncertainty. Unknown values are not zero. Return up to three grounded candidates; do not fabricate a third or force a numerical ROI ranking. A blocked opportunity may be valuable but is not presented as ready to install.
6. Bind every grounded candidate to an observational feasibility/check scenario; activate the build scenarios for one selected candidate after the customer agrees. Do not build all candidates merely because they appear in the register. If none is feasible, record why and the smallest evidence/access step needed; do not manufacture a working result.
7. For the selected candidate, build and install a reversible local pilot, run its acceptance checks, exercise a failure case and rollback, and leave an operator command to rerun it. A local draft is not a delivered email or a production deployment. A real external installation or send is performed only when its concrete action is covered by the user's authorization; otherwise retain a runnable local pilot and state the boundary.

### D. `work-opportunities` is the first front-half benchmark

This is a suitable first case because evidence discovery, uncertainty, customer priorities, scope selection, and implementation all affect observable results. It is a bounded synthetic case, not proof of general FDE competence or real customer ROI.

Proposed task layout after approval:

```text
bench/tasks/work-opportunities/
  TASK.md                        # customer request and required deliverables, no solution list
  evidence/worklog.csv           # stable event IDs, active minutes or null, source references
  evidence/mail.jsonl            # fixed exported messages, including duplicate representations
  evidence/documents/            # reporting rules, tool manifest, privacy/retention constraints
  evidence/tables/               # status and invoice records
  evidence/meetings/             # dated minutes with action items and meeting durations
  checks/                       # public check interface and ordinary examples; no private key
  public/                       # public intent/scenarios for pre-scoped compatibility checks
  judge/                        # deterministic grading contracts; not copied to agent workspace
  key/                          # customer responses, requirement map, valid/broken fixtures
```

The fixture is invented test data, clearly labelled as such. Freeze its manifest and content hashes before scored runs. The proposed seed contains two observed workweeks:

| Work represented in the sources | Fixed observation | Interpretation to preserve |
| --- | --- | --- |
| Internal status preparation | 10 distinct events, 8 active minutes each; one repeated export row | 10 events and 80 observed minutes, not 11 events |
| Meeting follow-up preparation | 4 distinct events, 15 active minutes each; meeting length recorded separately | 60 active minutes; whole meeting time is not preparation effort |
| Invoice matching | 6 distinct events, active minutes absent | Recurrence is known; effort, savings, and ROI are unknown |
| One-off slide redesign | 1 event, 40 active minutes | Evidence of a task, not demonstrated recurrence |

Mail and notes refer to some of the same events. A forwarded productivity claim is not evidence of this customer's savings. Public policy requires human review before an external send and does not permit automated payment. A public tool manifest exposes installed local tools and simulated connectors; no real account, provider purchase, or network installation is needed.

- Two scored customer variants share the source data and initial request. In `status-first`, the customer's priority is reducing recurring internal status preparation. In `followup-first`, it is preventing missed meeting follow-ups. A relevant question obtains the priority; it is not an unknowable secret. The expected first pilot changes with the answer. Equivalent implementations and decompositions are accepted.
- The fake customer consumes open inbox questions or a plain-chat request, including declarative requests for missing information. Its answer contract is the same for all arms. It never answers an unrelated question with the entire key or withholds a relevant answer solely because of punctuation. Pre-score fixtures cover paraphrases, bundled questions, reports, and unknown questions. An unclassified relevant request is a harness error with evidence, not a model-quality failure.
- The customer explicitly approves an eligible proposed local pilot after seeing the scope. This approval is an event from the fixture, recorded as simulated consent; the agent cannot write its own approval. All arms have the same opportunity to obtain answers, revise once after a customer correction, and build. Cap at two customer clarification rounds plus one scope correction, with a common pre-registered execution budget; no mandatory empty continuation is added to an arm.
- All arms produce the same neutral outputs before building: `out/opportunities.json`, `out/scope.json`, and referenced executable check files. The schema requires source references and explicit unknowns, not judge requirement IDs or a preferred wording. For vibe, this is a compact export of its own scope, not a second full-length agreement. Freeze the snapshot at approval; retain both original and amended snapshots if scope changes later.
- The selected pilot exposes a stable local adapter, `node automation/run.cjs --input <directory> --out <directory>`, so different internal implementations can be tested. Status output must reflect source updates and blockers with traceable references. Follow-up output must retain owner, due-date uncertainty, and source references without inventing missing fields. Customer-facing semantics are public once agreed; hidden grading adds new data, not undisclosed business rules.
- `node automation/install.cjs --target <fixture-directory>` installs only inside the supplied test directory, returns a manifest of created files, and permits rerun plus rollback from that manifest. Public checks and private grading run in copies with separate fake homes. Any simulated external effect is recorded to a sink for inspection; no real email, payment, permission change, package publication, or production access occurs.
- Private grading tests the pilot on the original fixture and a fresh deterministic variation that changes IDs, dates, content, and row order. It verifies behavior, source preservation, repeatability, failure handling, review boundaries, installation, and rollback. A static correct-looking output must fail on changed input.
- Build a reference solution for each customer variant and broken examples for duplicate counting, missing-time invention, meeting-time substitution, unsupported ROI, wrong priority, silent owner/date fabrication, vacuous checks, hard-coded output, and external action without review. Validate these judges without calling a live model.

### E. Grade the agreement independently and record the complete cost

Freeze a requirement map before scored runs. Compare semantic requirements, not exact scenario text or the number of scenarios. Score each requirement once, even when many scenarios mention it. Proposed weights:

| Requirement | Weight | Critical |
| --- | ---: | :---: |
| Traceable distinct-event counts and observation window | 3 | yes |
| Correct active-time coverage, separate from meeting duration | 2 | yes |
| Explicit unknown savings/ROI where evidence is absent | 3 | yes |
| Selection consistent with the obtained customer priority | 3 | yes |
| Grounded eligibility and ranking, without invented extra work | 2 | no |
| Candidate scenarios and executable selected-pilot acceptance checks | 2 | no |
| Selected output behavior and treatment of missing fields | 3 | yes |
| External-effect boundaries and human review | 3 | yes |
| Failure handling and reversible local installation | 1 | no |
| Operator rerun instructions with evidence | 1 | no |

- Weighted coverage is satisfied weight divided by the 23 applicable weight units. Also report critical omissions, contradictions, unsupported factual/quantitative assertions, grounded distinct opportunities, unnecessary scope, and the selected pilot's private behavioral score. Do not offset a critical omission or false claim with additional correct scenarios. Finding zero opportunities does not earn a perfect score merely by making zero false claims.
- An evidence-backed opportunity has source-supported recurrence, a concrete repeatable transformation, an explicit feasibility status, and a checkable proposed result. Count it once per work family. The seed has three such families; invoice matching may remain a local-only candidate with unknown effort. The one-off redesign does not count as recurring. Unlisted but defensible alternatives go to the pre-declared review process, not automatic rejection.
- Deterministic checks recompute counts, units, source references, constraints, and runnable behavior. Test candidate checks against valid implementations and single-requirement violations; report caught violations and false rejection of valid alternatives. Do not equate a schema-valid register or file-exists check with complete scope quality.
- For problem framing, requirement-to-scenario mapping, ranking rationale, and unsupported claims in prose, use an arm-blinded human rubric outside the deterministic artifact judge. Calibrate on development examples before scored runs; independently double-review a fixed 20% sample and adjudicate disagreements under the frozen rubric. Preserve raw ratings and reasons. Missing reviews are incomplete evidence, never an automatic pass or an LLM-generated human verdict.
- Record intake, clarification, scope, approval, build, proof, and handoff boundaries; customer answers/corrections; scope hashes; checks written and executed; agent verification status; private grade; and all sessions. Each phase records measured wall time, tool calls, and token usage where the client exposes reliable boundaries. Otherwise mark the phase allocation unavailable; do not invent a split of aggregate usage.
- Preserve raw token categories, weighted input tokens, output tokens, and reported/recomputed money separately. Unconfigured prices mean unknown money. Customer response count is a benchmark proxy for effort, not a measured number of real customer minutes. Fixture manual-time records do not establish that the installed pilot saves that time.
- Use a new protocol ID and an isolated append-only cohort ledger; leave `bench/ledger.jsonl` and all 4.1.25 claim records fixed. Identify task/variant/attempt, client/model, harness revision, runner and fixture hashes, scope snapshot, usage, errors, and `stalled`/incomplete status. Stalled and API-error attempts stay in the planned denominator and a separate count; they never become successful quality samples or get replaced with older successes.

### F. Pre-register a bounded comparison and a meaningful release target

These are proposed approval terms, not achieved measurements:

- Before scored model calls, lock the rubric, task variants, input hashes, runner protocol, model identifiers and settings from the configured SSOT, maximum turns/time, attempt schedule, and a total token/currency budget. If the execution budget cannot be specified, the paid cohort is not ready to start. Paid runs remain a separate action from an ordinary check or CI job.
- Use 2 clients × 2 customer variants × 3 arms × 5 planned attempts = 60 attempts. Arms are bare `off`, `scoped` with pinned 4.1.25 product behavior, and `scoped` with the candidate 4.1.26 behavior. Both scoped arms use the same new runner, neutral output contract, fake customer, public/private separation, and approval scheduling. Keep compatibility adaptations explicit and identical where possible; do not patch discovery behavior in the baseline. Old rows cannot substitute for this new-protocol baseline. `on` is excluded from this discovery comparison because its scope is supplied.
- Develop against separate seeds; freeze scored fixture hashes and retain a held-out input variation for behavior. Balance/interleave arm order within each client and variant. Use concurrency one per client, with the same limits across arms; count every actual continuation and stop at the approved resource limit. A transport retry, if separately authorized, creates a new labelled attempt and never overwrites a planned failure.
- A complete scored cohort needs all five planned usable observations in every cell, required usage, and the frozen-scope reviews. Otherwise report insufficient evidence and no performance verdict. Report quality on every gradable attempt and failures/stalls against all planned attempts; compare efficiency only on matched, fully accepted completions and display the excluded attempts beside it.
- Proposed absolute quality floor for candidate 4.1.26: all critical requirements satisfied, no unsupported factual or quantitative assertions, all three grounded recurring work families identified, weighted scope coverage at least 90%, and the chosen pilot passing every required behavioral check in each usable attempt. An explicit unknown is correct when evidence is absent. Review disputes must be resolved before applying this floor.
- Also require mean weighted scope coverage and final behavioral quality no worse than either bare or baseline scoped, separately for each client and customer variant. A quality gain in one cell cannot conceal a regression in another.
- Proposed cost improvement target: candidate full-flow weighted input tokens at most 0.80 times baseline scoped, calculated per client over equally weighted customer variants and the five complete matched attempts. Mean customer clarification/correction count must not increase, and mean output tokens must not increase; publish wall time and monetary cost when observed. This 20% target is a user-approval proposal, not a conclusion drawn from the old ratios. Report candidate/off costs even when the baseline target passes. Do not call it cheaper than bare unless that comparison supports it.
- Keep quality, customer burden, and cost verdicts separate. If quality or the cost target fails, report the release objective as unmet; do not reduce thresholds, drop a difficult variant, retire this case for a tie, or rerun until a favorable sample replaces the result. Broad prevention, general FDE superiority, human time saved, and ROI claims are not earned by this first cohort.
- `checks/release-4.1.26.js` will validate the frozen protocol and existing evidence and apply these rules; it never launches models or writes ledger rows. Its self-tests include missing cells, missing human review, missing usage, API failures, stalled runs, baseline revision mismatch, wrong phase attribution, a critical omission masked by average coverage, and cross-client quality/cost regressions.

### G. Compatibility and release boundaries

- Preserve the build, existing tests, Linux/Windows behavior, home/temp isolation, hook authorization escape path, real destructive-action gating, inbox answer/resumption behavior, size/card limits, and exit-code-based load checks. Add behavior tests for newly changed paths and use platform-portable Node entry points.
- Existing release-set definitions, retired task status, and approved 4.1.25 thresholds are not relaxed by this spec. Frozen historical gate results remain historical; passing them does not prove unchanged 4.1.26 performance. Any additional paid regression cohort required by the release owner is separately pre-registered and budgeted, rather than silently added to the 60-attempt discovery cohort.
- Keep the working branch and submit implementation only after this draft is approved. Claude owns intent activation, merge, version/tag/npm publication, and the user's release approval. This draft authorizes none of those actions.

## Constraints and explicit exclusions

- During this drafting task, write only these external draft documents. Do not mutate active `.vibe/intent.md`, scenarios, state, inbox answers, ledger, gates, source, version, or benchmark records; do not run a paid benchmark or install a pilot.
- The release's product work is adaptive evidence-first discovery, a sufficient-agreement stopping rule, reuse of unchanged within-task evidence, and the first complete work-opportunity case. A generic automation marketplace, universal connectors, cross-project memory, and cheap-model orchestration are not included.
- Real customer data collection, an automatic external installation chosen solely by a ranking, production side-effect experiments, and invented numerical savings or risk probabilities are excluded. Research on long tasks and session changes starts from observed failures and is recorded separately; it does not delay the first front-half evaluation or add an unapproved benchmark sweep.
- Keep source files at most 400 lines and functions at most 50; keep card and skill budgets at their existing limits. Reuse existing reader/profile/check/approval capabilities instead of building parallel systems.
- The five scenarios in `scenarios.yaml` are implementation acceptance groups. Their new check scripts are proposed and unimplemented. Syntax and dependency validation of this draft does not verify any runtime behavior, score, cost improvement, or future release readiness.
