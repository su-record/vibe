---
name: vibe.spec.review
tier: core
description: "Review and enhance an existing SPEC with GPT/Gemini cross-validation. Runs 100-point quality gate (loop until perfect or stuck), Race Review with convergence-based termination (no round cap), optional Codex adversarial review, Review Debate Team, and final user checkpoint. Must use this skill after vibe.spec completes, or when the user says 'review spec', '스펙 리뷰'."
triggers: ["spec review", "review spec", "SPEC 리뷰", "명세 리뷰", race review]
priority: 80
chain-next: []
---

# vibe.spec.review — SPEC Quality Review

Review and enhance SPEC with GPT/Gemini cross-validation.

**Purpose:** Run this skill after `vibe.spec` to ensure accurate review execution. For large contexts, invoke in a new session.

---

## Usage

This skill is automatically called in Phase 4 of the `/vibe.spec` orchestrator. If direct invocation is needed:

```
Load skill `vibe.spec.review` with feature: "feature-name"
```

Or via natural language trigger: "스펙 리뷰", "review spec", "명세 리뷰".

**Prerequisites:**
- SPEC file exists: `.claude/vibe/specs/{feature-name}.md` (single) or `.claude/vibe/specs/{feature-name}/_index.md` (split)
- Feature file exists: `.claude/vibe/features/{feature-name}.feature` (single) or `.claude/vibe/features/{feature-name}/_index.feature` (split)

---

## Codex Plugin Integration

> **Codex plugin detection**: Auto-detected at workflow start with the command below.
>
> ```bash
> CODEX_AVAILABLE=$(node "{{VIBE_PATH}}/hooks/scripts/codex-detect.js" 2>/dev/null || echo "unavailable")
> ```
>
> If `available`, `/codex:adversarial-review` is automatically invoked. If `unavailable`, falls back to the existing GPT+Gemini workflow.

---

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

**`.last-feature` pointer update** (immediately after Timer):

```
Write ".claude/vibe/.last-feature" ← feature-name (one line)
If the value is already the same, no-op.
```

## Workflow

```
/vibe.spec "feature" → SPEC created (Phase 3)
        ↓
Phase 4: vibe.spec.review skill (this) → Quality validation + GPT/Gemini review
        ↓
    /vibe.run "feature"
```

**For large contexts**: After `/new`, re-enter `/vibe.spec "feature"` → Smart Resume will start from Phase 4.

---

## File Reading Policy (Mandatory)

- **Delegate SPEC reading to sub-agents** — Do NOT read all SPEC/Feature files in main session
- **Split structure (3+ phases)**: Use `Task(subagent_type="explorer-medium")` to read and summarize
- **Single file structure**: Main session may Read directly (small enough)
- **Never use Grep** for content analysis — Grep is for file location only
- **Agent spawn rule**: Include "Read target files FULLY with Read tool" in agent prompts

## Step 1: Load SPEC Files

Detect SPEC structure (single file or split folder) and read files:

**Single file structure:**
```
.claude/vibe/specs/{feature-name}.md
.claude/vibe/features/{feature-name}.feature
```

**Split folder structure:**
```
.claude/vibe/specs/{feature-name}/_index.md      (+ phase files)
.claude/vibe/specs/{feature-name}/phase-*.md     (phase-1-xxx.md, phase-2-xxx.md, ...)
.claude/vibe/features/{feature-name}/_index.feature (+ phase files)
.claude/vibe/features/{feature-name}/phase-*.feature
```

**Detection logic:**
1. Check if `.claude/vibe/specs/{feature-name}/` directory exists → Split mode
2. Otherwise check `.claude/vibe/specs/{feature-name}.md` → Single mode
3. If neither exists → Error

**Split mode file loading:**
1. Read `_index.md` for master SPEC overview
2. Glob `phase-*.md` files and read all phase SPECs
3. Read corresponding `_index.feature` and `phase-*.feature` files

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SPEC REVIEW: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Loading files...
  Mode: {single|split}
  ✅ SPEC: .claude/vibe/specs/{feature-name}.md (or _index.md + N phase files)
  ✅ Feature: .claude/vibe/features/{feature-name}.feature (or _index.feature + N phase files)

