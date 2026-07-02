---
name: vibe.verify
description: Verify implementation against SPEC requirements
argument-hint: "feature name"
user-invocable: true
---

# /vibe.verify

SPEC-driven verification. Check the implementation against the SPEC's **Done criteria** and Feature scenarios, record the result to the **run ledger** (`recordVerify`), and auto-register regressions on failure. The JUDGE gate is code-enforced by the ledger — a verification never counts as passed by self-report.

## Usage

```
/vibe.verify "feature-name"           # SPEC-based verification
/vibe.verify --e2e "feature-name"     # + E2E browser verification (agents/e2e-tester.md)
```

## Scope

- **Changed files only** — never full-project scan.
- Verification target = the SPEC's Done criteria + Given/When/Then scenarios. Read whatever is needed to judge each criterion accurately; choose your own reading strategy, but never mark a criterion passed without concrete evidence (test exit code, build result, or a verified code location).

## Process

### 1. Load SPEC / Feature

Search order (folder first, then single file):

1. `.vibe/features/{feature}/` (split structure: `_index.feature` + `phase-N-*.feature`) or `.vibe/specs/{feature}/` (`_index.md` + phase files) — read `_index` first, then verify phase by phase
2. `.vibe/features/{feature}.feature` or `.vibe/specs/{feature}.md`
3. Neither exists → error:

```
❌ Feature file not found. Run /vibe.spec "{feature}" first.
```

Extract the Done criteria / scenarios — this list is the verification checklist.

### 2. Verify each Done criterion (parallel, deterministic)

Run all applicable methods as parallel sub-agents in ONE message; each returns a short pass/fail summary instead of bloating main context:

| Method | How | Condition |
|---|---|---|
| Test execution | `npm test` (judge by exit code) | test files exist |
| Build | `npm run build` | build script exists |
| Type check | `tsc --noEmit` / code-reviewer agent (focus: idioms) | TypeScript project |
| Code analysis | verify Given/When/Then logic against changed files | always |
| E2E closed loop | e2e-tester agent drives browser scenarios | `--e2e` flag or UI scenarios |

**E2E closed loop** (`--e2e`): per scenario — navigate → interact → assert. On fail: collect evidence (screenshot, console errors) → root-cause → fix → re-run **only the failed scenario**. Prefer accessibility-tree tools over raw DOM dumps to keep the loop cheap.

### 3. Visual drift (auto, only if `DESIGN.md` exists + UI stack)

```
Load skill `vibe.design` with: verify --files=<changed-ui-files>
```

P1 drift (hex hardcoded outside the DESIGN.md token set) → verify fails. DESIGN.md absent → notify and silently skip (never block).

### 4. Result summary (short markdown — no box art)

```markdown
## Verify: {feature} — PASS | FAIL (n/m criteria)

| Done criterion | Result | Evidence |
|---|---|---|
| Valid login returns JWT | PASS | auth.test.ts 12/12; src/auth/login.ts:42 |
| Forgot-password link | FAIL | LoginForm.tsx:42 — link not implemented |

Build: OK · Tests: 12/12 · Types: 0 errors
Next: /vibe.run "{feature}" --fix   ← only when FAIL
```

One row per Done criterion: pass/fail + an evidence pointer (file:line, test name, or command result). Failure rows state expected vs actual and the exact location.

**Pass condition**: ALL Done criteria pass AND build/tests/type check pass. Anything else = FAIL.

### 5. Failure auto-register (MANDATORY on any failed criterion)

Before printing the failure summary, register each failed scenario as a regression bug so the same failure cannot silently slip through again:

```
Load skill `regress` with:
  subcommand: register --from-verify
  feature: {feature}   scenario: {scenario}
  error: {error-summary}   location: {file:line}
```

`--from-verify` skips user confirmation. The bug slug appears in the summary's Fix line. Follow up with `/vibe.regress generate <slug>` for a preventive test.

### 6. Post-verify contract check (auto, only when a contract file exists)

After all criteria pass, if `.vibe/contracts/{feature}.md` exists:

```
Load skill `contract` with: check "{feature}"
```

- No drift → verify still passes
- **P1 drift** → demote verify to FAIL; auto-call `/vibe.regress register --from-contract`
- P2/P3 drift → warning only

### 7. Metrics + Ledger update (MANDATORY final step)

Record run metrics, then write the verify result to the run ledger. This is the machine-readable JUDGE record consumed by the Stop-hook verify gate, auto-commit verify gate, and loop-contract gates.

```bash
# Append step-count history (ok if current-run.json missing)
node -e "
const fs=require('fs'),p='.vibe/metrics';
try{const c=JSON.parse(fs.readFileSync(p+'/current-run.json','utf-8'));
fs.appendFileSync(p+'/history.jsonl',JSON.stringify({verifiedAt:new Date().toISOString(),feature:c.feature,startedAt:c.startedAt,steps:c.steps||0})+'\n');}catch{}"

# Record verify result — pass | fail (calls recordVerify on the run ledger)
HOOKS_DIR="${VIBE_PATH:-$(npm root -g 2>/dev/null)/@su-record/vibe}/hooks/scripts"
[ -f "$HOOKS_DIR/verify-ledger.js" ] && node "$HOOKS_DIR/verify-ledger.js" pass   # or: fail

# Recipe extraction (best-effort, silent)
[ -f "$HOOKS_DIR/recipe-extractor.js" ] && node "$HOOKS_DIR/recipe-extractor.js" 2>/dev/null || true
```

Use `pass` only when the summary in step 4 is PASS; otherwise `fail`. Skipping this step leaves `verifyPassed` unset and downstream gates will treat the run as unverified.

## Failure escalation (convergence-based, no retry cap)

```
fix → re-verify → still failing?
  different error → progress, continue looping
  same error as previous attempt → STUCK:
    interactive: ask user (fix hint / "proceed" → record .vibe/todos/verify-failure-{scenario}.md / "abort")
    autonomous (automationLevel: autonomous): record TODO, continue to next scenario
```

## Next step

- PASS → proceed to the next feature
- FAIL → `/vibe.run "{feature}" --fix`

---

ARGUMENTS: $ARGUMENTS
