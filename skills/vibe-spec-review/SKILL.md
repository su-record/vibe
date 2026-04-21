---
name: vibe-spec-review
tier: core
description: "Review and enhance an existing SPEC with GPT/Gemini cross-validation. Runs 100-point quality gate (loop until perfect or stuck), Race Review with convergence-based termination (no round cap), optional Codex adversarial review, Review Debate Team, and final user checkpoint. Must use this skill after vibe-spec completes, or when the user says 'review spec', '스펙 리뷰'."
triggers: ["spec review", "review spec", "SPEC 리뷰", "명세 리뷰", race review]
priority: 80
chain-next: []
---

# vibe-spec-review — SPEC Quality Review

Review and enhance SPEC with GPT/Gemini cross-validation.

**Purpose:** Run this skill after `vibe-spec` to ensure accurate review execution. For large contexts, invoke in a new session.

---

## Usage

This skill is automatically called in Phase 4 of the `/vibe.spec` orchestrator. If direct invocation is needed:

```
Load skill `vibe-spec-review` with feature: "feature-name"
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
Phase 4: vibe-spec-review skill (this) → Quality validation + GPT/Gemini review
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

See `reference/quality-gate.md` for the full 9-criteria checklist (Completeness, Specificity, Testability, Security, Performance), the no-round-cap loop pseudocode, stuck-case user prompt, and auto-fix rule table.

Core contract:
- Must reach 100/100 — no iteration cap
- Stuck (same score twice) → ask user (provide / proceed / abort), or `ultrawork` records TODO and continues
- Auto-fixes: missing AC → generate from Task; missing numbers → project defaults; ambiguous terms → replace with specifics

---

## Step 3: Race Review (GPT + Gemini Cross-Validation) — Convergence-Based

Run GPT + Gemini in parallel via `llm-orchestrate.js`, cross-validate findings, auto-apply fixes, loop until P1=0 AND no new findings.

See `reference/race-review.md` for the full procedure (llm-orchestrate bash templates, scope narrowing per round, stuck handling pseudocode, Codex triple-validation integration).

Core contract:
- No hard round cap — convergence-based termination (P1=0 AND no new findings)
- Scope narrowing: Round 1 full → Round 2 P1+P2 → Round 3+ P1-only
- Stuck (same findings across rounds) → user checkpoint (provide / proceed / abort), `ultrawork` auto-records TODO
- Cross-validation: 2+ models agree → P1 auto-apply; 1 model only → P2 with note
- After convergence: mandatory user checkpoint (skipped only in `ultrawork`)
- Codex plugin present → adversarial review runs in parallel for triple cross-validation

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
