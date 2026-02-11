# Feature: openclaw-integration — Phase 3: Orchestrator Enhancement

**SPEC**: `.claude/core/specs/openclaw-integration/phase-3-orchestrator.md`
**Master Feature**: `.claude/core/features/openclaw-integration/_index.feature`

## User Story (Phase Scope)
**As a** Vibe 사용자
**I want** 4-LLM SmartRouter와 Auth Profile 자동 순환
**So that** 태스크 유형에 따라 최적의 LLM이 선택되고, Rate Limit 시 자동으로 다음 인증 프로필로 전환된다

## Scenarios

### Scenario 1: SmartRouter Code Review Routing
```gherkin
Scenario: code-review 태스크가 Kimi를 1순위로 선택
  Given Kimi, GPT, Gemini가 모두 사용 가능
  When SmartRouter.route('code-review', prompt)를 호출하면
  Then Kimi가 1순위로 시도된다
```
**Verification**: SPEC AC #1

### Scenario 2: SmartRouter Fallback Chain
```gherkin
Scenario: Kimi 실패 시 fallback
  Given Kimi가 사용 불가능 (Rate Limit)
  And GPT, Gemini가 사용 가능
  When SmartRouter.route('code-review', prompt)를 호출하면
  Then GPT로 fallback하고
  And GPT도 실패하면 Gemini → Claude 순으로 시도한다
```
**Verification**: SPEC AC #2

### Scenario 3: LLMCluster Multi Query with Kimi
```gherkin
Scenario: 4-LLM 병렬 쿼리
  Given 모든 LLM이 사용 가능
  When LLMCluster.multiQuery(prompt, { useKimi: true })를 호출하면
  Then GPT, Gemini, Kimi 결과가 병렬로 반환된다
```
**Verification**: SPEC AC #3

### Scenario 4: LLM Status Check with 4 Providers
```gherkin
Scenario: 4개 프로바이더 상태 확인
  When LLMCluster.checkStatus()를 호출하면
  Then gpt, gemini, kimi, claude 4개 프로바이더의 가용 상태가 반환된다
```
**Verification**: SPEC AC #4

### Scenario 5: Auth Profile Priority Selection
```gherkin
Scenario: 인증 프로필 우선순위 기반 선택
  Given GPT에 OAuth(priority 1)와 API Key(priority 2) 프로필이 등록됨
  When getActiveProfile('gpt')를 호출하면
  Then priority 1의 OAuth 프로필이 반환된다
```
**Verification**: SPEC AC #5

### Scenario 6: Auth Profile Cooldown on Rate Limit
```gherkin
Scenario: Rate Limit 3회 시 cooldown 설정
  Given GPT OAuth 프로필이 활성 상태
  When 429 에러가 3회 연속 발생하면
  Then 해당 프로필에 5분 cooldown이 설정되고
  And 자동으로 API Key 프로필로 전환된다
```
**Verification**: SPEC AC #6

### Scenario 7: Cooldown Skip in Profile Selection
```gherkin
Scenario: cooldown 중인 프로필 건너뜀
  Given Profile A가 cooldown 중 (3분 남음)
  And Profile B가 사용 가능
  When getActiveProfile('gpt')를 호출하면
  Then Profile B가 반환된다
```
**Verification**: SPEC AC #7

### Scenario 8: All Profiles in Cooldown
```gherkin
Scenario: 모든 프로필이 cooldown일 때
  Given GPT의 모든 프로필이 cooldown 중
  And Profile A의 cooldown이 2분 남음 (가장 빠름)
  And Profile B의 cooldown이 5분 남음
  When getActiveProfile('gpt')를 호출하면
  Then 가장 빨리 해제되는 Profile A가 반환된다
```
**Verification**: SPEC AC #8

### Scenario 9: Profile File Lock Concurrent Access
```gherkin
Scenario: 프로필 파일 동시 접근 시 lock
  Given 2개의 에이전트가 동시에 프로필 업데이트를 시도
  When markFailure()가 동시에 호출되면
  Then 하나만 먼저 실행되고 다른 하나는 lock 해제 후 실행된다
  And 데이터 무결성이 유지된다
```
**Verification**: SPEC AC #9

### Scenario 10: All Providers Failed
```gherkin
Scenario: 모든 프로바이더 실패 시 에러
  Given Kimi, GPT, Gemini, Claude 모두 사용 불가능
  When SmartRouter.route('code-review', prompt)를 호출하면
  Then AllProvidersFailedError가 throw되고
  And 마지막 프로바이더의 에러 메시지가 포함된다
```
**Verification**: SPEC AC #11

### Scenario 11: SmartRouter Fallback Timeout
```gherkin
Scenario: 프로바이더 30초 timeout 후 다음으로 전환
  Given Kimi가 30초 이상 응답하지 않는 상태
  When SmartRouter.route('code-review', prompt)를 호출하면
  Then 30초 후 Kimi를 건너뛰고 GPT로 fallback한다
```
**Verification**: SPEC AC #12

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 | ✅ |
| 2 | AC-2 | ✅ |
| 3 | AC-3 | ✅ |
| 4 | AC-4 | ✅ |
| 5 | AC-5 | ✅ |
| 6 | AC-6 | ✅ |
| 7 | AC-7 | ✅ |
| 8 | AC-8 | ✅ |
| 9 | AC-9 | ✅ |
| 10 | AC-11 | ✅ |
| 11 | AC-12 | ✅ |
