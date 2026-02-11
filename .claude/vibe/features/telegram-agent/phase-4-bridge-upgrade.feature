# Feature: telegram-agent - Phase 4: telegram-bridge.ts 업그레이드 + 설정 확장

**SPEC**: `.claude/vibe/specs/telegram-agent/phase-4-bridge-upgrade.md`
**Master Feature**: `.claude/vibe/features/telegram-agent/_index.feature`

## User Story (Phase Scope)
**As a** 텔레그램 사용자
**I want** 슬래시 명령으로 작업을 관리하고, 동시에 여러 메시지를 보낼 수 있으며
**So that** 봇을 실시간 AI 에이전트로 활용하여 다양한 작업을 효율적으로 처리할 수 있다

## Scenarios

### Scenario 1: 하위 호환성
```gherkin
Scenario: 기존 telegram.json 설정으로 봇 시작
  Given telegram.json에 botToken과 allowedChatIds만 있음 (새 필드 없음)
  When vibe telegram start를 실행하면
  Then 봇이 정상 시작됨
  And 새 필드는 기본값으로 동작함 (maxTurns=5, timeout=300000)
```
**Verification**: SPEC AC #1

### Scenario 2: MessageRouter 기반 라우팅
```gherkin
Scenario: 일반 메시지가 MessageRouter를 통해 라우팅됨
  Given 봇이 시작되어 있음
  When 사용자가 "오늘 날씨 어때?"라고 메시지를 보내면
  Then MessageRouter.route()가 호출됨
  And SmartRouter를 통해 적절한 LLM이 선택됨
  And 응답이 텔레그램으로 전송됨
```
**Verification**: SPEC AC #2

### Scenario 3: 슬래시 명령 - /status
```gherkin
Scenario: /status 명령으로 봇 상태 조회
  Given 봇이 30분 동안 실행 중이고 1개 작업이 진행 중
  When 사용자가 "/status"를 보내면
  Then uptime, 활성 작업 수, LLM 상태가 포함된 응답이 반환됨
```
**Verification**: SPEC AC #3, #4

### Scenario 4: 슬래시 명령 - /tasks와 /cancel
```gherkin
Scenario: /tasks로 작업 목록 조회 후 /cancel로 취소
  Given 2개 개발 작업이 진행 중
  When 사용자가 "/tasks"를 보내면
  Then 2개 작업의 ID, 설명, 경과 시간이 표시됨
  When 사용자가 "/cancel task-abc"를 보내면
  Then 해당 작업이 취소됨
  And "작업이 취소되었습니다" 메시지가 전송됨
```
**Verification**: SPEC AC #5, #6

### Scenario 5: 동시 메시지 큐잉
```gherkin
Scenario: 동시에 여러 메시지 수신 시 큐잉
  Given 현재 메시지 처리 중
  When 2개 추가 메시지가 수신되면
  Then 메시지가 큐에 추가됨
  And 첫 번째 처리 완료 후 순차적으로 처리됨
  And 큐 10개 초과 시 거부 메시지 반환
```
**Verification**: SPEC AC #8, #9

### Scenario 6: 개발 작업 완료 알림
```gherkin
Scenario: 개발 작업 완료 시 텔레그램 알림 수신
  Given 사용자가 "~/workspace/app에서 테스트 작성해줘"라고 요청함
  When 작업이 BackgroundManager에서 완료되면
  Then "작업 완료!" 알림이 텔레그램으로 수신됨
  And 결과 요약과 소요 시간이 포함됨
```
**Verification**: SPEC AC #10

### Scenario 7: CLI 설정 관리
```gherkin
Scenario: vibe telegram config로 설정 조회 및 변경
  When vibe telegram config를 실행하면
  Then 현재 설정 (defaultWorkspace, maxTurns, timeout, provider)이 표시됨
  When vibe telegram config set maxTurns 10를 실행하면
  Then maxTurns가 10으로 변경됨
  And 변경 확인 메시지가 출력됨
```
**Verification**: SPEC AC #11, #12

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (하위 호환) | ⬜ |
| 2 | AC-2 (라우팅) | ⬜ |
| 3 | AC-3, AC-4 (슬래시 명령) | ⬜ |
| 4 | AC-5, AC-6 (작업 관리) | ⬜ |
| 5 | AC-8, AC-9 (큐잉) | ⬜ |
| 6 | AC-10 (완료 알림) | ⬜ |
| 7 | AC-11, AC-12 (CLI 설정) | ⬜ |
