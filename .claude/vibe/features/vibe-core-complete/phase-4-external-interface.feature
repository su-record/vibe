# Feature: Phase 4 - External Interface

**SPEC**: `.claude/vibe/specs/vibe-core-complete/phase-4-external-interface.md`
**Master Feature**: `.claude/vibe/features/vibe-core-complete/_index.feature`

## User Story (Phase Scope)

**As a** Vibe user
**I want** to send coding requests from Telegram, Web, or Webhook
**So that** I can work on my projects from anywhere, not just the terminal

## Scenarios

### Scenario 1: Setup Telegram bot
```gherkin
Scenario: Configure Telegram bot
  When I run "vibe telegram setup"
  Then I should be prompted to enter my bot token
  And the token should be securely stored via keytar (OS keychain) or encrypted vault
  And I should be prompted to set allowed chat IDs
```
**Verification**: SPEC AC #8

### Scenario 2: Receive Telegram text message
```gherkin
Scenario: Receive text message from Telegram
  Given the Telegram bot is configured
  And the Vibe daemon is running
  When I send "Fix the bug in login.ts" to the Telegram bot
  Then a new Job should be created
  And the Job should have intent "Fix the bug in login.ts"
```
**Verification**: SPEC AC #1

### Scenario 3: Receive Telegram voice message
```gherkin
Scenario: Convert voice to text via Gemini STT
  Given the Telegram bot is configured
  And Gemini is authenticated
  When I send a voice message to the Telegram bot
  Then the voice should be transcribed via Gemini STT
  And a Job should be created with the transcribed text
```
**Verification**: SPEC AC #2

### Scenario 4: Send response to Telegram
```gherkin
Scenario: Send Job result to Telegram
  Given a Job was created from Telegram
  When the Job completes
  Then the result should be sent back to the Telegram chat
  And code blocks should be formatted with Markdown
  And long responses should be split at 4096 characters
```
**Verification**: SPEC AC #1

### Scenario 5: Claude Code stream-json communication
```gherkin
Scenario: Communicate with Claude Code via stream-json
  Given a Job is being executed
  When the daemon communicates with Claude Code
  Then it should use "claude -p --input-format stream-json --output-format stream-json --verbose"
  And it should parse JSON responses
  And it should support bidirectional communication
```
**Verification**: SPEC AC #3

### Scenario 6: Multi-turn conversation
```gherkin
Scenario: Continue conversation across messages
  Given I started a conversation about "login feature"
  When I send a follow-up message "Add remember me checkbox"
  Then Claude Code should receive the message in the same session
  And the context should be preserved
```
**Verification**: SPEC AC #4

### Scenario 7: Handle permission request
```gherkin
Scenario: Forward permission request to Telegram
  Given a Job is executing via Telegram
  When Claude Code requests permission to modify a file
  Then the permission request should be forwarded to Telegram
  And I should be able to approve or deny via Telegram buttons
  And the response should be sent back to Claude Code
```
**Verification**: SPEC AC #5

### Scenario 8: Reject unauthorized chat
```gherkin
Scenario: Reject message from unauthorized chat
  Given the allowed chat ID is "123456"
  When a message arrives from chat ID "999999"
  Then the message should be ignored
  And no Job should be created
```
**Verification**: Edge case (security)

### Scenario 9: Web API create Job
```gherkin
Scenario: Create Job via Web API
  Given the Web server is running on port 7860
  When I POST to "/api/job" with body {"request": "Add tests"}
  Then a new Job should be created
  And I should receive the Job ID in the response
```
**Verification**: SPEC AC #6 (optional)

### Scenario 10: WebSocket real-time updates
```gherkin
Scenario: Receive real-time updates via WebSocket
  Given I am connected to WebSocket at "/ws"
  When a Job status changes
  Then I should receive the update in real-time
  And I should receive streaming output from Claude Code
```
**Verification**: SPEC AC #6 (optional)

### Scenario 11: Webhook receive
```gherkin
Scenario: Receive GitHub webhook
  Given a webhook is configured for "github-push"
  When GitHub sends a push event
  Then the webhook should verify the HMAC signature
  And a Job should be created based on the event
```
**Verification**: SPEC AC #7 (optional)

### Scenario 12: List active interfaces
```gherkin
Scenario: List active interfaces
  Given Telegram and Web interfaces are enabled
  When I run "vibe interface list"
  Then I should see "telegram: enabled"
  And I should see "web: enabled"
  And I should see "webhook: disabled"
```
**Verification**: SPEC AC #8

### Scenario 13: Handle Telegram API failure
```gherkin
Scenario: Recover from Telegram API failure
  Given the Telegram bot is running
  When the Telegram API becomes unreachable
  Then the bot should retry connection up to 3 times with exponential backoff (1s/2s/4s)
  And if all retries fail, the polling should pause
  And an error should be logged to daemon.log
  And the daemon should continue running other interfaces
```
**Verification**: Error handling

### Scenario 14: Handle Claude Code process crash
```gherkin
Scenario: Recover from Claude Code process crash
  Given a Job is executing via Claude Code
  When the Claude Code process crashes (exit code != 0)
  Then the session manager should attempt restart (max 2 times)
  And if restart fails, the Job should transition to "failed"
  And the originating client should be notified of the failure
  And the error details should be logged
```
**Verification**: Error handling

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-8 (telegram setup) | ⬜ |
| 2 | AC-1 (telegram text) | ⬜ |
| 3 | AC-2 (telegram voice) | ⬜ |
| 4 | AC-1 (telegram response) | ⬜ |
| 5 | AC-3 (stream-json) | ⬜ |
| 6 | AC-4 (multi-turn) | ⬜ |
| 7 | AC-5 (permission) | ⬜ |
| 8 | Edge (unauthorized) | ⬜ |
| 9 | AC-6 (web API) | ⬜ |
| 10 | AC-6 (websocket) | ⬜ |
| 11 | AC-7 (webhook) | ⬜ |
| 12 | AC-8 (interface list) | ⬜ |
| 13 | Error (Telegram API failure) | ⬜ |
| 14 | Error (Claude Code crash) | ⬜ |
