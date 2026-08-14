# Step 4.5 — ESCALATE (VERIFY 실패 시)

> vibe.capability-loop SKILL.md Step 4 의 VERIFY 가 **실패했을 때만** 로드한다.
> VERIFY 가 통과한 호출(정상 경로)은 이 파일을 읽지 않는다.

### Step 4.5: ESCALATE — When VERIFY Fails

> **Problem**: The built capability didn't actually prevent the failure. This usually means the initial diagnosis was wrong (picked `Tool` when it needed `Guardrail`), or the failure has multiple missing capabilities.
>
> **Do NOT silently proceed** — a sub-standard capability log pollutes `.vibe/capabilities-log.md` and the failure will recur.

**Escalation loop:**

```python
tried = [current_diagnosis.category]  # e.g., ["Tool"]

while True:
    # Re-diagnose excluding already-tried categories
    next_diagnosis = diagnose(failure, exclude=tried)

    if next_diagnosis is None:
        # All 5 categories (Tool/Guardrail/Abstraction/Documentation/Feedback) exhausted
        escalate_to_user(failure, tried)
        break

    if next_diagnosis.category in tried:
        # Stuck: diagnose keeps returning the same category
        escalate_to_user(failure, tried)
        break

    tried.append(next_diagnosis.category)
    capability = build(next_diagnosis)

    if verify(capability, failure):
        persist(capability)
        return  # Success — go to Step 5

    # Still failing — next iteration
```

**User escalation prompt (interactive mode):**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CAPABILITY LOOP STUCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Failure: {original failure description}

Tried capabilities (all failed to prevent the failure):
  ❌ Tool: {what was built, why it didn't work}
  ❌ Guardrail: {what was built, why it didn't work}
  ❌ Documentation: {what was built, why it didn't work}

Automated diagnosis has run out of angles. This failure may require
human judgment (process issue, cross-category solution, or external factor).

How would you like to proceed?
  1. Suggest a different angle (e.g., "this is a process issue", "needs Tool+Guardrail combination")
     → Attempt custom approach per user instruction, then enter next verify
  2. "manual" — resolve this failure via manual intervention, end capability loop
     (record "escalated to manual" in capabilities-log.md)
  3. "abort" — give up, record failure only
     (record "diagnosis exhausted" in capabilities-log.md, do not halt the rest of the workflow)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**ultrawork mode exception:**

```python
if ultrawork_mode:
    # Skip user prompt: try all 5 categories in sequence, record final state
    all_tried_exhausted = exhaust_all_categories(failure, tried)
    record_failure_to_log(
        status="diagnosis_exhausted",
        tried=all_tried_exhausted,
        failure=failure
    )
    return  # Proceed without blocking downstream workflow
```

**Rollback of failed builds:**

- Each failed capability build should be rolled back before trying the next category (unless it's non-destructive documentation).
- For code additions (tool/guardrail/abstraction): `git checkout -- {files}` or delete created files.
- For docs-only additions: leave in place (low risk) but note in escalation prompt.