Extracted info:
  - Feature: {feature description}
  - Stack: {tech stack}
  - Phases: {number of phases}
  - Scenarios: {number of scenarios}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 2: Quality Validation (100-Point Gate)

**🚨 MANDATORY: Score must reach 100 to proceed. Loop until perfect or stuck.**

### 2.1 Quality Checklist

| Category | Check Item | Weight |
|----------|------------|--------|
| **Completeness** | All user flows included in Task | 15% |
| **Completeness** | All ACs converted to Feature scenarios | 10% |
| **Completeness** | Error handling scenarios defined | 10% |
| **Specificity** | All numbers specified (timeout, limits, etc.) | 15% |
| **Specificity** | No ambiguous terms ("appropriate", "proper", etc.) | 10% |
| **Testability** | Each AC is verifiable | 10% |
| **Testability** | Feature scenarios have concrete Given/When/Then | 10% |
| **Security** | Auth/permission requirements specified | 10% |
| **Performance** | Response time/load requirements specified | 10% |

### 2.2 Quality Gate Loop (No Round Cap)

```python
iteration = 0
prev_score = -1

while True:
    iteration += 1
    score = calculate_quality_score(spec, feature)

    print(f"━━━ Quality Check [{iteration}] ━━━")
    print(f"Score: {score}/100")

    if score >= 100:
        print("✅ Quality Gate PASSED (100/100)")
        break

    # Auto-fixer hit a wall → ask the user (prevents runaway AND respects 100 target)
    if score == prev_score:
        missing_items = identify_missing_items(spec)
        print(f"⚠️ Auto-fixer limit reached: stuck at {score}/100")
        print(f"Remaining items require human input:")
        for item in missing_items:
            print(f"  ❌ {item}")

        if ultrawork_mode:
            # ultrawork: no user intervention, record TODO and proceed
            print("ℹ️ ultrawork mode — recording gaps to TODO and proceeding")
            record_todo(missing_items)
            break

        # Interactive: ask the user to fill in or explicitly approve
        user_input = ask_user(
            "Please either:\n"
            "  1. Provide values for the remaining items (I'll apply them)\n"
            "  2. Type 'proceed' to accept current score and continue\n"
            "  3. Type 'abort' to stop the workflow"
        )

        if user_input == "abort":
            raise WorkflowAborted("User aborted at Quality Gate")
        if user_input == "proceed":
            record_todo(missing_items)
            break
        # otherwise: apply user-provided values → re-evaluate
        apply_user_values(user_input)
        continue

    prev_score = score

    # Auto-fix missing items
    missing_items = identify_missing_items(spec)
    for item in missing_items:
        auto_fix(item)
        update_spec()
        update_feature()

    print(f"✅ Applied {len(missing_items)} fixes - Re-evaluating...")
```

**Termination conditions:**
- `score == 100` → pass (primary success)
- `score == prev_score` (auto-fixer stuck) → **ask the user**:
  - User provides values → re-evaluate (loop continues, may reach 100)
  - User says "proceed" → record gaps as TODO and continue to Step 3
  - User says "abort" → stop entire workflow
  - `ultrawork` mode → skip prompt, auto-record TODO and continue
- No iteration cap — the only way to exit without 100 is explicit user approval or ultrawork.

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUALITY GATE [1]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 87/100 ⚠️ BELOW 100

Missing items:
  ❌ Error handling scenarios (10%)
  ❌ Performance targets (5%)

Auto-fixing...
  ✅ Added network error handling scenario
  ✅ Added response time targets (<500ms)

Re-evaluating...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUALITY GATE [2]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 96/100 ⚠️ BELOW 100

Missing items:
  ❌ Concurrent session policy (4%)

Auto-fixing...
  ✅ Added concurrent session policy

