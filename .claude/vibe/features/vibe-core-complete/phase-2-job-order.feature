# Feature: Phase 2 - Job/Order 시스템

**SPEC**: `.claude/vibe/specs/vibe-core-complete/phase-2-job-order.md`
**Master Feature**: `.claude/vibe/features/vibe-core-complete/_index.feature`

## User Story (Phase Scope)

**As a** Vibe Core system
**I want** to normalize all external requests into Jobs
**So that** every request goes through the same judgment pipeline

## Scenarios

### Scenario 1: Create Job from external request
```gherkin
Scenario: Create Job from natural language request
  Given the Vibe daemon is running
  When I send a request "Add login feature to my project"
  Then a new Job should be created with status "pending"
  And the Job should have a unique UUID
  And the Job should be stored in SQLite
```
**Verification**: SPEC AC #1

### Scenario 2: Job state transitions
```gherkin
Scenario: Job transitions through all states
  Given a Job is created with status "pending"
  When the Job is processed
  Then it should transition to "parsing" (Intent parsing)
  Then it should transition to "planning" (ActionPlan generation)
  Then it should transition to "evaluating" (Policy evaluation)
  Then it should transition to "approved" or "rejected"
  And if approved, it should transition to "executing"
  And finally to "completed" or "failed"
```
**Verification**: SPEC AC #2

### Scenario 3: Generate ActionPlan
```gherkin
Scenario: Generate ActionPlan from Intent
  Given a Job with intent "Add login feature"
  When the ActionPlan is generated
  Then the plan should contain specific actions
  And each action should have a type and target
  And the plan should have a risk_level (low/medium/high/critical)
  And the plan should have a confidence score (0-1)
```
**Verification**: SPEC AC #3

### Scenario 4: Job queue with priority
```gherkin
Scenario: Process Jobs by priority
  Given there are 3 Jobs in the queue
  And Job A has priority 1 (high)
  And Job B has priority 3 (low)
  And Job C has priority 2 (medium)
  When the queue processes Jobs
  Then Job A should be processed first
  Then Job C should be processed second
  Then Job B should be processed last
```
**Verification**: SPEC AC #4

### Scenario 5: Concurrent execution limit
```gherkin
Scenario: Limit concurrent Job execution
  Given the concurrency limit is 3
  And 5 Jobs are submitted
  When processing begins
  Then only 3 Jobs should be executing simultaneously
  And the remaining 2 Jobs should wait in queue
```
**Verification**: SPEC AC #4

### Scenario 6: List Jobs via CLI
```gherkin
Scenario: List all Jobs
  Given there are 5 Jobs in the system
  When I run "vibe job list"
  Then I should see all 5 Jobs
  And each Job should show ID, status, and created time
```
**Verification**: SPEC AC #5

### Scenario 7: Get Job status via CLI
```gherkin
Scenario: Get specific Job status
  Given a Job exists with ID "job-123"
  When I run "vibe job status job-123"
  Then I should see the Job details
  And I should see the current state
  And I should see the ActionPlan if generated
```
**Verification**: SPEC AC #5

### Scenario 8: Cancel running Job
```gherkin
Scenario: Cancel a running Job
  Given a Job with ID "job-123" is executing
  When I run "vibe job cancel job-123"
  Then the Job should transition to "cancelled" state
  And any running processes should be terminated gracefully
```
**Verification**: SPEC AC #5

### Scenario 9: Job retry on failure
```gherkin
Scenario: Retry failed Job
  Given a Job fails during execution
  And the failure is retryable
  When the retry logic runs
  Then the Job should be retried up to 3 times
  And each retry should be logged
```
**Verification**: Edge case

### Scenario 10: Job history persistence
```gherkin
Scenario: Job history is persisted
  Given a Job was completed yesterday
  When I restart the Vibe daemon
  And I run "vibe job list --all"
  Then the completed Job should still be visible
```
**Verification**: SPEC AC #6

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (Job creation) | ⬜ |
| 2 | AC-2 (state machine) | ⬜ |
| 3 | AC-3 (ActionPlan) | ⬜ |
| 4 | AC-4 (priority queue) | ⬜ |
| 5 | AC-4 (concurrency) | ⬜ |
| 6 | AC-5 (CLI list) | ⬜ |
| 7 | AC-5 (CLI status) | ⬜ |
| 8 | AC-5 (CLI cancel) | ⬜ |
| 9 | Edge (retry) | ⬜ |
| 10 | AC-6 (persistence) | ⬜ |
