# Scope review and data separation

key/requirements.json is the frozen 23-unit requirement map. Mechanical coverage is a diagnostic
measurement of structured observations, executable checks and behavior. It is not a human verdict
on problem framing, semantic requirement coverage, ranking rationale or unsupported prose.
Those dimensions require the separate arm-blinded human review, with raw ratings and reasons.

Grade frozen scope evidence and check discrimination against private valid implementations
and single-defect implementations. Submitted implementation failures do not lower scope
coverage. Source damage after approval and a missing final OPERATOR.md belong to the separate
pilot artifact metrics; source validity and promised handoff in the frozen agreement remain
independent. Passing the artifact checks cannot repair a deficient frozen agreement.

Calibrate on key/development/evidence and development reference/broken outputs. These have
different stable IDs and dates from scored evidence/. grade(..., {fixture:"development"}) labels
that result; development results must never enter the scored cohort. key/data-seeds.json names
the seeds. The private fixture manifest pins both evidence sets and excludes its own file.
key/heldout-input.json supplies changed behavior data with new IDs, dates, content and row order.
No scored agent sees the development examples, reference implementation, negative examples,
requirement map, customer variant or held-out input.

Score each requirement once, regardless of scenario count or wording. Distinct source-backed
opportunities and unsupported assertions are separate metrics. Accept different candidate IDs,
scenario decompositions and implementations when the same evidence and agreed behavior hold.
Refer defensible unlisted problem framings to human review; do not automatically discard them.
Double-review the protocol's fixed sample and adjudicate disagreements before the release gate.
Missing reviews remain missing. Deterministic assertions cover structured fields only; zero
detected structured false claims does not certify the absence of unsupported prose.
