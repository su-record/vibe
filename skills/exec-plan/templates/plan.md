# ExecPlan: {{FEATURE_NAME}}

## Meta

| Field | Value |
|-------|-------|
| SPEC | `.claude/vibe/specs/{{FEATURE_NAME}}.md` |
| Feature | `.claude/vibe/features/{{FEATURE_NAME}}.feature` |
| Generated | {{GENERATED_DATE}} |
| Phases | {{PHASE_COUNT}} |
| Scenarios | {{SCENARIO_COUNT}} |
| Estimated effort | {{EFFORT_ESTIMATE}} |

---

## Pre-flight Checks

Run these before starting any phase. All must pass.

- [ ] `npm run build` — clean build
- [ ] `npx vitest run` — baseline tests pass ({{BASELINE_TEST_COUNT}} tests)
- [ ] Required files exist:
  - `{{REQUIRED_FILE_1}}`
  - `{{REQUIRED_FILE_2}}`
- [ ] Dependencies installed: `{{DEPENDENCY_CHECK_COMMAND}}`

---

## Phase 1: {{PHASE_1_NAME}}

### Environment

| Item | Detail |
|------|--------|
| Files to modify | `{{PHASE_1_MODIFY_FILES}}` |
| Files to create | `{{PHASE_1_CREATE_FILES}}` |
| Dependencies | `{{PHASE_1_DEPENDENCIES}}` |
| Pattern to follow | See inline snippet below |

**Pattern (copy from codebase, do not paraphrase):**

```typescript
{{PHASE_1_PATTERN_SNIPPET}}
```

### Scenario 1.1: {{SCENARIO_1_1_NAME}}

**REQ**: {{REQ_ID}}

**Given**: {{GIVEN_CONDITION}}
→ Setup:
```typescript
{{SETUP_CODE}}
```

**When**: {{ACTION}}
→ Implement in `{{TARGET_FILE}}`, after line containing `{{ANCHOR_TEXT}}`:
```typescript
{{IMPLEMENTATION_SNIPPET}}
```
Imports needed: `{{IMPORTS_LIST}}`

**Then**: {{EXPECTED_RESULT}}
→ Verify:
```bash
{{VERIFY_COMMAND}}
```
Expected output: `{{EXPECTED_OUTPUT}}`
Fallback if fails: {{FALLBACK_INSTRUCTION}}

---

### Scenario 1.2: {{SCENARIO_1_2_NAME}}

**Given**: {{GIVEN_CONDITION}}
→ Setup: {{SETUP_INSTRUCTION}}

**When**: {{ACTION}}
→ Implement: {{IMPLEMENTATION_INSTRUCTION}}

**Then**: {{EXPECTED_RESULT}}
→ Verify: `{{VERIFY_COMMAND}}`

---

### Phase 1 Gate

- [ ] `npm run build` — no type errors
- [ ] `npx vitest run {{PHASE_1_TEST_FILES}}` — all pass
- [ ] `npx tsc --noEmit` — clean

---

## Phase 2: {{PHASE_2_NAME}}

### Environment

| Item | Detail |
|------|--------|
| Files to modify | `{{PHASE_2_MODIFY_FILES}}` |
| Files to create | `{{PHASE_2_CREATE_FILES}}` |
| Dependencies | `{{PHASE_2_DEPENDENCIES}}` |

### Scenario 2.1: {{SCENARIO_2_1_NAME}}

**Given**: {{GIVEN_CONDITION}}
→ Setup: {{SETUP_INSTRUCTION}}

**When**: {{ACTION}}
→ Implement: {{IMPLEMENTATION_INSTRUCTION}}

**Then**: {{EXPECTED_RESULT}}
→ Verify: `{{VERIFY_COMMAND}}`

---

### Phase 2 Gate

- [ ] `npm run build`
- [ ] `npx vitest run {{PHASE_2_TEST_FILES}}`
- [ ] `npx tsc --noEmit`

---

## Completion Criteria

- [ ] All scenarios passing
- [ ] Coverage: ≥ {{COVERAGE_THRESHOLD}}%
- [ ] No regressions in existing tests
- [ ] `npm run build` exits 0
- [ ] RTM generated: `generateTraceabilityMatrix("{{FEATURE_NAME}}")`

---

## Handoff (if incomplete)

Save state before ending session:

```
save_memory("execplan-{{FEATURE_NAME}}", {
  "last_completed": "Phase X, Scenario Y.Z",
  "next_step": "{{NEXT_STEP_DESCRIPTION}}",
  "blockers": "{{BLOCKERS_IF_ANY}}"
})
```

Resume: `/vibe.utils --continue` → load this file.
