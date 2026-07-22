# SPEC: {Feature Name}

- **Created**: {YYYY-MM-DD}
- **Status**: DRAFT | APPROVED
- **Stakes**: demo | prototype | production — {판정 근거 1구} (SSOT: vibe/rules/loop-contract.md)
- **Tech Stack**: {Project tech stack summary}

---

## 1. Overview / Goal

{What and why — 1-3 sentences.}

### Context Sources

- {File, document, URL, or observed system state used as input}

### Assumptions

- {Default adopted without asking — e.g., session expiry 24h}

### Constraints

- {Invariant or implementation boundary that every execution packet must preserve}

### Rejected Alternatives (Traps)

> Approaches considered and rejected, each with a mechanistic reason — so the loop never revisits a dead end. Omit only when no real design choice existed (or on demo/prototype stakes).

- {Rejected approach} — {mechanistic reason it fails, e.g., "shelve is not thread-safe under multi-writer load", not a vague label like "doesn't scale"}

---

## 2. Requirements

| ID | Requirement | Done Criteria |
|----|-------------|---------------|
| REQ-{feature}-001 | {Observable functional requirement} | D1, D2 |

---

## 3. Done Criteria (deterministic gates)

> Each criterion must be judgeable by a command or observable behavior — never by self-report.
> These are the JUDGE inputs of the loop (`vibe/rules/loop-contract.md`); `/vibe.verify` records the result in `.vibe/metrics/run-ledger.json`.

| # | Criterion | Verified by |
|---|-----------|-------------|
| D1 | {e.g., all scenarios in the feature file pass} | {e.g., `npx vitest run` exit 0} |
| D2 | {e.g., build succeeds with no type errors} | {e.g., `npm run build` exit 0} |

### Evidence Required

- D1 → {Command result, test report, log, screenshot, or verified code location}
- D2 → {Evidence required for this specific criterion}

### Human Taste (Non-Blocking)

- {UX, brand, or product-quality review reserved for the release decision; never a loop completion gate}

---

## 4. Scenarios

> Mirrored to `.vibe/features/{feature}.feature` (gherkin). Every scenario maps to a Done criterion.

```gherkin
Scenario: {Happy path title}          # → D1
  Given {precondition}
  When {action}
  Then {expected result}

Scenario: {Edge case title}           # → D1
  Given {precondition}
  When {action}
  Then {expected result}
```

---

## 5. Out of Scope

- {Explicitly not doing this time — must not be empty}

---

## 6. API Contract (only if the feature exposes an API)

> Presence of this section enables `/vibe.contract` drift detection.

```text
POST /api/v1/{resource}
Request: {...}
Response: 201 {...}
```

---

## 7. Verification

- `/vibe.run "{feature}"` implements scenario-by-scenario, verifying each immediately.
- `/vibe.verify "{feature}"` judges the Done Criteria and sets `verifyPassed` in the run-ledger.
- Verification writes `.vibe/runs/{run-id}/evidence.json`; only deterministic Judge results can complete the loop.
- Model Judge findings are advisory-only. Human Taste is release-only.
- Gate = all Done Criteria pass (exit codes / observed behavior) — loop continues until gates pass, stuck, or max iterations.
