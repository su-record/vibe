# Feature: openclaw-integration — Phase 1: Foundation

**SPEC**: `.claude/core/specs/openclaw-integration/phase-1-foundation.md`
**Master Feature**: `.claude/core/features/openclaw-integration/_index.feature`

## User Story (Phase Scope)
**As a** Vibe 개발자
**I want** 토큰 리프레시 시 file locking과 Gemini CLI 자동 임포트
**So that** 병렬 에이전트 실행 시 Race Condition이 방지되고, 기존 Gemini CLI 사용자가 추가 인증 없이 바로 사용할 수 있다

## Scenarios

### Scenario 1: Token Refresh with File Lock
```gherkin
Scenario: 병렬 에이전트의 동시 토큰 리프레시
  Given GPT OAuth 토큰이 만료된 상태
  And 2개의 병렬 에이전트가 동시에 실행 중
  When 두 에이전트가 동시에 getValidAccessToken()을 호출하면
  Then 하나의 에이전트만 실제 리프레시를 수행하고
  And 다른 에이전트는 lock 해제 후 갱신된 토큰을 사용한다
  And lock 파일이 자동으로 정리된다
```
**Verification**: SPEC AC #1, #2

### Scenario 2: Stale Lock Recovery
```gherkin
Scenario: 30초 이상된 stale lock 자동 해제
  Given 이전 프로세스 크래시로 lock 파일이 남아있는 상태
  And lock 파일 생성 시간이 30초 이상 지남
  When 새 리프레시 요청이 들어오면
  Then stale lock을 자동으로 해제하고
  And 정상적으로 리프레시를 수행한다
```
**Verification**: SPEC AC #3

### Scenario 3: Gemini CLI Credential Auto-Import
```gherkin
Scenario: Gemini CLI가 설치된 환경에서 자동 인증
  Given 사용자가 Gemini CLI를 설치하고 인증한 상태
  And ~/.gemini/oauth_creds.json 파일이 존재
  And Vibe에서 별도로 Gemini 인증을 하지 않음
  When getAuthInfo()를 호출하면
  Then Gemini CLI의 토큰이 자동으로 사용된다
```
**Verification**: SPEC AC #4

### Scenario 4: Gemini CLI Not Installed Fallback
```gherkin
Scenario: Gemini CLI가 없는 환경에서 기존 흐름 유지
  Given Gemini CLI가 설치되지 않은 상태
  And ~/.gemini/oauth_creds.json 파일이 없음
  When getAuthInfo()를 호출하면
  Then 에러 없이 기존 OAuth/API Key 흐름으로 진행한다
```
**Verification**: SPEC AC #5

### Scenario 5: Gemini Status with CLI Detection
```gherkin
Scenario: vibe gemini status에서 CLI 크레덴셜 감지 표시
  Given Gemini CLI가 설치되어 있고
  And Vibe에서 별도 인증을 하지 않은 상태
  When vibe gemini status를 실행하면
  Then "Gemini CLI credentials detected" 메시지가 표시된다
```
**Verification**: SPEC AC #6

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1, AC-2 | ✅ |
| 2 | AC-3 | ✅ |
| 3 | AC-4 | ✅ |
| 4 | AC-5 | ✅ |
| 5 | AC-6 | ✅ |
