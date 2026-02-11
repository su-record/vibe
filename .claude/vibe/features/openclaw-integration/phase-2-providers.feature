# Feature: openclaw-integration — Phase 2: New Provider (Kimi)

**SPEC**: `.claude/core/specs/openclaw-integration/phase-2-providers.md`
**Master Feature**: `.claude/core/features/openclaw-integration/_index.feature`

## User Story (Phase Scope)
**As a** Vibe 사용자
**I want** Kimi(Moonshot)를 LLM 프로바이더로 추가
**So that** 무료 LLM을 활용하여 멀티 오케스트레이션의 폭을 넓히고 비용을 절감할 수 있다

## Scenarios

### Scenario 1: Kimi API Key Setup
```gherkin
Scenario: vibe kimi key로 API 키 설정
  Given Moonshot API Key가 "sk-test123"
  When vibe kimi key sk-test123을 실행하면
  Then API Key가 ~/.config/vibe/kimi-apikey.json에 저장되고
  And 파일 권한이 0o600이다
```
**Verification**: SPEC AC #1

### Scenario 2: Kimi Status Check
```gherkin
Scenario: vibe kimi status로 상태 확인
  Given Kimi API Key가 저장된 상태
  When vibe kimi status를 실행하면
  Then 키 존재 여부와 사용 가능 모델(kimi-k2.5, kimi-k2-thinking, kimi-k2-thinking-turbo)이 표시된다
```
**Verification**: SPEC AC #2

### Scenario 3: Kimi Logout
```gherkin
Scenario: vibe kimi logout으로 인증 삭제
  Given Kimi API Key가 저장된 상태
  When vibe kimi logout을 실행하면
  Then API Key가 삭제되고 설정이 비활성화된다
```
**Verification**: SPEC AC #3

### Scenario 4: Kimi Chat API Call
```gherkin
Scenario: coreKimiOrchestrate 호출 시 올바른 API 요청
  Given Kimi API Key가 설정된 상태
  When coreKimiOrchestrate("Hello world")를 호출하면
  Then POST 요청이 api.moonshot.ai/v1/chat/completions로 전송되고 (기본: Global)
  And Authorization 헤더에 Bearer 토큰이 포함되고
  And model 필드가 "kimi-k2.5"이다
```
**Verification**: SPEC AC #4

### Scenario 5: Kimi Rate Limit Retry
```gherkin
Scenario: Kimi API 429 응답 시 재시도
  Given Kimi API가 429 응답을 반환하는 상태
  When chat() 함수를 호출하면
  Then exponential backoff로 최대 3회 재시도하고
  And 2초, 4초 간격으로 대기한다
```
**Verification**: SPEC AC #5

### Scenario 6: API Key Masking in Logs
```gherkin
Scenario: API key가 로그에 마스킹 처리
  Given Kimi API Key가 "sk-test1234567890"
  When 상태 표시 또는 에러 로그가 출력되면
  Then API Key가 "sk-***7890" 형태로 마스킹된다
```
**Verification**: SPEC AC #8

### Scenario 7: API Call Timeout
```gherkin
Scenario: 30초 timeout 초과 시 에러 반환
  Given Kimi API가 응답하지 않는 상태
  When chat() 함수를 호출하면
  Then 30초 후 timeout 에러가 반환된다
```
**Verification**: SPEC AC #9

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 | ✅ |
| 2 | AC-2 | ✅ |
| 3 | AC-3 | ✅ |
| 4 | AC-4 | ✅ |
| 5 | AC-5 | ✅ |
| 6 | AC-8 | ✅ |
| 7 | AC-9 | ✅ |