Re-evaluating...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUALITY GATE [3]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 100/100 ✅ PASSED

✅ Quality Gate PASSED - proceeding to GPT/Gemini review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Stuck case (auto-fixer limit reached):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUALITY GATE [4]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 87/100 ⚠️ STUCK (same as previous iteration)

Auto-fixer hit a wall. These items need human input:
  ❌ Business rule: monthly subscription renewal grace period (days?)
  ❌ Target latency for search API (<?ms)
  ❌ Data retention policy for audit logs (how many days?)

How would you like to proceed?
  1. Provide the values directly (e.g., "grace period 7 days, search 500ms, audit logs 90 days")
     → Values will be applied and the score re-evaluated (100 may be reachable)
  2. "proceed" — Accept the current score, record remaining items as TODO, then continue to Step 3
  3. "abort" — Stop the workflow

(In ultrawork mode, this prompt is skipped — TODO is auto-recorded and execution continues)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2.3 Auto-Fix Rules

| Missing Item | Auto-Fix Method |
|--------------|-----------------|
| Missing AC | Auto-generate AC based on Task |
| Numbers not specified | Apply project defaults (timeout 30s, etc.) |
| Missing error handling | Add common error scenarios |
| Missing performance targets | Apply industry standard criteria |
| Missing security | Add auth/data protection requirements |
| Ambiguous terms | Replace with specific values |

---

## Step 3: Race Review (GPT + Gemini Cross-Validation) - Convergence-Based (No Round Cap)

**RULES FOR RACE REVIEW:**

1. **YOU MUST** use the Bash tool to call `llm-orchestrate.js` directly
2. **DO NOT** simulate or fake review results
3. Run rounds sequentially (each round uses updated SPEC)
4. **No hard round cap** — loop until P1=0 AND no new findings (convergence)

> Race Mode reviews SPEC with GPT and Gemini in parallel, then cross-validates findings for higher confidence. The loop continues until quality converges naturally.

### Termination Rules

- **P1 = 0 AND no new findings this round** → converged, stop (primary success)
- **Round 1 with P1 = 0 AND no P2/P3** → perfect on first try, stop (early success)
- **Round N findings == Round N-1 findings** → **stuck**: LLMs keep flagging same issues that auto-applier can't resolve → **ask the user** (see 3.2.1)

### Stuck Handling (3.2.1)

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

### Narrowing Scope (Noise Reduction)

To prevent LLM cosmetic noise from causing infinite loops while still reaching 100% quality:

| Round | Scope |
|-------|-------|
| 1 | Full scope (P1 + P2 + P3) |
| 2 | P1 + P2 only |
| 3+ | P1 only (until P1=0 or convergence) |

### 3.1 Review Loop (No Round Cap)

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

### 3.2 Cross-Validation Rules

| Agreement | Priority | Action |
|-----------|----------|--------|
| Both models agree (100%) | P1 | Auto-apply immediately |
| 1 model only (50%) | P2 | Auto-apply with note |

**After each round:**

1. Cross-validate findings (issues found by 2+ models → P1, single model → P2)
2. Merge feedback with confidence scores
3. Auto-apply P1/P2 improvements to SPEC and Feature files (use Edit tool)
4. Continue to next round with updated SPEC content

### 3.3 User Decision Checkpoint (After Convergence)

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

**Output format:**
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

### Step 3.1: Codex Adversarial Review (When Codex Plugin Is Active)

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

---

## Step 3.5: Review Debate Team (Agent Teams)

> **Team definition**: See `agents/teams/review-debate-team.md` (SPEC Review context)
> **Condition**: Agent Teams enabled + 2 or more P1/P2 issues found after review loop convergence

**Activation conditions:**

| Situation | Action |
|-----------|--------|
| 2 or more P1/P2 issues | Auto-activate |
| 1 or fewer P1/P2 issues | Skip → proceed to Step 4 |
| Agent Teams disabled | Skip → proceed to Step 4 |

