# Feature: agent-autonomy — Phase 2: Security Sentinel

**SPEC**: `.claude/vibe/specs/agent-autonomy/phase-2-security-sentinel.md`
**Master Feature**: `.claude/vibe/features/agent-autonomy/_index.feature`

## User Story (Phase Scope)
**As a** vibe 사용자
**I want** Security Sentinel이 모든 자율 행위를 실시간 감시하고 위험한 행위를 차단하길
**So that** 안전하지 않은 행위가 사전에 방지되고, vibe의 자율성도 통제됨

## Scenarios

### Scenario 1: LOW 위험 행위 분류
```gherkin
Scenario: 일반 파일 쓰기가 LOW로 분류
  Given RiskClassifier가 초기화되고
  When actionType='file_write', target='src/utils/helper.ts' 이벤트가 입력되면
  Then riskLevel='LOW'가 반환되고
  And score가 0-33 범위임
```
**Verification**: SPEC AC #1

### Scenario 2: 조건부 HIGH 위험 상승
```gherkin
Scenario: force push가 HIGH로 분류
  Given RiskClassifier가 초기화되고
  When actionType='git_push', params에 '--force' 포함 이벤트가 입력되면
  Then riskLevel='HIGH'가 반환되고
  And factors에 'force push detected'가 포함됨
```
**Verification**: SPEC AC #2

### Scenario 3: 기본 정책 평가
```gherkin
Scenario: deny-force-push 정책이 force push 차단
  Given PolicyEngine에 5개 기본 정책이 로드되고
  When actionType='git_push', force=true 행위가 평가되면
  Then allowed=false가 반환되고
  And matchedPolicies에 'deny-force-push'가 포함됨
```
**Verification**: SPEC AC #3

### Scenario 4: Sentinel intercept 성능
```gherkin
Scenario: SecuritySentinel.intercept()가 10ms 이내 완료
  Given SecuritySentinel이 초기화되고
  When 100개의 agent_action 이벤트를 순차적으로 intercept하면
  Then 각 intercept의 평균 처리 시간이 10ms 이하임
```
**Verification**: SPEC AC #4

### Scenario 5: Sentinel 파일 보호
```gherkin
Scenario: src/lib/autonomy/ 파일 수정 시도 차단
  Given SecuritySentinel이 활성화되고
  When actionType='file_write', target='src/lib/autonomy/SecuritySentinel.ts'가 시도되면
  Then allowed=false가 반환되고
  And reason에 'Sentinel files are protected'가 포함됨
```
**Verification**: SPEC AC #5

### Scenario 6: sentinel-guard hook 동작
```gherkin
Scenario: PreToolUse에서 sentinel-guard가 위험 행위 차단
  Given sentinel-guard.js hook이 등록되고
  And Write 도구로 sentinel 파일 수정이 시도되면
  When hook이 실행되면
  Then decision='block'이 반환되고
  And reason이 포함된 JSON이 출력됨
```
**Verification**: SPEC AC #6

### Scenario 7: 차단 사유 메시지
```gherkin
Scenario: 차단 시 구체적인 사유 메시지 반환
  Given SecuritySentinel이 활성화되고
  When deny-mass-delete 정책에 해당하는 행위가 시도되면
  Then reason에 '5개 이상 파일 동시 삭제'와 관련된 메시지가 포함됨
```
**Verification**: SPEC AC #7

### Scenario 8: 모든 행위 감사 기록
```gherkin
Scenario: 허용/차단 모든 행위가 AuditStore에 기록
  Given SecuritySentinel이 활성화되고
  When LOW 위험 행위(허용)와 HIGH 위험 행위(차단)를 각각 intercept하면
  Then 두 행위 모두 audit_events에 기록되고
  And outcome이 각각 'allowed'와 'blocked'로 저장됨
```
**Verification**: SPEC AC #8

### Scenario 9: 커스텀 정책 오버라이드
```gherkin
Scenario: config.json sentinel.rules로 커스텀 정책 추가
  Given config.json에 sentinel.rules에 새 정책이 정의되고
  When PolicyEngine이 초기화되면
  Then 커스텀 정책이 기본 정책과 함께 로드되고
  And 우선순위에 따라 평가됨
```
**Verification**: SPEC AC #3 (커스텀 경로)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (LOW risk classification) | ⬜ |
| 2 | AC-2 (conditional HIGH escalation) | ⬜ |
| 3 | AC-3 (policy evaluation) | ⬜ |
| 4 | AC-4 (intercept performance) | ⬜ |
| 5 | AC-5 (sentinel file protection) | ⬜ |
| 6 | AC-6 (hook integration) | ⬜ |
| 7 | AC-7 (block reason message) | ⬜ |
| 8 | AC-8 (audit all actions) | ⬜ |
| 9 | AC-3 (custom policy override) | ⬜ |
