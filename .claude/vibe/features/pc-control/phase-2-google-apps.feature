# Feature: pc-control — Phase 2: Google Apps

**SPEC**: `.claude/vibe/specs/pc-control/phase-2-google-apps.md`
**Master Feature**: `.claude/vibe/features/pc-control/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자
**I want** 내 Google 계정과 연동하여 Gmail, Drive, Sheets, Calendar를 AI가 조작하도록
**So that** "오늘 일정 확인해줘", "이 파일 Drive에 올려줘" 같은 명령을 자연어로 실행할 수 있다

## Scenarios

### Scenario 1: OAuth PKCE 인증 플로우
```gherkin
Scenario: Google OAuth PKCE 인증을 수행한다
  Given 사용자가 Google 계정 연동을 요청한다
  When OAuth 인증 URL이 생성된다
  Then PKCE code_verifier + code_challenge가 포함된다
  And 사용자가 브라우저에서 동의하면 access_token이 발급된다
  And refresh_token이 암호화되어 저장된다
```
**Verification**: SPEC AC #1

### Scenario 2: Incremental Scope 요청
```gherkin
Scenario: 필요한 시점에 추가 스코프를 요청한다
  Given 사용자가 Gmail 읽기 스코프만 승인한 상태이다
  When 사용자가 "Drive에 파일 올려줘"를 요청한다
  Then drive.file 스코프 추가 동의가 요청된다
  And 동의 후 기존 토큰에 스코프가 추가된다
```
**Verification**: SPEC AC #2

### Scenario 3: Token Envelope Encryption
```gherkin
Scenario: 토큰이 봉투 암호화로 저장된다
  Given 사용자가 OAuth 인증을 완료한다
  When refresh_token이 저장된다
  Then AES-256-GCM으로 암호화된다 (DEK)
  And DEK가 별도 KEK로 보호된다
  And 평문 토큰은 메모리에만 존재한다
```
**Verification**: SPEC AC #3

### Scenario 4: Gmail 읽기/검색
```gherkin
Scenario: Gmail에서 최근 메일을 검색한다
  Given Google OAuth가 gmail.readonly 스코프로 인증된 상태이다
  When core_google_gmail_search 도구를 { query: "from:github.com", maxResults: 5 } 으로 호출한다
  Then 최근 5개 매칭 이메일의 제목, 발신자, 날짜가 반환된다
```
**Verification**: SPEC AC #4

### Scenario 5: Gmail 발송
```gherkin
Scenario: Gmail로 이메일을 발송한다
  Given Google OAuth가 gmail.send 스코프로 인증된 상태이다
  When core_google_gmail_send 도구를 호출한다
  Then 지정된 수신자에게 이메일이 발송된다
  And 발송 결과 (messageId)가 반환된다
```
**Verification**: SPEC AC #5

### Scenario 6: Drive 파일 업로드/목록
```gherkin
Scenario: Google Drive에 파일을 업로드한다
  Given Google OAuth가 drive.file 스코프로 인증된 상태이다
  When core_google_drive_upload 도구를 호출한다
  Then 파일이 Drive에 업로드된다
  And 공유 링크가 반환된다
```
**Verification**: SPEC AC #6

### Scenario 7: Sheets 읽기/쓰기
```gherkin
Scenario: Google Sheets 데이터를 읽는다
  Given Google OAuth가 spreadsheets 스코프로 인증된 상태이다
  When core_google_sheets_read 도구를 호출한다
  Then 지정 범위의 셀 데이터가 2D 배열로 반환된다
```
**Verification**: SPEC AC #7

### Scenario 8: Calendar 이벤트 조회/생성
```gherkin
Scenario: 오늘 일정을 조회한다
  Given Google OAuth가 calendar 스코프로 인증된 상태이다
  When core_google_calendar_list 도구를 { date: "today" } 으로 호출한다
  Then 오늘의 일정 목록이 시간순으로 반환된다
```
**Verification**: SPEC AC #8

### Scenario 9: SaaS 멀티유저 토큰 격리
```gherkin
Scenario: SaaS 모드에서 사용자별 토큰이 격리된다
  Given SaaS 모드가 활성화되어 있다
  And 사용자 A와 사용자 B가 각각 Google 인증을 완료한다
  When 사용자 A가 Gmail을 조회한다
  Then 사용자 A의 토큰만 사용된다
  And 사용자 B의 Google 데이터에 접근할 수 없다
```
**Verification**: SPEC AC #9

### Scenario 10: Refresh Token Rotation
```gherkin
Scenario: Refresh Token이 갱신 시 교체된다
  Given access_token이 만료된다
  When refresh_token으로 갱신을 시도한다
  Then 새 access_token + 새 refresh_token이 발급된다
  And 이전 refresh_token은 무효화된다
  And 재사용 시도 시 모든 토큰 폐기 (reuse detection)
```
**Verification**: SPEC AC #10

### Scenario 11: CLI Google 인증 상태
```gherkin
Scenario: CLI로 Google 인증 상태를 확인한다
  Given VIBE 데몬이 실행 중이다
  When "vibe google status" 명령을 실행한다
  Then 인증 여부, 승인된 스코프 목록이 표시된다
```
**Verification**: SPEC AC #11

### Scenario 12: Google API 호출 실패 시 재시도 + 에러 메시지
```gherkin
Scenario: Google API 호출 실패 시 3회 재시도 후 사용자 친화적 메시지를 반환한다
  Given Google OAuth가 인증된 상태이다
  And Google API 서버가 일시적으로 응답하지 않는다
  When core_google_gmail_search 도구를 호출한다
  Then 3회 재시도한다 (1s → 2s → 4s backoff)
  And 최종 실패 시 "Google 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요" 메시지가 반환된다
  And 에러 메시지에 토큰 값이 포함되지 않는다
```
**Verification**: SPEC AC (Error Handling)

### Scenario 13: Token Refresh 실패 시 재인증 유도
```gherkin
Scenario: Token Refresh 실패 시 재인증을 유도한다
  Given access_token이 만료되었다
  And refresh_token도 무효화되었다
  When 자동 토큰 갱신을 시도한다
  Then 갱신이 실패한다
  And "Google 인증이 만료되었습니다. 'vibe google auth'로 재인증해주세요" 메시지가 반환된다
```
**Verification**: SPEC AC (Error Handling)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | OAuth PKCE 인증 | ✅ |
| 2 | Incremental Scope | ✅ |
| 3 | Token Encryption | ✅ |
| 4 | Gmail 읽기/검색 | ✅ |
| 5 | Gmail 발송 | ✅ |
| 6 | Drive 업로드/목록 | ✅ |
| 7 | Sheets 읽기/쓰기 | ✅ |
| 8 | Calendar 조회/생성 | ✅ |
| 9 | 멀티유저 토큰 격리 | ✅ |
| 10 | Token Rotation | ✅ |
| 11 | CLI 상태 확인 | ✅ |
| 12 | API 실패 재시도 | ✅ |
| 13 | Token Refresh 실패 | ✅ |
