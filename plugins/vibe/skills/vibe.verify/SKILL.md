---
name: vibe.verify
description: 승인된 SPEC에 대한 구현 완료를 판정하거나 REQ→SPEC→Feature→Code 추적표가 필요할 때 검증 또는 trace mode로 실행한다.
argument-hint: "feature name [--e2e] | trace feature-name [--html] [--save] [--json]"
user-invocable: true
---

# /vibe.verify

## 완료 기준

- [ ] 승인된 SPEC의 모든 REQ가 pass 또는 fail로 판정되어 있다.
- [ ] 각 판정에 test output, 파일·행 또는 산출물 경로 근거가 있다.
- [ ] verify mode 성공 시 run ledger의 `verifyPassed`가 true다.
- [ ] trace mode에서는 RTM 파일이 존재하고 누락 REQ가 0개다.

SPEC-driven verification. Check the implementation against the SPEC's **Done criteria** and Feature scenarios, record the result to the **run ledger** (`recordVerify`), and auto-register regressions on failure. The JUDGE gate is code-enforced by the ledger — a verification never counts as passed by self-report.

## Usage

```
/vibe.verify "feature-name"           # SPEC-based verification
/vibe.verify --e2e "feature-name"     # + E2E browser verification (agents/e2e-tester.md)
/vibe.verify trace "feature-name"     # Requirements Traceability Matrix
/vibe.verify trace "feature-name" --html | --save | --json
```

## Trace mode

When the first argument is `trace`, read `references/trace-mode.md` and execute
that RTM workflow instead of the verification process below. Preserve the
feature name and `--html`, `--save`, and `--json` flags. An empty RTM is a gate
failure. Trace output alone does not set `verifyPassed`; run normal verify mode
to bind command evidence to the run ledger.

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

Run all applicable methods through the harness's native collaboration
capability; each worker returns a short pass/fail summary instead of bloating
the coordinator context. Claude Code maps workers to Task/Agent; Codex maps
them to native collaboration. Inherit the session model by default and run
independent methods concurrently when capacity permits:

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
Load skill `vibe.regress` with:
  subcommand: register --from-verify
  feature: {feature}   scenario: {scenario}
  error: {error-summary}   location: {file:line}
```

`--from-verify` skips user confirmation. The bug slug appears in the summary's Fix line. Follow up with `/vibe.regress generate <slug>` for a preventive test.

### 6. Post-verify contract check (auto, only when a contract file exists)

After all criteria pass, if `.vibe/contracts/{feature}.md` exists:

```
Load skill `vibe.contract` with: check "{feature}"
```

- No drift → verify still passes
- **P1 drift** → demote verify to FAIL; auto-call `/vibe.regress register --from-contract`
- P2/P3 drift → warning only

### 7. Metrics + Ledger update (MANDATORY final step)

Record run metrics, then explicitly write the verify result to the run ledger.
This machine-readable record is the deterministic JUDGE consumed by the
loop-contract gates. Lifecycle Stop/auto-commit hooks may consume the same
record for earlier feedback, but correctness does not depend on either hook.
`recordVerify` also writes `.vibe/runs/{run-id}/evidence.json`; Model Judge
findings remain advisory-only and Human Taste remains release-only.

```bash
# Append step-count history (ok if current-run.json missing)
node -e "
const fs=require('fs'),p='.vibe/metrics';
try{const c=JSON.parse(fs.readFileSync(p+'/current-run.json','utf-8'));
fs.appendFileSync(p+'/history.jsonl',JSON.stringify({verifiedAt:new Date().toISOString(),feature:c.feature,startedAt:c.startedAt,steps:c.steps||0})+'\n');}catch{}"

# Write the exact commands run in steps 2-3 and their exit codes.
mkdir -p .vibe/metrics
# Write `.vibe/metrics/verification-results.json` as:
# [{"command":"npm test","exitCode":0}, ...]

# Bind the result to the current run and its command evidence.
HOOKS_DIR="${VIBE_PATH:-$(npm root -g 2>/dev/null)/@su-record/vibe}/hooks/scripts"
RUN_ID=$(node -p "JSON.parse(require('fs').readFileSync('.vibe/metrics/run-ledger.json','utf8')).runId")
[ -f "$HOOKS_DIR/verify-ledger.js" ] && node "$HOOKS_DIR/verify-ledger.js" pass "$RUN_ID" .vibe/metrics/verification-results.json   # or: fail

# Recipe extraction (best-effort, silent)
[ -f "$HOOKS_DIR/recipe-extractor.js" ] && node "$HOOKS_DIR/recipe-extractor.js" 2>/dev/null || true
```

Use `pass` only when the summary in step 4 is PASS; otherwise `fail`. A passing record requires at least one command result and every exit code must be zero. A stale run ID, missing evidence, or mismatched result leaves `verifyPassed` unset and downstream gates treat the run as unverified.

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
