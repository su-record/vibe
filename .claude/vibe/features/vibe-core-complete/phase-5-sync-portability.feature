# Feature: Phase 5 - Sync & Portability

**SPEC**: `.claude/vibe/specs/vibe-core-complete/phase-5-sync-portability.md`
**Master Feature**: `.claude/vibe/features/vibe-core-complete/_index.feature`

## User Story (Phase Scope)

**As a** Vibe user with multiple devices
**I want** to sync my memory, policies, and settings across devices
**So that** I have a consistent Vibe experience everywhere

## Scenarios

### Scenario 1: Google OAuth login
```gherkin
Scenario: Authenticate with Google
  When I run "vibe sync login"
  Then a browser should open for Google OAuth
  And I should be able to authorize Vibe
  And the OAuth token should be stored at "~/.vibe/credentials/google.json"
```
**Verification**: SPEC AC #1

### Scenario 2: Push memory to cloud
```gherkin
Scenario: Push memory data to Google Drive
  Given I am authenticated with Google
  And I have local memory data
  When I run "vibe sync push"
  Then my SessionRAG data should be uploaded to "Vibe/memory/"
  And my KnowledgeGraph data should be uploaded
  And only changes since last sync should be uploaded
```
**Verification**: SPEC AC #2

### Scenario 3: Pull memory from cloud
```gherkin
Scenario: Pull memory data from Google Drive
  Given I am authenticated with Google
  And there is memory data in the cloud
  When I run "vibe sync pull"
  Then the cloud data should be downloaded
  And my local SessionRAG should be updated
  And conflicts should be detected and reported
```
**Verification**: SPEC AC #2

### Scenario 4: Sync policies
```gherkin
Scenario: Sync user policies
  Given I have a custom policy "no-deploy.json"
  When I run "vibe sync push"
  Then the policy file should be uploaded to "Vibe/policy/"
  And when I pull on another device, the policy should be available
```
**Verification**: SPEC AC #3

### Scenario 5: Sync settings (exclude credentials)
```gherkin
Scenario: Sync settings without credentials
  Given my settings include API keys and preferences
  When I run "vibe sync push"
  Then preferences should be uploaded
  But API keys should NOT be uploaded
  And OAuth tokens should NOT be uploaded
```
**Verification**: SPEC AC #4

### Scenario 6: Detect conflict
```gherkin
Scenario: Detect sync conflict
  Given I modified memory on device A
  And I modified the same memory on device B
  When I run "vibe sync pull" on device B
  Then a conflict should be detected
  And I should be notified of the conflict
```
**Verification**: SPEC AC #5

### Scenario 7: Resolve conflict (last-write-wins)
```gherkin
Scenario: Resolve conflict with last-write-wins
  Given there is a sync conflict
  And the conflict resolution is set to "last-write-wins"
  When the sync resolves
  Then the newer version should win
  And the older version should be backed up locally
```
**Verification**: SPEC AC #5

### Scenario 8: Resolve conflict (manual)
```gherkin
Scenario: Resolve conflict manually
  Given there is a sync conflict
  And the conflict resolution is set to "manual"
  When I run "vibe sync conflicts"
  Then I should see the conflicting items
  And I should be able to choose which version to keep
```
**Verification**: SPEC AC #5

### Scenario 9: List devices
```gherkin
Scenario: List synced devices
  Given I have synced from multiple devices
  When I run "vibe device list"
  Then I should see all devices that have synced
  And I should see each device's name and last sync time
```
**Verification**: SPEC AC #6

### Scenario 10: Rename device
```gherkin
Scenario: Rename current device
  When I run "vibe device rename 'MacBook Pro'"
  Then my device name should be updated
  And the new name should appear in device list
```
**Verification**: SPEC AC #6

### Scenario 11: Auto sync on daemon start
```gherkin
Scenario: Auto pull on daemon start
  Given I am authenticated with Google
  And auto-sync is enabled
  When the Vibe daemon starts
  Then it should automatically pull from cloud
  And any conflicts should be logged
```
**Verification**: SPEC AC #8

### Scenario 12: Auto sync periodically
```gherkin
Scenario: Periodic sync every 5 minutes
  Given the Vibe daemon is running
  And auto-sync is enabled
  When 5 minutes have passed
  Then changes should be pushed to cloud
```
**Verification**: SPEC AC #8

### Scenario 13: Offline mode
```gherkin
Scenario: Work offline without sync
  Given I have no network connection
  When I use Vibe
  Then all features should work locally
  And sync should be skipped without errors
  And changes should be queued for next sync
```
**Verification**: SPEC AC #9

### Scenario 14: Handle Google Drive API failure
```gherkin
Scenario: Recover from Google Drive API failure
  Given I am authenticated with Google
  When a sync operation encounters a Google Drive API error
  Then the operation should retry up to 3 times with exponential backoff (2s/4s/8s)
  And if all retries fail, local data should remain intact
  And the failure should be logged
  And the next periodic sync should attempt again
```
**Verification**: Error handling

### Scenario 15: Logout and remove sync
```gherkin
Scenario: Logout from sync
  Given I am authenticated with Google
  When I run "vibe sync logout"
  Then the OAuth token should be removed
  And local data should remain intact
  And auto-sync should be disabled
```
**Verification**: SPEC AC #1

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (OAuth login) | ⬜ |
| 2 | AC-2 (push memory) | ⬜ |
| 3 | AC-2 (pull memory) | ⬜ |
| 4 | AC-3 (sync policy) | ⬜ |
| 5 | AC-4 (sync settings) | ⬜ |
| 6 | AC-5 (detect conflict) | ⬜ |
| 7 | AC-5 (last-write-wins) | ⬜ |
| 8 | AC-5 (manual resolve) | ⬜ |
| 9 | AC-6 (list devices) | ⬜ |
| 10 | AC-6 (rename device) | ⬜ |
| 11 | AC-8 (auto pull) | ⬜ |
| 12 | AC-8 (periodic sync) | ⬜ |
| 13 | AC-9 (offline mode) | ⬜ |
| 14 | Error (Drive API failure) | ⬜ |
| 15 | AC-1 (logout) | ⬜ |
