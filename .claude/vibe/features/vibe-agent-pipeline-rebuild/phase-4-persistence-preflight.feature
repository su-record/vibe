# Feature: vibe-agent-pipeline-rebuild - Phase 4: Persistence + Preflight

**SPEC**: `.claude/vibe/specs/vibe-agent-pipeline-rebuild/phase-4-persistence-preflight.md`
**Master Feature**: `.claude/vibe/features/vibe-agent-pipeline-rebuild/_index.feature`

## User Story (Phase Scope)
**As a** Vibe 데몬 운영자
**I want** 대화 기록이 데몬 재시작 후에도 유지되고, 시작 시 환경이 검증되길 원한다
**So that** 데이터 손실 없이 안정적으로 운영할 수 있다

## Scenarios

### Scenario 1: 대화 기록 SQLite 영속화
```gherkin
Scenario: 대화 기록이 SQLite에 저장되어 데몬 재시작 후에도 유지된다
  Given 데몬이 실행 중이고 chatId "user-123"과 대화가 진행 중이다
  And 5개의 메시지가 교환되었다
  When 데몬이 재시작된다
  Then chatId "user-123"의 5개 메시지가 복원된다
  And 대화가 이전 컨텍스트와 함께 계속된다
```
**Verification**: SPEC AC #1

### Scenario 2: Sliding Window 적용
```gherkin
Scenario: 20개 초과 메시지가 있으면 오래된 것부터 제거된다
  Given chatId "user-123"에 25개의 메시지가 저장되었다
  When getMessages()가 호출된다
  Then 최근 20개의 메시지만 반환된다
  And 가장 오래된 5개는 제외된다
```
**Verification**: SPEC AC #2

### Scenario 3: 비활성 세션 자동 정리
```gherkin
Scenario: 30분 초과 비활성 세션이 자동으로 정리된다
  Given chatId "idle-user"의 마지막 활동이 31분 전이다
  When cleanExpired()가 실행된다
  Then "idle-user" 세션이 삭제된다
  And 활성 세션은 유지된다
```
**Verification**: SPEC AC #3

### Scenario 4: In-Memory Fallback (하위 호환)
```gherkin
Scenario: ConversationStore 미제공 시 in-memory 동작이 유지된다
  Given AgentLoopDeps에 conversationStore가 undefined이다
  When 메시지가 처리된다
  Then 기존 ConversationState(in-memory)로 동작한다
  And 데몬 재시작 시 대화 기록이 소실된다 (기존 동작)
```
**Verification**: SPEC AC #4

### Scenario 5: Preflight API 키 누락 감지
```gherkin
Scenario: GPT API 키가 없으면 데몬 시작이 거부된다
  Given GPT API 키가 설정되지 않았다
  And OAuth 토큰도 없다
  When vibe start가 실행된다
  Then "GPT API 키 미설정" 에러가 출력된다
  And "해결: vibe gpt auth 또는 vibe gpt key <key>" 안내가 출력된다
  And 데몬이 시작되지 않는다
```
**Verification**: SPEC AC #5

### Scenario 6: Preflight 포트 충돌 감지
```gherkin
Scenario: 포트 7860이 이미 사용 중이면 에러를 출력한다
  Given 다른 프로세스가 포트 7860을 사용 중이다
  When vibe start가 실행된다
  Then "포트 7860 사용 중" 에러가 출력된다
  And "해결: 기존 프로세스 종료 또는 VIBE_WEB_PORT 변경" 안내가 출력된다
  And 데몬이 시작되지 않는다
```
**Verification**: SPEC AC #6

### Scenario 7: Preflight 빠른 실행
```gherkin
Scenario: Preflight 검사가 2초 이내에 완료된다
  Given 모든 환경 변수가 올바르게 설정되었다
  When preflight 검사가 실행된다
  Then 2초 이내에 결과가 반환된다
  And passed: true가 반환된다
```
**Verification**: SPEC AC #7

### Scenario 8: 민감 필드 마스킹
```gherkin
Scenario: SQLite 저장 시 API 키와 토큰이 마스킹된다
  Given 도구 호출 결과에 "ANTHROPIC_API_KEY=sk-ant-xxx" 텍스트가 포함되었다
  When 메시지가 SQLite에 저장된다
  Then API 키 부분이 "***MASKED***"로 교체된다
  And 마스킹된 데이터만 DB에 기록된다
```
**Verification**: SPEC AC #8

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
