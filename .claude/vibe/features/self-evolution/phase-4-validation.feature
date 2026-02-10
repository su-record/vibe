# Feature: self-evolution — Phase 4: Validation & Lifecycle

**SPEC**: `.claude/vibe/specs/self-evolution/phase-4-validation.md`
**Master Feature**: `.claude/vibe/features/self-evolution/_index.feature`

## User Story (Phase Scope)
**As a** vibe 사용자
**I want** 자동 생성된 skill/agent/rule의 품질이 검증되고 생명주기가 관리되길
**So that** 저품질 생성물이 자동 정리되고 검증된 것만 지속적으로 사용됨

## Scenarios

### Scenario 1: 사용 이벤트 기록
```gherkin
Scenario: auto-generated skill 사용 시 usage_events에 기록
  Given auto-generated skill "auto-csv-analyzer"가 active 상태이고
  When skill-injector가 해당 skill을 주입하면
  Then usage_events 테이블에 generationId, sessionId, matchedPrompt가 기록되고
  And generations 테이블의 usageCount가 1 증가하고 lastUsedAt이 업데이트됨
```
**Verification**: SPEC AC #1

### Scenario 2: TTL 만료 자동 비활성화
```gherkin
Scenario: 7일간 미사용 skill이 자동 비활성화
  Given active 상태인 skill의 lastUsedAt이 8일 전이고
  When LifecycleManager.cleanup()이 실행되면
  Then 해당 skill의 status가 'disabled'로 변경되고
  And 파일 확장자가 .disabled로 변경됨
```
**Verification**: SPEC AC #2

### Scenario 3: Testing → Active 승격
```gherkin
Scenario: 충분한 사용 + 긍정 피드백 시 active 승격
  Given testing 상태인 skill이 3회 이상 사용되었고
  And negative feedback 비율이 30% 미만이면
  When LifecycleManager.checkPromotions()가 실행되면
  Then status가 'active'로 변경됨
```
**Verification**: SPEC AC #3

### Scenario 4: Rollback으로 이전 버전 복원
```gherkin
Scenario: rollback 실행 시 이전 버전 복원
  Given generation v2가 parentId=v1을 가지고 있고
  When RollbackManager.rollback(v2.id)가 실행되면
  Then v2 파일이 .disabled로 변경되고
  And v1 파일이 복원됨
```
**Verification**: SPEC AC #4

### Scenario 5: Emergency Disable All
```gherkin
Scenario: 긴급 전체 비활성화
  Given auto/ 디렉토리에 3개의 active skill과 1개의 agent가 있고
  When RollbackManager.emergencyDisableAll()이 실행되면
  Then skills/auto/, agents/auto/, rules/auto/ 하위 모든 파일이 .disabled로 변경되고
  And GenerationRegistry의 모든 active/testing 레코드가 disabled로 변경됨
```
**Verification**: SPEC AC #5

### Scenario 6: Circuit Breaker 동작
```gherkin
Scenario: 실패율 50%+ 시 생성 중지
  Given 최근 10개 생성 시도 중 6개가 실패했고
  When EvolutionOrchestrator.generate()가 호출되면
  Then CircuitBreaker가 open 상태로 전환하고
  And 생성이 스킵되고 로그에 "circuit breaker open" 기록됨
```
**Verification**: SPEC AC #6

### Scenario 7: Dashboard 도구 현황 조회
```gherkin
Scenario: core_evolution_status로 전체 현황 확인
  Given 5개 생성물이 존재하고 (2 active, 1 testing, 1 draft, 1 disabled)
  When core_evolution_status 도구가 호출되면
  Then 생성/활성/비활성 개수와 전체 사용률이 JSON으로 반환됨
```
**Verification**: SPEC AC #7

### Scenario 8: .disabled 파일 무시
```gherkin
Scenario: skill-injector가 .disabled 파일을 무시
  Given auto/ 디렉토리에 "skill-a.md"와 "skill-b.md.disabled"가 있고
  When skill-injector가 스캔하면
  Then "skill-a.md"만 후보에 포함되고
  And "skill-b.md.disabled"는 무시됨
```
**Verification**: SPEC AC #8

### Scenario 9: Negative feedback 과다 시 비활성화
```gherkin
Scenario: negative feedback > 50% 시 active에서 disabled
  Given active 상태인 skill의 usage_events 중 negative feedback이 60%이고
  When LifecycleManager.checkDemotions()가 실행되면
  Then status가 'disabled'로 변경됨
```
**Verification**: SPEC AC #2 (피드백 기반)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (usage tracking) | ✅ |
| 2 | AC-2 (TTL auto-disable) | ✅ |
| 3 | AC-3 (testing → active) | ✅ |
| 4 | AC-4 (rollback) | ✅ |
| 5 | AC-5 (emergency disable all) | ✅ |
| 6 | AC-6 (circuit breaker) | ✅ |
| 7 | AC-7 (dashboard status) | ✅ |
| 8 | AC-8 (.disabled ignore) | ✅ |
| 9 | AC-2 (negative feedback demotion) | ✅ |
