# vibe.spec-review — Quality Gate (Step 2)

> 100-point gate. Loop until perfect or stuck. Full definition for Step 2 of the review flow; referenced from the main SKILL.md.

## Table of Contents

1. [Quality Checklist](#quality-checklist)
2. [Quality Gate Loop (no round cap)](#quality-gate-loop-no-round-cap)
3. [Output format](#output-format)
4. [Stuck case](#stuck-case-auto-fixer-limit-reached)
5. [Auto-Fix Rules](#auto-fix-rules)

---

## Quality Checklist

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

## Quality Gate Loop (No Round Cap)

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

## Output format

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

## Stuck case (auto-fixer limit reached)

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

## Auto-Fix Rules

| Missing Item | Auto-Fix Method |
|--------------|-----------------|
| Missing AC | Auto-generate AC based on Task |
| Numbers not specified | Apply project defaults (timeout 30s, etc.) |
| Missing error handling | Add common error scenarios |
| Missing performance targets | Apply industry standard criteria |
| Missing security | Add auth/data protection requirements |
| Ambiguous terms | Replace with specific values |
