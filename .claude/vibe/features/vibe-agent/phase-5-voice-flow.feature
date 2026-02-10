# Feature: vibe-agent - Phase 5: Voice Flow Integration

**SPEC**: `.claude/vibe/specs/vibe-agent/phase-5-voice-flow.md`
**Master Feature**: `.claude/vibe/features/vibe-agent/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자
**I want** 음성으로 요청하면 자동으로 텍스트로 변환되어 처리
**So that** 키보드 없이도 에이전트에게 작업을 요청할 수 있다

## Scenarios

### Scenario 1: 음성 → 텍스트 자동 변환
```gherkin
Scenario: Voice message auto-transcribed
  Given Telegram에서 음성 메시지가 수신되면
  When AgentLoop이 voice 타입을 감지하면
  Then gemini_stt가 자동 호출되어 텍스트로 변환된다
  And 변환된 텍스트로 AgentLoop이 계속 진행된다
```
**Verification**: SPEC AC #1

### Scenario 2: 변환된 텍스트로 정상 처리
```gherkin
Scenario: Transcribed text processed normally
  Given 음성 "날씨 알려줘"가 텍스트로 변환된 상태
  When AgentLoop에 텍스트가 전달되면
  Then HeadModel이 google_search tool을 호출한다
  And 검색 결과 기반 응답이 생성된다
```
**Verification**: SPEC AC #2

### Scenario 3: 음성 인식 결과 확인
```gherkin
Scenario: Voice recognition confirmation message
  Given 음성 메시지가 수신되면
  When STT 변환이 완료되면
  Then "음성 인식: {변환된 텍스트}" 확인 메시지가 전송된다
```
**Verification**: SPEC AC #3

### Scenario 4: STT 실패 처리
```gherkin
Scenario: STT failure handling
  Given 음성 메시지가 수신되면
  When Gemini STT가 실패하면
  Then "음성을 인식하지 못했습니다. 다시 시도해주세요." 메시지가 전송된다
  And AgentLoop이 중단된다
```
**Verification**: SPEC AC #4

### Scenario 5: 이미지 메시지 처리
```gherkin
Scenario: Image message auto-analyzed
  Given Telegram에서 이미지가 수신되면
  When MediaPreprocessor가 이미지를 감지하면
  Then Gemini analyzeUI로 이미지 설명이 생성된다
  And 설명 텍스트가 AgentLoop에 전달된다
```
**Verification**: SPEC AC #5

### Scenario 6: 음성 파일 크기 제한
```gherkin
Scenario: Voice file size exceeds 20MB
  Given 20MB 초과 음성 파일이 수신되면
  When MediaPreprocessor가 크기를 확인하면
  Then "음성 파일이 너무 큽니다 (최대 20MB)" 에러가 반환된다
```
**Verification**: SPEC AC #6

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 | ⬜ |
| 2 | AC-2 | ⬜ |
| 3 | AC-3 | ⬜ |
| 4 | AC-4 | ⬜ |
| 5 | AC-5 | ⬜ |
| 6 | AC-6 | ⬜ |
