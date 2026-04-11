---
name: systematic-debugging
tier: core
description: "Enforce reproduce-first, root-cause-first, failing-test-first debugging. Auto-activates on bug, error, fail, broken, crash, flaky keywords."
triggers: [bug, error, fail, broken, crash, flaky, not working, regression, unexpected, stack trace, exception, debug]
priority: 90
---

# Systematic Debugging

## Hard Gates

These rules have NO exceptions:

1. **Never fix before reproducing or observing the failure.**
2. **State a root-cause hypothesis before changing code.**
3. **Write a failing test (or equivalent) before fixing.**
4. **Test one hypothesis at a time.**
5. **No "while I'm here" refactoring during a fix.**
6. **3 failed fixes → suspect structural issue, stop patching.**

These excuses are NOT allowed:
- "It looks simple, I'll just fix it"
- "No time, let me patch and move on"
- "This seems like the issue, let me just change it"

## Workflow

Follow this order strictly.

### Phase 1. Define The Problem

```text
Problem: <expected> but got <actual> under <condition>
```

Good: "Product detail API returns 500 when brand is null."
Bad: "Serializer is broken because brand mapping seems wrong."

### Phase 2. Reproduce Or Instrument

Priority:
1. Reproduce with existing test
2. Minimal integration test
3. Unit test
4. Reproduction script/command
5. Add logging/instrumentation to observe

Rules:
- Make reproduction path as small as possible.
- If UI-only bug, prefer reproducing at a lower layer.
- If flaky, add logging for inputs, timing, concurrency conditions.
- If can't reproduce, do NOT proceed to fix — increase observability first.

### Phase 3. Gather Evidence

Collect observable facts only:
- Full error message and stack trace
- Failing input values
- Recent changed files/commits
- Environment/config differences
- Call path and data flow

At each boundary (controller → service → repository), check:
- What came in?
- What went out?
- What was transformed?
- Under what condition does it break?

Do NOT fix before locating the problem.

### Phase 4. Isolate Root Cause

State exactly one candidate:

```text
Hypothesis: <root cause> because <evidence>
```

Good hypothesis conditions:
- Points to a single cause
- Connected to observed evidence
- Falsifiable with a small experiment

Bad: "Something async seems wrong" / "The whole serializer area is unstable"

### Phase 5. Lock The Failure

Before fixing, lock the failure:
1. Automated failing test (preferred)
2. Add regression case to existing test
3. Minimal reproduction script
4. Temporary log/assertion guard

The test MUST fail before fix, pass after fix.

### Phase 6. Single Fix

Allowed:
- Minimal code change addressing the root cause
- Minimal supporting changes for verification

Forbidden:
- Bundling multiple "related" fixes
- Refactoring alongside the fix
- Formatting/renaming/cleanup
- Adding null-guards without evidence
- Swallowing exceptions

If fix fails → go back to Phase 3. Previous hypothesis was wrong.

### Phase 7. Verify And Close

ALL must be true:
1. Original reproduction path no longer fails
2. New failing guard now passes
3. Related tests don't break
4. Fix addresses cause, not symptom

For flaky bugs: single pass is not enough. Repeat or vary conditions.

## Red Flags — Stop Immediately

If you think any of these, STOP and go back:

- "Let me just change this one line"
- "I'll check logs later, let me fix first"
- "I'll add the test later"
- "Let me fix this and that together"
- "The error is gone so it doesn't matter what caused it"

## Completion Checklist

- [ ] Problem defined in one sentence
- [ ] Failure reproduced or made observable
- [ ] Evidence collected
- [ ] Single root-cause hypothesis stated
- [ ] Failing guard created before fix
- [ ] Single fix applied
- [ ] Verified via same reproduction path
