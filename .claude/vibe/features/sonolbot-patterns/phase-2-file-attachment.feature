# Feature: sonolbot-patterns - Phase 2: File Attachment Support

**SPEC**: `.claude/vibe/specs/sonolbot-patterns/phase-2-file-attachment.md`
**Master Feature**: `.claude/vibe/features/sonolbot-patterns/_index.feature`

## User Story (Phase Scope)

**As a** Telegram/Slack 사용자
**I want** 사진, 문서, 영상, 음성, GPS 위치를 전송하면 에이전트가 인식
**So that** 텍스트뿐 아니라 멀티미디어 기반으로 에이전트와 소통할 수 있음

## Scenarios

### Scenario 1: 타입 정의 존재

```gherkin
Scenario: FileAttachment, LocationInfo 타입이 types.ts에 정의됨
  Given src/interface/types.ts 파일이 존재할 때
  When 타입 정의를 확인하면
  Then FileAttachment 인터페이스가 type, path, name, mimeType?, size?, duration? 필드를 가지고
  And LocationInfo 인터페이스가 latitude, longitude, accuracy? 필드를 가지고
  And ExternalMessage에 files?, location? optional 필드가 존재함
```
**Verification**: SPEC AC #1, #2

### Scenario 2: Telegram 사진 전송 시 로컬 저장

```gherkin
Scenario: Telegram에서 사진 전송 시 로컬 파일로 저장됨
  Given Telegram 사용자가 사진을 전송했을 때
  When TelegramBot이 메시지를 처리하면
  Then 사진이 ~/.vibe/files/msg_{id}/image_{id}.jpg에 저장되고
  And ExternalMessage.files[0].type이 'photo'이고
  And ExternalMessage.files[0].path가 저장 경로를 가리킴
```
**Verification**: SPEC AC #3

### Scenario 3: Telegram 문서 전송 시 원본 파일명 유지

```gherkin
Scenario: Telegram에서 문서 전송 시 원본 파일명으로 저장됨
  Given Telegram 사용자가 "report.pdf" 문서를 전송했을 때
  When TelegramBot이 메시지를 처리하면
  Then 문서가 ~/.vibe/files/msg_{id}/report.pdf에 저장되고
  And ExternalMessage.files[0].name이 'report.pdf'임
```
**Verification**: SPEC AC #4

### Scenario 4: Telegram 위치 전송 시 LocationInfo 변환

```gherkin
Scenario: Telegram에서 위치 공유 시 LocationInfo로 변환됨
  Given Telegram 사용자가 위치를 공유했을 때 (latitude: 37.5665, longitude: 126.9780)
  When TelegramBot이 메시지를 처리하면
  Then ExternalMessage.location.latitude가 37.5665이고
  And ExternalMessage.location.longitude가 126.9780임
```
**Verification**: SPEC AC #5

### Scenario 5: Slack 파일 업로드 시 로컬 다운로드

```gherkin
Scenario: Slack에서 파일 업로드 시 로컬 다운로드 + FileAttachment 생성
  Given Slack 사용자가 파일을 업로드했을 때
  When SlackBot이 files.info API로 파일 정보를 조회하면
  Then url_private에서 파일을 다운로드하고
  And Authorization: Bearer {SLACK_BOT_TOKEN} 헤더를 사용하고
  And ExternalMessage.files[]에 FileAttachment가 추가됨
```
**Verification**: SPEC AC #6

### Scenario 6: MediaPreprocessor 통합 전처리

```gherkin
Scenario: MediaPreprocessor가 FileAttachment[] 기반으로 전처리
  Given ExternalMessage에 files[](voice, photo, document)가 포함되었을 때
  When MediaPreprocessor가 전처리를 실행하면
  Then voice → Gemini STT로 텍스트 변환되고
  And photo → Gemini Vision으로 이미지 설명 생성되고
  And document → 텍스트 추출(txt/csv/json) 또는 메타설명 생성되고
  And 결과가 ExternalMessage.content에 자연어로 추가됨
```
**Verification**: SPEC AC #7

### Scenario 7: 다운로드 실패 시 graceful 처리

```gherkin
Scenario: 파일 다운로드 실패 시 메시지 처리가 중단되지 않음
  Given Telegram 사용자가 파일을 전송했지만
  And 네트워크 오류로 다운로드가 실패했을 때
  When TelegramBot이 메시지를 처리하면
  Then 에러가 로깅되고
  And ExternalMessage는 파일 없이 텍스트만으로 정상 전달됨
```
**Verification**: SPEC AC #8

### Scenario 8: 파일명 sanitize (path traversal 방지)

```gherkin
Scenario: 악의적 파일명이 sanitize됨
  Given Telegram 사용자가 "../../../etc/passwd" 이름의 문서를 전송했을 때
  When TelegramBot이 파일명을 처리하면
  Then ".." 경로 순회 문자가 제거되고
  And 특수문자가 안전한 문자로 치환됨
  And 파일이 ~/.vibe/files/msg_{id}/ 하위에만 저장됨
```
**Verification**: SPEC AC #9

### Scenario 9: TypeScript 컴파일

```gherkin
Scenario: 모든 변경 후 TypeScript 컴파일 성공
  Given Phase 2의 모든 코드 변경이 완료되었을 때
  When npx tsc --noEmit을 실행하면
  Then 컴파일 에러가 0건임
```
**Verification**: SPEC AC #10

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1, AC-2 (타입 정의) | ⬜ |
| 2 | AC-3 (Telegram 사진 저장) | ⬜ |
| 3 | AC-4 (Telegram 문서 원본명) | ⬜ |
| 4 | AC-5 (Telegram 위치) | ⬜ |
| 5 | AC-6 (Slack 파일 다운로드) | ⬜ |
| 6 | AC-7 (MediaPreprocessor) | ⬜ |
| 7 | AC-8 (다운로드 실패 graceful) | ⬜ |
| 8 | AC-9 (path traversal 방지) | ⬜ |
| 9 | AC-10 (TypeScript 컴파일) | ⬜ |