**Result integration:**
- Apply team consensus results to SPEC (P1 applied immediately, P2 added as notes)
- Team member shutdown_request → clean up with TeamDelete
- Proceed to Step 4 (Final Summary)

---

## Step 4: Final Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SPEC REVIEW COMPLETE: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quality Score: 100/100 ✅
Review Rounds: {N} (converged: P1=0, no new findings) ✅
Total Improvements: {M}
⏱️ Started: {start_time}
⏱️ Completed: {getCurrentTime result}

Updated files:
  📋 .claude/vibe/specs/{feature-name}.md (or split folder)
  📋 .claude/vibe/features/{feature-name}.feature (or split folder)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 5: SPEC Summary for User Review

**🚨 MANDATORY: Always output this summary before proceeding to `/vibe.run`.**

After all review rounds, present the finalized SPEC to the user in a readable format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SPEC SUMMARY: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Feature Overview
{1-2 line summary of feature purpose from SPEC's <role> and <context>}

## Tech Stack
{Tech stack list extracted from <context>}

## Implementation Phases
| Phase | Name | Key Tasks |
|-------|------|-----------|
| 1 | {phase name} | {1-line summary of core task} |
| 2 | {phase name} | {1-line summary of core task} |
| ... | ... | ... |

## Key Scenarios ({N} total)
{Scenario name list from Feature file}
- Scenario: {name1}
- Scenario: {name2}
- ...

## Key Constraints
{3-5 key items from <constraints>}

## Acceptance Criteria
{Summary of key items from <acceptance>}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If anything above is incorrect, please request changes.
If no issues, proceed with /vibe.run "{feature-name}".
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Important:**

- List ALL Phases, Scenarios, and Constraints from SPEC without omission
- Keep it concise for quick user review
- Wait for user confirmation after review (unless ultrawork mode)
- In ultrawork mode: output summary then auto-proceed to `/vibe.run`

### 5.1 Final User Checkpoint

**🚨 MANDATORY: Final user confirmation before proceeding to `/vibe.run`**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SPEC Review Complete - Final Confirmation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please answer the following questions:

1. **Requirements accuracy**: Does the SPEC above accurately describe the originally intended feature?
2. **Scope appropriateness**: Is the implementation scope neither too large nor too small?
3. **Tech stack**: Do you agree with the chosen tech stack?
4. **Priority**: Is the Phase order and priority correct?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Type "ok" or "proceed" to approve / share any changes you'd like made
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Why This Checkpoint Matters:**

> More AI doing more is not always better.
> The best results come when the user thinks and judges together with AI.
> This checkpoint induces the Type 6 (Iterative-Reasoning) pattern.

---

## Next Step

```
/vibe.run "{feature-name}"
```

---

## Error Handling

### SPEC Not Found
```
❌ ERROR: SPEC file not found

Expected (single): .claude/vibe/specs/{feature-name}.md
Expected (split):  .claude/vibe/specs/{feature-name}/_index.md

Please run /vibe.spec "{feature-name}" first to create the SPEC.
```

### Feature Not Found
```
❌ ERROR: Feature file not found

Expected (single): .claude/vibe/features/{feature-name}.feature
Expected (split):  .claude/vibe/features/{feature-name}/_index.feature

Please run /vibe.spec "{feature-name}" first to create the Feature file.
```

### GPT/Gemini Call Failed
```
⚠️ WARNING: {GPT|Gemini} call failed

Error: {error message}

Continuing with {other model} results only...
```

---

## Quick Mode

For faster iteration (1 round only): pass `--quick` flag when invoking the skill (or via `/vibe.spec "feature-name" --quick` orchestrator).

---

ARGUMENTS: $ARGUMENTS

**File Detection (execute before Step 1):**

```
Feature name: $ARGUMENTS

1. Check split folder: .claude/vibe/specs/$ARGUMENTS/_index.md
   - If exists → Split mode (read all files in folder)
2. Check single file: .claude/vibe/specs/$ARGUMENTS.md
   - If exists → Single mode
3. Neither exists → Show error with both expected paths
```
