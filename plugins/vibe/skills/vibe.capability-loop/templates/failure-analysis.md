# Failure Analysis: {{FAILURE_TITLE}}

**Date**: {{DATE}}
**Reporter**: {{REPORTER}}
**Occurrence count**: {{OCCURRENCE_COUNT}}
**First seen**: {{FIRST_SEEN_DATE}}

---

## Failure Description

**What happened:**
{{FAILURE_DESCRIPTION}}

**Expected behavior:**
{{EXPECTED_BEHAVIOR}}

**Actual behavior:**
{{ACTUAL_BEHAVIOR}}

**Reproduction steps:**
1. {{STEP_1}}
2. {{STEP_2}}
3. {{STEP_3}}

---

## Diagnosis

Answer all five questions:

### 1. Missing Tool?
> Did the agent lack a command, API, or utility to accomplish the task?

{{TOOL_DIAGNOSIS}}

- Missing: {{MISSING_TOOL_OR_NONE}}
- Where to build: {{TOOL_BUILD_LOCATION_OR_NA}}

### 2. Missing Guardrail?
> Should the agent have been prevented from doing this?

{{GUARDRAIL_DIAGNOSIS}}

- Missing: {{MISSING_GUARDRAIL_OR_NONE}}
- Where to build: {{GUARDRAIL_BUILD_LOCATION_OR_NA}}

### 3. Missing Abstraction?
> Was the agent repeating work that should be shared code?

{{ABSTRACTION_DIAGNOSIS}}

- Missing: {{MISSING_ABSTRACTION_OR_NONE}}
- Where to build: {{ABSTRACTION_BUILD_LOCATION_OR_NA}}

### 4. Missing Documentation?
> Did the agent lack knowledge that should be discoverable?

{{DOCUMENTATION_DIAGNOSIS}}

- Missing: {{MISSING_DOC_OR_NONE}}
- Where to add: {{DOC_LOCATION_OR_NA}}

### 5. Missing Feedback?
> Did the agent not know it was doing the wrong thing?

{{FEEDBACK_DIAGNOSIS}}

- Missing: {{MISSING_FEEDBACK_OR_NONE}}
- Where to add: {{FEEDBACK_LOCATION_OR_NA}}

---

## Root Cause

**Primary category**: {{TOOL | GUARDRAIL | ABSTRACTION | DOCUMENTATION | FEEDBACK}}

**Root cause statement**: {{ROOT_CAUSE_ONE_SENTENCE}}

**Contributing factors:**
- {{FACTOR_1}}
- {{FACTOR_2}}

---

## Capability to Build

**Capability name**: `{{CAPABILITY_NAME}}`

**What to build**: {{CAPABILITY_DESCRIPTION}}

**Build plan:**
1. {{BUILD_STEP_1}}
2. {{BUILD_STEP_2}}
3. {{BUILD_STEP_3}}

**Files to create/modify:**
- `{{FILE_1}}` — {{FILE_1_PURPOSE}}
- `{{FILE_2}}` — {{FILE_2_PURPOSE}}

---

## Verification

- [ ] Original failure reproduced before fix
- [ ] New capability prevents the failure
- [ ] Existing tests still pass
- [ ] New test added that would catch this failure class

---

## Prevents

This capability prevents the following class of failures:

> {{FAILURE_CLASS_DESCRIPTION}}

Estimated recurrence if not built: {{HIGH | MEDIUM | LOW}}
