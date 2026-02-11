# Feature: Phase 3 - Policy Engine

**SPEC**: `.claude/vibe/specs/vibe-core-complete/phase-3-policy-engine.md`
**Master Feature**: `.claude/vibe/features/vibe-core-complete/_index.feature`

## User Story (Phase Scope)

**As a** Vibe Core system
**I want** to evaluate every ActionPlan against policies
**So that** dangerous or unauthorized actions are blocked before execution

## Scenarios

### Scenario 1: Evaluate ActionPlan against policy
```gherkin
Scenario: Evaluate ActionPlan
  Given an ActionPlan to modify "src/config.ts"
  And the file-safety policy is active
  When the Policy Engine evaluates the plan
  Then I should receive a decision (approve/warn/reject)
  And I should receive a risk level
  And I should receive reasons for the decision
```
**Verification**: SPEC AC #1

### Scenario 2: Block dangerous file operations
```gherkin
Scenario: Block system path modification
  Given an ActionPlan to modify "/etc/hosts"
  When the Policy Engine evaluates the plan
  Then the decision should be "reject"
  And the reason should mention "system path"
```
**Verification**: SPEC AC #2 (file-safety)

### Scenario 3: Warn on sensitive file modification
```gherkin
Scenario: Warn on .env file modification
  Given an ActionPlan to modify ".env"
  When the Policy Engine evaluates the plan
  Then the decision should be "warn"
  And the reason should mention "sensitive file"
  And requiresApproval should be true
```
**Verification**: SPEC AC #2 (file-safety)

### Scenario 4: Block dangerous commands
```gherkin
Scenario: Block rm -rf command
  Given an ActionPlan with command "rm -rf /"
  When the Policy Engine evaluates the plan
  Then the decision should be "reject"
  And the reason should mention "dangerous command"
```
**Verification**: SPEC AC #2 (command-safety)

### Scenario 5: Warn on force push
```gherkin
Scenario: Warn on git push --force
  Given an ActionPlan with command "git push --force"
  When the Policy Engine evaluates the plan
  Then the decision should be "warn"
  And the reason should mention "force push"
```
**Verification**: SPEC AC #2 (command-safety)

### Scenario 6: Calculate risk level
```gherkin
Scenario: Calculate overall risk level
  Given an ActionPlan with multiple actions
  And one action has risk "low"
  And another action has risk "medium"
  When the Policy Engine calculates risk
  Then the overall risk level should be "medium" (highest)
```
**Verification**: SPEC AC #3

### Scenario 7: Record Evidence
```gherkin
Scenario: Record policy evaluation as Evidence
  Given an ActionPlan is evaluated
  When the evaluation completes
  Then an Evidence record should be stored in SQLite
  And the Evidence should contain the decision
  And the Evidence should contain the reasons
  And the Evidence should have a timestamp
```
**Verification**: SPEC AC #5

### Scenario 8: List policies via CLI
```gherkin
Scenario: List all policies
  When I run "vibe policy list"
  Then I should see built-in policies (file-safety, command-safety, resource-limit)
  And I should see user-defined policies if any
  And I should see which policies are enabled
```
**Verification**: SPEC AC #6

### Scenario 9: Enable/disable policy
```gherkin
Scenario: Disable a policy
  Given the "resource-limit" policy is enabled
  When I run "vibe policy disable resource-limit"
  Then the "resource-limit" policy should be disabled
  And built-in safety policies should remain enabled
```
**Verification**: SPEC AC #6

### Scenario 10: User custom policy
```gherkin
Scenario: Load user-defined policy
  Given a custom policy file exists at "~/.vibe/policies/no-deploy.json"
  When the Policy Engine loads policies
  Then the custom policy should be active
  And it should be evaluated alongside built-in policies
```
**Verification**: SPEC AC #7

### Scenario 11: Policy priority
```gherkin
Scenario: Project policy overrides user policy
  Given a user policy allows "production deploy"
  And a project policy denies "production deploy"
  When an ActionPlan includes "production deploy"
  Then the decision should be "reject" (project wins)
```
**Verification**: Edge case

### Scenario 12: Critical risk requires approval
```gherkin
Scenario: Critical risk always requires approval
  Given an ActionPlan with critical risk level
  When the Policy Engine evaluates the plan
  Then requiresApproval should be true
  And the Job should wait for user confirmation
```
**Verification**: Edge case

### Scenario 13: Handle corrupted policy file
```gherkin
Scenario: Handle corrupted policy file gracefully
  Given a corrupted JSON file exists at "~/.vibe/policies/broken.json"
  When the Policy Engine loads policies
  Then the corrupted file should be skipped
  And a warning should be logged
  And built-in policies should still be active
  And other valid user policies should still load
```
**Verification**: Error handling

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (evaluation) | ⬜ |
| 2 | AC-2 (file-safety reject) | ⬜ |
| 3 | AC-2 (file-safety warn) | ⬜ |
| 4 | AC-2 (command-safety reject) | ⬜ |
| 5 | AC-2 (command-safety warn) | ⬜ |
| 6 | AC-3 (risk calculation) | ⬜ |
| 7 | AC-5 (Evidence recording) | ⬜ |
| 8 | AC-6 (CLI list) | ⬜ |
| 9 | AC-6 (CLI enable/disable) | ⬜ |
| 10 | AC-7 (user policy) | ⬜ |
| 11 | Edge (priority) | ⬜ |
| 12 | Edge (critical approval) | ⬜ |
| 13 | Error (corrupted policy) | ⬜ |
