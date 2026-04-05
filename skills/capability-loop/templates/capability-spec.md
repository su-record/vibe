# Capability Spec: {{CAPABILITY_NAME}}

**Date**: {{DATE}}
**Origin**: {{FAILURE_ANALYSIS_FILE}}
**Category**: {{TOOL | GUARDRAIL | ABSTRACTION | DOCUMENTATION | FEEDBACK}}
**Priority**: {{P1 | P2 | P3}}

---

## Problem Statement

**Failure this solves**: {{FAILURE_DESCRIPTION}}

**Without this capability:**
{{WITHOUT_CAPABILITY_DESCRIPTION}}

**With this capability:**
{{WITH_CAPABILITY_DESCRIPTION}}

---

## Specification

### What It Does

{{CAPABILITY_DESCRIPTION_DETAILED}}

### Inputs

| Input | Type | Source | Required |
|-------|------|--------|----------|
| {{INPUT_1}} | {{TYPE_1}} | {{SOURCE_1}} | {{YES/NO}} |
| {{INPUT_2}} | {{TYPE_2}} | {{SOURCE_2}} | {{YES/NO}} |

### Outputs

| Output | Type | Format | Notes |
|--------|------|--------|-------|
| {{OUTPUT_1}} | {{TYPE_1}} | {{FORMAT_1}} | {{NOTES_1}} |

### Behavior

1. {{BEHAVIOR_STEP_1}}
2. {{BEHAVIOR_STEP_2}}
3. {{BEHAVIOR_STEP_3}}

### Error Cases

| Condition | Behavior |
|-----------|----------|
| {{ERROR_CASE_1}} | {{ERROR_BEHAVIOR_1}} |
| {{ERROR_CASE_2}} | {{ERROR_BEHAVIOR_2}} |

---

## Implementation Plan

### Files to Create

- `{{NEW_FILE_1}}` — {{PURPOSE_1}}
- `{{NEW_FILE_2}}` — {{PURPOSE_2}}

### Files to Modify

- `{{MODIFIED_FILE_1}}` — {{CHANGE_DESCRIPTION_1}}

### Integration Points

- Triggers on: {{TRIGGER_CONDITION}}
- Called by: {{CALLER}}
- Calls into: {{DEPENDENCIES}}

---

## Acceptance Criteria

- [ ] {{ACCEPTANCE_CRITERION_1}}
- [ ] {{ACCEPTANCE_CRITERION_2}}
- [ ] {{ACCEPTANCE_CRITERION_3}}
- [ ] Original failure scenario no longer occurs
- [ ] Existing functionality unaffected (regression tests pass)

---

## Verification Plan

**Test to add**: `{{TEST_FILE}}` — `{{TEST_DESCRIPTION}}`

**Manual verification steps:**
1. {{VERIFY_STEP_1}}
2. {{VERIFY_STEP_2}}

---

## Persistence

After building, record in `.claude/vibe/capabilities-log.md`:

```markdown
## {{DATE}} — {{CAPABILITY_NAME}}

**Failure**: {{FAILURE_SHORT}}
**Missing**: {{MISSING_CAPABILITY_SHORT}}
**Built**: {{WHAT_WAS_BUILT}}
**Files**: {{FILES_LIST}}
**Prevents**: {{FAILURE_CLASS}}
```

Save to memory:
```
save_memory("capability-{{CAPABILITY_NAME}}", {
  "failure": "{{FAILURE_SHORT}}",
  "diagnosis": "{{MISSING_CAPABILITY_SHORT}}",
  "category": "{{CATEGORY}}",
  "solution": "{{WHAT_WAS_BUILT}}",
  "files_changed": [{{FILES_LIST}}]
})
```
