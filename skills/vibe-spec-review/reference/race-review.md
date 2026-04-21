# vibe.spec-review — Race Review (Step 3)

> GPT + Gemini (+ optional Codex) cross-validation loop. Convergence-based, no round cap. Full definition for Step 3 of the review flow; referenced from the main SKILL.md.

## Table of Contents

1. [Rules for Race Review](#rules-for-race-review)
2. [Termination rules](#termination-rules)
3. [Stuck handling](#stuck-handling-321)
4. [Narrowing scope](#narrowing-scope-noise-reduction)
5. [Review Loop procedure](#31-review-loop-no-round-cap)
6. [Cross-validation rules](#32-cross-validation-rules)
7. [User decision checkpoint](#33-user-decision-checkpoint-after-convergence)
8. [Output format](#output-format)
9. [Codex adversarial review](#step-31-codex-adversarial-review-when-codex-plugin-is-active)

---

## Rules for Race Review

1. **YOU MUST** use the Bash tool to call `llm-orchestrate.js` directly
2. **DO NOT** simulate or fake review results
3. Run rounds sequentially (each round uses updated SPEC)
4. **No hard round cap** — loop until P1=0 AND no new findings (convergence)

> Race Mode reviews SPEC with GPT and Gemini in parallel, then cross-validates findings for higher confidence. The loop continues until quality converges naturally.

## Termination rules

- **P1 = 0 AND no new findings this round** → converged, stop (primary success)
- **Round 1 with P1 = 0 AND no P2/P3** → perfect on first try, stop (early success)
- **Round N findings == Round N-1 findings** → **stuck**: LLMs keep flagging same issues that auto-applier can't resolve → **ask the user** (see below)

## Stuck handling (3.2.1)

When the same findings repeat across rounds, the auto-apply loop has hit a wall. This typically means:
- The fix requires human judgment (architectural trade-off, domain rule, etc.)
- The LLMs are producing a false positive that the auto-applier can't dismiss
- The suggested fix conflicts with an existing constraint

**Interactive mode** — prompt the user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ RACE REVIEW STUCK at Round {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Same findings repeated from Round {N-1}. Auto-applier cannot resolve:

| # | Issue | Severity | GPT | Gemini | Reason it's stuck |
|---|-------|----------|-----|--------|-------------------|
| 1 | {issue title} | P1 | ✅ | ✅ | {e.g., "fix requires domain decision"} |
| 2 | {issue title} | P2 | ✅ | ❌ | {e.g., "conflicts with existing constraint"} |

How would you like to proceed?
  1. Provide a resolution directly (e.g., "issue 1: retry 5 times, issue 2: ignore")
     → Changes will be applied and the next round re-run
  2. "proceed" — Record current issues as TODO and continue to Step 4
  3. "abort" — Stop the workflow

(In ultrawork mode, this prompt is skipped — TODO is auto-recorded and execution continues)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Pseudocode:**

```python
if current_findings == prev_findings:
    if ultrawork_mode:
        print("ℹ️ ultrawork mode — recording stuck issues to TODO and proceeding")
        record_todo(current_findings)
        break

    user_input = ask_user(
        "Race Review stuck. Please either:\n"
        "  1. Provide resolution for the listed issues\n"
        "  2. Type 'proceed' to record as TODO and continue to Step 4\n"
        "  3. Type 'abort' to stop the workflow"
    )

    if user_input == "abort":
        raise WorkflowAborted("User aborted at Race Review")
    if user_input == "proceed":
        record_todo(current_findings)
        break
    # otherwise: apply user-provided resolutions → next round
    apply_user_resolutions(user_input)
    continue  # re-run the round with updated SPEC
```

## Narrowing scope (noise reduction)

To prevent LLM cosmetic noise from causing infinite loops while still reaching 100% quality:

| Round | Scope |
|-------|-------|
| 1 | Full scope (P1 + P2 + P3) |
| 2 | P1 + P2 only |
| 3+ | P1 only (until P1=0 or convergence) |

## 3.1 Review Loop (No Round Cap)

**Run GPT + Gemini in PARALLEL via Bash tool for each round. Stop when termination rules trigger.**

**🚨 IMPORTANT: SPEC content is too large for CLI arguments. Use --input file method (no pipe needed).**

**Procedure for each round:**

**Step A: Save SPEC content + prompt as JSON to scratchpad temp file (using Write tool):**
- Write JSON to `[SCRATCHPAD]/spec-review-input.json` with content:
```json
{"prompt": "Review this SPEC for completeness, specificity, testability, security, and performance. Round [N] (scope: [SCOPE]). Find issues and improvements. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. SPEC content: [SPEC_CONTENT]"}
```
- Where `[SPEC_CONTENT]` is the full SPEC text (properly JSON-escaped inside the prompt string)
- `[SCOPE]` is `P1+P2+P3` for round 1, `P1+P2` for round 2, `P1` for rounds 3+

**Step B: Script path:**
- `[LLM_SCRIPT]` = `{{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js`

**Step C: Run GPT + Gemini in PARALLEL (two separate Bash tool calls at once):**

```bash
# GPT review (Bash tool call 1)
node "[LLM_SCRIPT]" gpt orchestrate-json --input "[SCRATCHPAD]/spec-review-input.json"
```

```bash
# Gemini review (Bash tool call 2 - run in parallel with GPT)
node "[LLM_SCRIPT]" gemini orchestrate-json --input "[SCRATCHPAD]/spec-review-input.json"
```

**🚨 MANDATORY: Replace `[SCRATCHPAD]` with the actual scratchpad directory path.**
**🚨 Replace `[N]` with the current round number (1, 2, 3, ...).**
**🚨 Replace `[LLM_SCRIPT]` with the resolved absolute path from Step B.**
**🚨 Run GPT and Gemini calls in PARALLEL (two separate Bash tool calls at once).**

- Round 1: Write SPEC → Run GPT + Gemini in parallel (full scope) → Cross-validate → Apply fixes → Update SPEC file
- Round 2: Write updated SPEC → Run (P1+P2 scope) → Cross-validate → Apply fixes → Update SPEC file
- Round 3+: Write updated SPEC → Run (P1-only scope) → Cross-validate → Apply fixes → Continue until P1=0 AND no new findings (or convergence detected)

## 3.2 Cross-Validation Rules

| Agreement | Priority | Action |
|-----------|----------|--------|
| Both models agree (100%) | P1 | Auto-apply immediately |
| 1 model only (50%) | P2 | Auto-apply with note |

**After each round:**

1. Cross-validate findings (issues found by 2+ models → P1, single model → P2)
2. Merge feedback with confidence scores
3. Auto-apply P1/P2 improvements to SPEC and Feature files (use Edit tool)
4. Continue to next round with updated SPEC content

## 3.3 User Decision Checkpoint (After Convergence)

**🚨 MANDATORY: Run user judgment checkpoint when the review loop reaches convergence**

> Type 6 (Iterative-Reasoning) pattern: AI does not decide alone — judges together with the user

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 USER CHECKPOINT: Review Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Key changes found across {N} review rounds:

| # | Change | Source | Confidence |
|---|--------|--------|------------|
| 1 | {change1} | GPT+Gemini | 100% |
| 2 | {change2} | GPT only | 50% |
| ... | ... | ... | ... |

Questions:
1. Are there any changes above you'd like to exclude?
2. Are there any additional requirements that should be specified?
3. Do you agree with the technical approach?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Checkpoint action rules:**

| Situation | Action |
|-----------|--------|
| `ultrawork` mode | Skip checkpoint, auto-proceed |
| Normal mode | Must wait for user response |
| User requests changes | Apply changes, then re-run checkpoint |
| User approves | Proceed to Step 4 |

## Output format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 SPEC RACE REVIEW - Round 1 (scope: P1+P2+P3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Model Results:
| Model  | Issues | Duration |
|--------|--------|----------|
| GPT    | 2      | 1823ms   |
| Gemini | 2      | 2156ms   |

Cross-Validated Issues:
| Issue                    | GPT | Gemini | Codex | Confidence |
|--------------------------|-----|--------|-------|------------|
| Missing retry logic      | ✅  | ✅     | ✅    | 100% → P1  |
| Missing rate limiting    | ✅  | ✅     | ✅    | 100% → P1  |
| Token refresh unclear    | ✅  | ❌     | ❌    | 50% → P2   |

Auto-applying...
  ✅ [P1] Added retry logic (3 attempts, exponential backoff)
  ✅ [P1] Added rate limiting (100 req/min)
  ✅ [P2] Added token refresh flow

✅ Round 1 complete - 3 improvements (2 P1, 1 P2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 SPEC RACE REVIEW - Round 2 (scope: P1+P2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cross-Validated Issues:
| Issue                       | GPT | Gemini | Codex | Confidence |
|-----------------------------|-----|--------|-------|------------|
| Concurrent session unclear  | ✅  | ❌     | ❌    | 50% → P2   |

Auto-applying...
  ✅ [P2] Added concurrent session policy

✅ Round 2 complete - 1 improvement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 SPEC RACE REVIEW - Round 3 (scope: P1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cross-Validated Issues: None

✅ Converged: P1 = 0 AND no new findings
✅ Consensus Rate: 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

> If new P1s appear at round 3, the loop continues to round 4, 5, ... until convergence.

## Step 3.1: Codex Adversarial Review (When Codex Plugin Is Active)

> **Activation condition**: Automatically runs when Codex plugin is installed. Skipped if not installed.
> Runs **simultaneously** with GPT+Gemini Race Review for triple cross-validation.

Codex adversarial review **challenges the design decisions** in the SPEC:
- Validates whether an alternative architecture would be better
- Checks for over-engineering or under-engineering
- Identifies missing edge cases and non-functional requirements

**Execution (parallel with GPT+Gemini Race):**

```
/codex:adversarial-review
```

**Result integration**: Add Codex column to the Race Review cross-validation table:

```markdown
| Issue | GPT | Gemini | Codex | Confidence |
|-------|-----|--------|-------|------------|
| {issue} | ✅/❌ | ✅/❌ | ✅/❌ | {%} |
```

- 2 or more of 3 models agree → **High Confidence**
- Issue found only by Codex → **P2** (requires design perspective review)
- All 3 models agree → **P1** (fix immediately)
