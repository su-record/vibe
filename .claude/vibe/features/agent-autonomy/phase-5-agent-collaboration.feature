# Feature: agent-autonomy — Phase 5: Multi-Agent Collaboration & Integration

**SPEC**: `.claude/vibe/specs/agent-autonomy/phase-5-agent-collaboration.md`
**Master Feature**: `.claude/vibe/features/agent-autonomy/_index.feature`

## User Story (Phase Scope)
**As a** vibe 사용자
**I want** 자연어 요청이 자율적으로 분해되어 멀티 에이전트가 협업 실행하길
**So that** "로그인 만들어줘" 한 마디로 SPEC → Review → Implementation → Test가 자동 완료됨

## Scenarios

### Scenario 1: 태스크 분해
```gherkin
Scenario: 자연어 프롬프트를 단계별로 분해
  Given TaskDecomposer가 초기화되고
  When "로그인 기능 만들어줘"가 입력되면
  Then estimatedComplexity='high'로 분류되고
  And steps에 spec → review → implement → test 4단계가 포함됨
```
**Verification**: SPEC AC #1

### Scenario 2: suggest 모드 동작
```gherkin
Scenario: suggest 모드에서 분해 결과만 표시
  Given autonomy.mode='suggest'이고
  When 프롬프트가 분해되면
  Then 분해 결과가 사용자에게 표시되고
  And 사용자 확인 없이는 실행되지 않음
```
**Verification**: SPEC AC #2

### Scenario 3: auto 모드 LOW 위험 자동 실행
```gherkin
Scenario: auto 모드에서 LOW 위험 태스크 자동 실행
  Given autonomy.mode='auto'이고
  And 분해된 모든 step이 riskLevel='LOW'이면
  When AutonomyOrchestrator.execute()가 호출되면
  Then 체크포인트 없이 전체 step이 자동 실행됨
```
**Verification**: SPEC AC #3

### Scenario 4: auto 모드 HIGH 위험 확인
```gherkin
Scenario: auto 모드에서 HIGH 위험 step 발견 시 확인 요청
  Given autonomy.mode='auto'이고
  And step 중 riskLevel='HIGH'인 step이 존재하면
  When AutonomyOrchestrator가 해당 step에 도달하면
  Then ConfirmationManager를 통해 오너 확인이 요청되고
  And 승인 후에만 해당 step이 실행됨
```
**Verification**: SPEC AC #4

### Scenario 5: 에이전트 핸드오프
```gherkin
Scenario: architect → implementer 핸드오프 시 컨텍스트 전달
  Given CollaborationProtocol이 초기화되고
  And architect가 spec step을 완료하고
  When handoff(architect, implementer, context)가 호출되면
  Then implementer에게 파일 목록, 변경 사항, 결정 사항이 전달됨
```
**Verification**: SPEC AC #5

### Scenario 6: CLI vibe sentinel status
```gherkin
Scenario: vibe sentinel status로 전체 현황 조회
  Given sentinel이 활성화되고 정책 5개, 대기 확인 2개가 존재하고
  When vibe sentinel status 명령어를 실행하면
  Then 활성 정책 수, 대기 확인 수, 최근 24시간 통계가 표시됨
```
**Verification**: SPEC AC #6

### Scenario 7: 세션 시작 autonomy 현황
```gherkin
Scenario: 세션 시작 시 autonomy 현황 요약 표시
  Given sentinel과 autonomy가 활성화되고
  When 새 세션이 시작되면
  Then "🤖 Agent Autonomy: {mode}" 형태로 현황이 표시되고
  And Sentinel 상태, 제안 수, 최근 행위 통계가 포함됨
```
**Verification**: SPEC AC #7

### Scenario 8: config.json 설정 적용
```gherkin
Scenario: sentinel/autonomy 설정이 정상 적용
  Given config.json에 sentinel.confirmationTimeout=600이고
  And autonomy.mode='auto'이면
  When 시스템이 초기화되면
  Then 확인 타임아웃이 600초로 설정되고
  And auto 모드로 동작함
```
**Verification**: SPEC AC #8

### Scenario 9: 전체 비활성화
```gherkin
Scenario: sentinel.enabled=false 시 감시 비활성화
  Given config.json에 sentinel.enabled=false이고
  When 세션이 시작되면
  Then sentinel-guard hook이 실행되지 않고
  And ProactiveAnalyzer가 비활성화되고
  And audit_events에는 계속 기록됨 (감사 로그만 유지)
```
**Verification**: SPEC AC #9

### Scenario 10: 통합 E2E 흐름
```gherkin
Scenario: 프롬프트 → 분해 → 위험 평가 → 실행 → 감사 전체 흐름
  Given autonomy.mode='auto'이고 sentinel이 활성화되고
  When 사용자가 "helper 함수 추가해줘" 프롬프트를 입력하면
  Then TaskDecomposer가 implement → test 2단계로 분해하고
  And SecuritySentinel이 LOW 위험으로 평가하고
  And 자동 실행 후 audit_events에 전체 이벤트 체인이 기록됨
```
**Verification**: SPEC AC #10

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (task decomposition) | ⬜ |
| 2 | AC-2 (suggest mode) | ⬜ |
| 3 | AC-3 (auto mode LOW) | ⬜ |
| 4 | AC-4 (auto mode HIGH confirm) | ⬜ |
| 5 | AC-5 (agent handoff) | ⬜ |
| 6 | AC-6 (CLI sentinel) | ⬜ |
| 7 | AC-7 (session start status) | ⬜ |
| 8 | AC-8 (config apply) | ⬜ |
| 9 | AC-9 (disable all) | ⬜ |
| 10 | AC-10 (E2E integration) | ⬜ |
