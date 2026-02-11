# Feature: Phase 1 - Agent Engine (상주 데몬)

**SPEC**: `.claude/vibe/specs/vibe-core-complete/phase-1-agent-engine.md`
**Master Feature**: `.claude/vibe/features/vibe-core-complete/_index.feature`

## User Story (Phase Scope)

**As a** Vibe user
**I want** a background daemon that stays running
**So that** external interfaces can send requests at any time

## Scenarios

### Scenario 1: Start daemon successfully
```gherkin
Scenario: Start Vibe daemon
  Given the Vibe daemon is not running
  When I run "vibe daemon start"
  Then the daemon process should be running in the background
  And a PID file should exist at "~/.vibe/daemon.pid"
  And a Unix socket should be listening at "~/.vibe/daemon.sock"
```
**Verification**: SPEC AC #1

### Scenario 2: Stop daemon gracefully
```gherkin
Scenario: Stop Vibe daemon
  Given the Vibe daemon is running
  When I run "vibe daemon stop"
  Then the daemon process should receive SIGTERM
  And the daemon should complete ongoing tasks within 10 seconds
  And the PID file should be removed
  And the Unix socket should be closed
```
**Verification**: SPEC AC #2

### Scenario 3: Check daemon status
```gherkin
Scenario: Check daemon status
  Given the Vibe daemon is running
  When I run "vibe daemon status"
  Then I should see the daemon PID
  And I should see the uptime
  And I should see the number of active sessions
  And I should see memory usage
```
**Verification**: SPEC AC #3

### Scenario 4: IPC communication
```gherkin
Scenario: Send request via Unix socket
  Given the Vibe daemon is running
  When I send a JSON-RPC request to the Unix socket
  Then I should receive a JSON-RPC response
  And the response should match the request ID
```
**Verification**: SPEC AC #4

### Scenario 5: Claude Code session pooling
```gherkin
Scenario: Reuse Claude Code session for same project
  Given the Vibe daemon is running
  And I have sent a request for project "/path/to/project"
  When I send another request for the same project
  Then the daemon should reuse the existing Claude Code session
  And the session should maintain OAuth authentication
```
**Verification**: SPEC AC #5

### Scenario 6: Idle session cleanup
```gherkin
Scenario: Clean up idle sessions
  Given the Vibe daemon is running
  And a Claude Code session has been idle for 30 minutes
  When the cleanup timer runs
  Then the idle session should be terminated
  And resources should be freed
```
**Verification**: SPEC AC #5

### Scenario 7: Daemon already running
```gherkin
Scenario: Attempt to start daemon when already running
  Given the Vibe daemon is running
  When I run "vibe daemon start"
  Then I should see a warning message
  And the existing daemon should continue running
```
**Verification**: Edge case

### Scenario 8: Zombie process detection
```gherkin
Scenario: Detect and handle zombie PID file
  Given a stale PID file exists at "~/.vibe/daemon.pid"
  And the process with that PID is not a Vibe daemon
  When I run "vibe daemon start"
  Then the stale PID file should be removed
  And a new daemon should start
```
**Verification**: Edge case

### Scenario 9: Session failure recovery
```gherkin
Scenario: Recover from Claude Code session failure
  Given the Vibe daemon is running
  And a Claude Code session encounters a network error
  When the session manager detects the failure
  Then the session should attempt reconnection (max 3 times)
  And the retry should use exponential backoff
  And if recovery fails, the client should be notified
  And the error should be logged to daemon.log
```
**Verification**: Error handling

### Scenario 10: IPC timeout handling
```gherkin
Scenario: Handle IPC request timeout
  Given the Vibe daemon is running
  When I send a request that takes longer than 30 seconds
  Then the request should timeout
  And I should receive a timeout error response
  And the daemon should remain stable
```
**Verification**: Error handling

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (daemon start) | ⬜ |
| 2 | AC-2 (daemon stop) | ⬜ |
| 3 | AC-3 (daemon status) | ⬜ |
| 4 | AC-4 (IPC) | ⬜ |
| 5 | AC-5 (session pooling) | ⬜ |
| 6 | AC-5 (session cleanup) | ⬜ |
| 7 | Edge (already running) | ⬜ |
| 8 | Edge (zombie detection) | ⬜ |
| 9 | Error (session recovery) | ⬜ |
| 10 | Error (IPC timeout) | ⬜ |
