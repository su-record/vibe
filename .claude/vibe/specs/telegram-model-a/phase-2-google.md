---
status: pending
currentPhase: 2
totalPhases: 4
createdAt: 2026-02-07T09:39:00+09:00
lastUpdated: 2026-02-07T09:39:00+09:00
---

# SPEC: telegram-model-a / Phase 2 - Google Apps 라우트

## Persona
<role>
TypeScript/Node.js 시니어 개발자. Google APIs (Gmail, Drive, Sheets, Calendar, YouTube) 통합에 전문성을 가지며, OAuth 2.0 플로우와 API 쿼터 관리에 능숙하다. 기존 SyncEngine의 Google OAuth 패턴을 확장하여 통합 토큰 관리를 구현한다.
</role>

## Context
<context>
### Background
텔레그램에서 Google 서비스를 자연어로 제어하는 라우트. "메일 보내줘", "일정 추가해줘", "유튜브 요약해줘" 등의 명령을 Google API로 실행한다. API로 불가능한 작업은 Playwright fallback을 사용한다.

### Who
본인 전용 (1인), Gmail/Drive/Calendar는 본인 계정

### Tech Stack
- Google: googleapis v144+ (Gmail API v1, Drive API v3, Sheets API v4, Calendar API v3, YouTube Data API v3)
- Auth: Google OAuth 2.0 (기존 SyncEngine 토큰 통합)
- Browser: Playwright v1.50+ (fallback)
- Existing: SyncEngine, BaseRoute, RouteRegistry, NotificationManager

### Related Code
- `src/sync/SyncEngine.ts`: Google Drive OAuth 기존 구현 (확장 대상)
- `src/router/routes/BaseRoute.ts`: Phase 1에서 생성
- `src/router/RouteRegistry.ts`: Phase 1에서 생성
- `src/router/notifications/NotificationManager.ts`: Phase 1에서 생성

### Design Reference
- Google API Explorer 공식 문서
- 기존 SyncEngine의 OAuth 패턴

### Research Insights
- **Gemini**: Google API `fields` 파라미터로 응답 최소화, syncToken/historyId로 증분 동기화
- **Kimi**: Google API 429 시 exponential backoff + jitter, batch 응답의 부분 성공 개별 처리
- **GPT 보안**: OAuth 스코프 최소화 (least privilege), 토큰 암호화 저장
- **Gemini 보안**: 토큰 refresh rotation, revocation 지원
</context>

## Task
<task>
### Phase 2.1: OAuth 통합 및 Google 기반
1. [ ] `src/sync/SyncEngine.ts` 수정 — OAuth 스코프 확장
   - 추가 스코프:
     - `https://www.googleapis.com/auth/gmail.readonly` + `https://www.googleapis.com/auth/gmail.send` (읽기+전송, 최소 권한)
     - `https://www.googleapis.com/auth/spreadsheets` (시트 읽기/쓰기)
     - `https://www.googleapis.com/auth/calendar` (캘린더 읽기/쓰기)
     - `https://www.googleapis.com/auth/youtube.readonly` (유튜브 읽기)
     - Drive는 기존 스코프 유지
   - 토큰 통합 저장: `~/.vibe/google-tokens.json` (기존 경로 유지)
   - incremental consent: 필요한 스코프만 추가 요청
   - Verify: `npx tsc --noEmit`

2. [ ] `src/router/services/GoogleAuthManager.ts` 생성
   - SyncEngine의 OAuth 클라이언트 재사용
   - 토큰 자동 갱신 (access token 만료 시)
   - 인증 상태 확인: `isAuthenticated(): boolean`
   - 인증 URL 생성: `getAuthUrl(): string` (텔레그램으로 전송용)
   - 토큰 교환: `exchangeCode(code): Promise<void>`
   - googleapis 클라이언트 반환: `getClient(): OAuth2Client`
   - Verify: `npx tsc --noEmit`

