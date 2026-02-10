# Feature: sonolbot-patterns - Phase 5: 24h Raw Conversation History

**SPEC**: `.claude/vibe/specs/sonolbot-patterns/phase-5-conversation-history.md`
**Master Feature**: `.claude/vibe/features/sonolbot-patterns/_index.feature`

## User Story (Phase Scope)

**As a** 반복적으로 에이전트와 대화하는 사용자
**I want** 에이전트가 최근 24시간 대화 맥락을 기억
**So that** 이전 대화 내용을 반복 설명하지 않아도 됨

## Scenarios

### Scenario 1: conversation_history 테이블 생성

```gherkin
Scenario: SessionRAGStore 초기화 시 conversation_history 테이블 생성
  Given SessionRAGStore가 초기화될 때
  When 데이터베이스 테이블을 확인하면
  Then conversation_history 테이블이 존재하고
  And id, chatId, role, content, timestamp 컬럼이 정의됨
```
**Verification**: SPEC AC #1

### Scenario 2: 대화 자동 저장

```gherkin
Scenario: 사용자 메시지 + 봇 응답이 자동 저장됨
  Given 사용자가 "오늘 날씨 알려줘"를 전송하고
  And 에이전트가 "서울 맑음, 기온 5도"를 응답했을 때
  When AgentLoop 처리가 완료되면
  Then conversation_history에 role='user', content='오늘 날씨 알려줘' 레코드가 저장되고
  And role='assistant', content='서울 맑음, 기온 5도' 레코드가 저장됨
```
**Verification**: SPEC AC #2

### Scenario 3: 24시간 이내 이력 조회

```gherkin
Scenario: getRecentConversationHistory()가 24시간 이내 이력 반환
  Given chatId="chat1"에 36시간 전 대화 2건과 12시간 전 대화 3건이 있을 때
  When getRecentConversationHistory("chat1", 24)를 호출하면
  Then 12시간 전 대화 3건만 반환되고
  And 36시간 전 대화 2건은 제외됨
  And 결과가 timestamp ASC 순서로 정렬됨
```
**Verification**: SPEC AC #3

### Scenario 4: System prompt에 이력 주입

```gherkin
Scenario: 대화 이력이 system prompt에 [최근 24시간 대화 이력] 형식으로 주입
  Given chatId="chat1"에 최근 24시간 대화 이력이 있을 때
  When AgentLoop이 process()를 시작하면
  Then system prompt에 "[최근 24시간 대화 이력]" 섹션이 추가되고
  And "사용자: ..." / "봇: ..." 형식으로 이력이 포함됨
```
**Verification**: SPEC AC #4

### Scenario 5: 8000자 초과 시 잘라냄

```gherkin
Scenario: 대화 이력이 8000자를 초과하면 오래된 것부터 잘라냄
  Given chatId="chat1"에 총 12000자 분량의 대화 이력이 있을 때
  When getRecentConversationHistory()를 호출하면
  Then 반환된 이력의 총 content 길이가 8000자 이하이고
  And 가장 최근 대화가 우선 포함됨 (오래된 것부터 제거)
```
**Verification**: SPEC AC #5

### Scenario 6: 48시간 이상 이력 자동 삭제

```gherkin
Scenario: 48시간 이상 된 대화 이력이 자동 삭제됨
  Given conversation_history에 72시간 전 레코드 5건이 있을 때
  When 정리 로직이 실행되면
  Then 72시간 전 레코드 5건이 삭제되고
  And 24시간 이내 레코드는 유지됨
```
**Verification**: SPEC AC #6

### Scenario 7: chatId 기준 격리

```gherkin
Scenario: 서로 다른 chatId의 대화 이력이 격리됨
  Given chatId="chat1"에 대화 3건, chatId="chat2"에 대화 2건이 있을 때
  When getRecentConversationHistory("chat1")를 호출하면
  Then chat1의 대화 3건만 반환되고
  And chat2의 대화는 포함되지 않음
```
**Verification**: SPEC AC #7

### Scenario 8: TypeScript 컴파일

```gherkin
Scenario: 모든 변경 후 TypeScript 컴파일 성공
  Given Phase 5의 모든 코드 변경이 완료되었을 때
  When npx tsc --noEmit을 실행하면
  Then 컴파일 에러가 0건임
```
**Verification**: SPEC AC #8

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (테이블 생성) | ⬜ |
| 2 | AC-2 (자동 저장) | ⬜ |
| 3 | AC-3 (24시간 이력 조회) | ⬜ |
| 4 | AC-4 (system prompt 주입) | ⬜ |
| 5 | AC-5 (8000자 제한) | ⬜ |
| 6 | AC-6 (48시간 자동 삭제) | ⬜ |
| 7 | AC-7 (chatId 격리) | ⬜ |
| 8 | AC-8 (TypeScript 컴파일) | ⬜ |
