# Feature: telegram-model-a - Phase 2: Google Apps 라우트

**SPEC**: `.claude/vibe/specs/telegram-model-a/phase-2-google.md`
**Master Feature**: `.claude/vibe/features/telegram-model-a/_index.feature`

## User Story (Phase Scope)

**As a** 개인 사용자
**I want** 텔레그램에서 자연어로 Gmail, Drive, Sheets, Calendar, YouTube를 제어하기를
**So that** Google 서비스를 열지 않고도 텔레그램에서 모든 작업을 처리할 수 있다

## Scenarios

### Scenario 1: Gmail 전송

```gherkin
Scenario: "메일 보내줘" → Gmail API 전송
  Given 사용자가 "test@email.com에 회의록 메일 보내줘"를 전송
  And Google OAuth가 인증됨
  When GoogleRoute가 실행 (subIntent: gmail_send)
  Then GmailService.sendMail 호출
  And 텔레그램에 "메일 전송 완료" 알림
```
**Verification**: SPEC AC #1

### Scenario 2: Gmail 검색

```gherkin
Scenario: "메일 검색" → Gmail 검색 결과
  Given 사용자가 "John이 보낸 메일 찾아줘"를 전송
  When GoogleRoute가 실행 (subIntent: gmail_search)
  Then GmailService.searchMail("from:John") 호출
  And 검색 결과 목록을 텔레그램에 전송
```
**Verification**: SPEC AC #1

### Scenario 3: Calendar 조회

```gherkin
Scenario: "내일 일정 알려줘" → Calendar API 조회
  Given 사용자가 "내일 일정 알려줘"를 전송
  When GoogleRoute가 실행 (subIntent: calendar_list)
  Then CalendarService.listEvents(내일 00:00, 내일 23:59) 호출
  And 일정 목록을 포맷팅하여 텔레그램 전송
```
**Verification**: SPEC AC #2

### Scenario 4: Calendar 추가

```gherkin
Scenario: "회의 추가해줘" → Calendar 일정 생성
  Given 사용자가 "내일 오후 3시에 팀 미팅 추가해줘"를 전송
  When GoogleRoute가 실행 (subIntent: calendar_create)
  Then CalendarService.createEvent 호출
  And start가 내일 15:00 KST로 파싱됨
  And 텔레그램에 "일정 추가됨" 알림
```
**Verification**: SPEC AC #2

### Scenario 5: YouTube 요약

```gherkin
Scenario: 유튜브 URL → 자막 추출 → LLM 요약
  Given 사용자가 "이 유튜브 요약해줘 https://youtube.com/watch?v=xxx"를 전송
  When GoogleRoute가 실행 (subIntent: youtube_summarize)
  Then YouTubeService.getCaptions 호출
  And SmartRouter로 LLM 요약 요청
  And 요약 결과를 텔레그램에 전송
```
**Verification**: SPEC AC #3

### Scenario 6: Sheets 데이터 추가

```gherkin
Scenario: 스프레드시트에 데이터 append
  Given 사용자가 "영업 시트에 데이터 추가해줘: 2월, 1000만원"를 전송
  When GoogleRoute가 실행 (subIntent: sheets_write)
  Then SheetsService.append 호출
  And 텔레그램에 "데이터 추가 완료" 알림
```
**Verification**: SPEC AC #4

### Scenario 7: Drive 파일 업로드

```gherkin
Scenario: 텔레그램 파일 → Drive 업로드
  Given 사용자가 텔레그램에 파일을 첨부하고 "드라이브에 올려줘"를 전송
  When GoogleRoute가 실행 (subIntent: drive_upload)
  Then DriveService.upload 호출
  And 텔레그램에 공유 링크 전송
```
**Verification**: SPEC AC #5

### Scenario 8: OAuth 미인증 시 안내

```gherkin
Scenario: Google 미인증 시 인증 URL 전송
  Given Google OAuth 토큰이 없음
  When GoogleRoute가 실행
  Then GoogleAuthManager.getAuthUrl() 호출
  And 인증 URL을 텔레그램에 전송
  And "위 링크로 Google 인증을 완료해주세요" 메시지
```
**Verification**: SPEC AC #6

### Scenario 9: Google API 429 에러 재시도

```gherkin
Scenario: API rate limit 시 자동 재시도
  Given GmailService.sendMail 호출 시 429 에러 발생
  When 첫 번째 재시도 (1초 대기)
  And 두 번째 재시도 (2초 대기)
  Then 세 번째 시도에서 성공
  And 텔레그램에 정상 응답 전송
```
**Verification**: SPEC AC #7

### Scenario 10: Playwright fallback

```gherkin
Scenario: API 불가 작업 시 Playwright 실행
  Given API로 처리 불가능한 Google 작업 요청
  When BrowserPool에서 컨텍스트 획득
  Then Chrome 프로필 복사본으로 Playwright 실행
  And 작업 완료 후 컨텍스트 반환
```
**Verification**: SPEC AC #8

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 |  |
| 2 | AC-1 |  |
| 3 | AC-2 |  |
| 4 | AC-2 |  |
| 5 | AC-3 |  |
| 6 | AC-4 |  |
| 7 | AC-5 |  |
| 8 | AC-6 |  |
| 9 | AC-7 |  |
| 10 | AC-8 |  |