### Phase 2.2: Gmail Service
3. [ ] `src/router/services/GmailService.ts` 생성
   - 메일 전송: `sendMail({ to, subject, body, html?, attachments? })`
     - 임의 주소 + 나에게 보내기 지원
     - HTML/plain text 지원
     - 파일 첨부: base64 인코딩, MIME multipart
   - 메일 검색: `searchMail(query, maxResults = 10)`
     - Gmail 검색 문법 지원 (from:, subject:, after: 등)
   - 메일 읽기: `getMail(messageId): MailContent`
     - 본문, 첨부파일 목록, 메타데이터
   - 에러 처리: 429 retry (exponential backoff 3회), 인증 만료 시 재인증 안내
   - Verify: unit test

### Phase 2.3: Drive Service
4. [ ] `src/router/services/DriveService.ts` 생성
   - 파일 업로드: `upload(filePath, folderId?): FileMetadata`
     - resumable upload (5MB 이상)
     - MIME 타입 자동 감지
   - 파일 다운로드: `download(fileId, destPath): void`
   - 폴더 생성: `createFolder(name, parentId?): FolderMetadata`
   - 파일 검색: `search(query, maxResults = 20): FileMetadata[]`
     - Drive 검색 문법 지원
   - 파일 목록: `list(folderId?, maxResults = 50): FileMetadata[]`
   - 파일 공유: `share(fileId, email, role = 'reader'): void`
   - fields 파라미터로 응답 최소화
   - Verify: unit test

### Phase 2.4: Sheets Service
5. [ ] `src/router/services/SheetsService.ts` 생성
   - 스프레드시트 생성: `create(title): SpreadsheetMetadata`
   - 셀/범위 읽기: `read(spreadsheetId, range): CellData[][]`
   - 셀/범위 쓰기: `write(spreadsheetId, range, values): void`
   - 데이터 추가: `append(spreadsheetId, range, values): void`
   - A1 notation 지원
   - batch 업데이트 지원 (여러 범위 동시 쓰기)
   - Verify: unit test

### Phase 2.5: YouTube Service
6. [ ] `src/router/services/YouTubeService.ts` 생성
   - 비디오 검색: `search(query, maxResults = 5): VideoInfo[]`
   - 비디오 정보: `getVideo(videoId): VideoDetail` (제목, 설명, 길이, 조회수)
   - 자막 가져오기: `getCaptions(videoId): CaptionText`
     - 사용 가능한 자막 목록 → 한국어/영어 우선 선택
   - LLM 요약: `summarize(videoId): string`
     - 자막 텍스트 → SmartRouter로 LLM 요약 요청
   - Verify: unit test

### Phase 2.6: Calendar Service
7. [ ] `src/router/services/CalendarService.ts` 생성
   - 일정 조회: `listEvents(timeMin, timeMax, maxResults = 10): CalendarEvent[]`
     - "내일 일정", "이번 주 일정" 등 자연어 → 날짜 범위 변환
   - 일정 추가: `createEvent({ summary, start, end, description?, location? }): CalendarEvent`
     - 자연어 시간 파싱: "내일 오후 3시" → ISO 8601
   - 일정 수정: `updateEvent(eventId, updates): CalendarEvent`
   - 일정 삭제: `deleteEvent(eventId): void`
   - timezone: Asia/Seoul 기본
   - Verify: unit test

### Phase 2.7: Playwright Browser Manager
8. [ ] `src/router/browser/BrowserManager.ts` 생성
   - 전용 봇 프로필 방식 (기존 Chrome 프로필과 완전 분리):
     - 프로필 디렉토리: `~/.vibe/browser-profile/` (봇 전용, 사용자 Chrome과 무관)
     - 최초 실행 시 빈 프로필 생성, Google 로그인은 OAuth 토큰 기반 자동 인증
     - 기존 Chrome 잠금 충돌 없음
   - Playwright persistent context 생성
   - headless: false (기본, configurable)
   - Verify: `npx tsc --noEmit`

9. [ ] `src/router/browser/BrowserPool.ts` 생성
   - 최대 3개 동시 브라우저 컨텍스트
   - 컨텍스트 획득/반환: `acquire(): BrowserContext`, `release(context): void`
   - 유휴 5분 후 컨텍스트 종료
   - 크래시 복구: watchdog + context 재시작
   - Verify: `npx tsc --noEmit`

### Phase 2.8: Google Route 통합
10. [ ] `src/router/routes/GoogleRoute.ts` 생성
    - canHandle: intent.category === 'google'
    - subIntent 분류:
      - `gmail_send`, `gmail_search`, `gmail_read`
      - `drive_upload`, `drive_download`, `drive_search`, `drive_share`
      - `sheets_create`, `sheets_read`, `sheets_write`
      - `youtube_search`, `youtube_info`, `youtube_summarize`
      - `calendar_list`, `calendar_create`, `calendar_update`, `calendar_delete`
    - 인증 확인: 미인증 시 인증 URL 텔레그램 전송
    - 결과 포맷팅: 서비스별 텔레그램 메시지 포맷
    - Verify: integration test

### Phase 2.9: 테스트
11. [ ] Unit Tests 작성
    - 각 서비스별 핵심 메서드 테스트 (mock googleapis)
    - OAuth 토큰 갱신 로직 테스트
    - Verify: `npx vitest run`

12. [ ] `package.json` 수정 — 의존성 추가
    - `googleapis: ^144.0.0`
    - `playwright: ^1.50.0`
    - Verify: `npm install`
</task>

## Constraints
<constraints>
- 기존 SyncEngine의 OAuth 패턴 유지하면서 스코프만 확장
- Google API 스코프 최소화 (least privilege)
- fields 파라미터로 API 응답 최소화
- 429/503 에러 시 exponential backoff + jitter (최대 3회)
- 토큰 암호화 저장 (`~/.vibe/google-tokens.json`, 파일 권한 0600)
- Playwright: 기존 Chrome 프로필 복사본 사용 (원본 잠금 충돌 방지)
- 크로스 플랫폼: Chrome 프로필 경로 자동 감지
- 함수 길이 30줄 이내, Nesting 3 이하
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/router/services/GoogleAuthManager.ts`
- `src/router/services/GmailService.ts`
- `src/router/services/DriveService.ts`
- `src/router/services/SheetsService.ts`
- `src/router/services/YouTubeService.ts`
- `src/router/services/CalendarService.ts`
- `src/router/browser/BrowserManager.ts`
- `src/router/browser/BrowserPool.ts`
- `src/router/routes/GoogleRoute.ts`

### Files to Modify
- `src/sync/SyncEngine.ts` (OAuth 스코프 확장)
- `package.json` (googleapis, playwright 추가)

### Test Files to Create
- `src/router/services/GmailService.test.ts`
- `src/router/services/DriveService.test.ts`
- `src/router/services/SheetsService.test.ts`
- `src/router/services/YouTubeService.test.ts`
- `src/router/services/CalendarService.test.ts`
- `src/router/routes/GoogleRoute.test.ts`

### Verification Commands
- `npx tsc --noEmit`
- `npx vitest run`
- `npm install`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: "메일 보내줘" → Gmail API로 메일 전송 → 텔레그램에 전송 확인 알림
- [ ] AC-2: "내일 일정 알려줘" → Calendar API로 일정 조회 → 포맷팅된 목록 텔레그램 전송
- [ ] AC-3: "유튜브 요약해줘 [URL]" → 자막 추출 → LLM 요약 → 텔레그램 전송
- [ ] AC-4: "스프레드시트에 데이터 추가해줘" → Sheets API로 append → 확인 알림
- [ ] AC-5: "파일 업로드해줘" → Drive API로 업로드 → 공유 링크 텔레그램 전송
- [ ] AC-6: OAuth 미인증 시 인증 URL이 텔레그램으로 전송됨
- [ ] AC-7: Google API 429 에러 시 자동 재시도 (exponential backoff, 최대 3회)
- [ ] AC-8: Playwright fallback: API 불가 작업 시 Chrome 프로필 복사본으로 브라우저 실행
- [ ] AC-9: `npx tsc --noEmit` 빌드 성공
- [ ] AC-10: `npx vitest run` 모든 테스트 통과

### Ambiguity Scan Auto-fixes

- CalendarService 자연어 시간 파싱: LLM 파싱 + date-fns 검증, 실패 시 사용자 재확인
- Gmail 첨부파일 최대 25MB (API 제한), 초과 시 Drive 링크 대체
- Drive MIME 타입: 확장자 기반 맵핑 (기본 application/octet-stream)
</acceptance>
