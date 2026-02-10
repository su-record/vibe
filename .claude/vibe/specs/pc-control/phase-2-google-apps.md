---
status: pending
phase: 2
---

# SPEC: pc-control — Phase 2: Google Apps Per-User OAuth

## Persona
<role>
Google APIs OAuth 2.0 전문가. 로컬에서는 본인 계정, SaaS에서는 사용자별 계정을 지원하는 per-user 토큰 관리 시스템을 구축한다.
</role>

## Context
<context>

### Background
- VIBE에 GoogleAuthManager 구현됨 (OAuth URL 생성 + 토큰 교환)
- Gmail, Drive, Sheets, Calendar, YouTube API 구조 있음
- **문제**: 1개 계정 고정 → per-user 토큰 관리 미구현
- **로컬**: 본인 Google 계정 사용 (OAuth consent 1회)
- **SaaS**: 각 사용자가 자신의 Google 계정 OAuth 인증

### Tech Stack
- googleapis (Official Google APIs Node.js client)
- OAuth 2.0 Authorization Code + PKCE
- better-sqlite3 (토큰 저장, envelope encryption)
- jose (JWT 검증)

### Related Code (VIBE 기존)
- `src/lib/llm/auth/` — API 키 관리 패턴
- `src/sync/` — Google Drive 업로드 (placeholder)
- `src/bridge/telegram-bridge.ts` — Telegram OAuth 인증 유도

### Research Insights
- **GPT**: Per-user incremental scopes, token vault pattern (envelope encryption), tenant-scoped data model
- **Gemini**: Just-in-Time OAuth Escalation (필요한 scope만 점진적 요청)
- **Kimi**: OAuth tokens in tmpfs + preemptive refresh at 80% lifetime
- **Security**: DPoP binding, refresh token rotation, reuse detection, tenant-level encryption keys
</context>

## Task
<task>

### Phase 2-1: Per-User Token Store
1. [ ] `src/google/TokenStore.ts` — SQLite 기반 per-user 토큰 저장소
   - 테이블: `google_tokens(user_id, provider, scope_hash, access_token_enc, refresh_token_enc, expires_at, created_at, family_id, generation, dek_wrapped, kek_version)`
   - 테이블: `token_families(family_id, user_id, created_at, compromised, last_used_at)`
   - Envelope encryption: master key로 DEK 암호화, DEK로 토큰 암호화 (kek_version 관리)
   - Master key: 로컬 = 파일시스템, SaaS = 환경변수/KMS
   - `save(userId, tokens)`, `load(userId, scopes)`, `revoke(userId)`
   - `createFamily()`, `rotateToken()`, `detectReuse()`, `invalidateFamily()`
   - Preemptive refresh at 80% lifetime + AsyncMutex (동시 갱신 방지)
   - Refresh token rotation + reuse detection (family 단위 폐기)
   - Verify: 암호화/복호화 테스트, family rotation, reuse detection

2. [ ] `src/google/ScopeManager.ts` — Incremental scope 관리
   - Scope 집합 관리: `gmail.send`, `drive.file`, `sheets`, `calendar.events`
   - Just-in-Time 요청: 필요한 scope만 점진적 추가
   - 현재 승인된 scope 조회
   - Verify: scope 추가/조회 테스트

### Phase 2-2: OAuth Flow
3. [ ] `src/google/OAuthFlow.ts` — OAuth 2.0 Authorization Code + PKCE
   - `generateAuthUrl(userId, scopes)`: 인증 URL 생성 (PKCE code_verifier)
   - `handleCallback(code, state)`: 토큰 교환 + 저장
   - Localhost callback server (로컬) / redirect URI (SaaS)
   - State parameter로 CSRF 방지
   - Verify: 인증 플로우 테스트

4. [ ] `src/google/OAuthFlow.ts` — 로컬 모드 전용
   - 로컬: `http://localhost:PORT/callback` 임시 서버
   - 브라우저 자동 열기 → 인증 → 콜백 수신 → 서버 종료
   - Verify: 로컬 OAuth 플로우 E2E

### Phase 2-3: Google API Wrappers
5. [ ] `src/google/services/GmailService.ts` — Gmail API
   - `sendEmail(userId, to, subject, body, attachments?)`: 메일 발송
   - `sendReport(userId, reportType, data)`: 에러/완료 리포트 발송
   - HTML 템플릿 기반 리포트 포맷
   - Verify: 메일 발송 테스트 (mock)

6. [ ] `src/google/services/DriveService.ts` — Drive API
   - `upload(userId, filePath, folderId?)`: 파일 업로드
   - `download(userId, fileId)`: 파일 다운로드
   - `list(userId, query)`: 파일 목록
   - Sync 모듈의 placeholder를 실제 구현으로 교체
   - Verify: 업로드/다운로드 테스트 (mock)

7. [ ] `src/google/services/SheetsService.ts` — Sheets API
   - `read(userId, spreadsheetId, range)`: 데이터 읽기
   - `write(userId, spreadsheetId, range, values)`: 데이터 쓰기
   - `createSheet(userId, title)`: 새 시트 생성
   - Verify: 읽기/쓰기 테스트 (mock)

8. [ ] `src/google/services/CalendarService.ts` — Calendar API
   - `createEvent(userId, event)`: 일정 생성
   - `listEvents(userId, timeMin, timeMax)`: 일정 조회
   - `updateEvent(userId, eventId, updates)`: 일정 수정
   - Verify: CRUD 테스트 (mock)

### Phase 2-4: MCP Tool 등록
9. [ ] `src/tools/google/index.ts` — MCP 도구
   - `core_google_auth`: OAuth 인증 시작/상태 확인
   - `core_gmail_send`: 메일 발송
   - `core_gmail_report`: 개발 리포트 발송 (에러/완료)
   - `core_drive_upload/download/list`: Drive 파일 관리
   - `core_sheets_read/write`: Sheets 데이터
   - `core_calendar_create/list`: Calendar 일정
   - Verify: MCP 서버 등록 확인

### Phase 2-5: CLI
10. [ ] `src/cli/commands/google.ts` — 기존 확장
   - `vibe google auth`: OAuth 인증 (브라우저 열기)
   - `vibe google status`: 인증 상태 + 승인된 scopes
   - `vibe google revoke`: 토큰 삭제
   - Verify: CLI 실행 테스트

### Phase 2-6: 테스트
11. [ ] `src/google/TokenStore.test.ts`
12. [ ] `src/google/OAuthFlow.test.ts`
13. [ ] `src/google/services/*.test.ts`
</task>

## Constraints
<constraints>
- 로컬 모드: 본인 Google 계정 1개 (user_id = "local")
- SaaS 모드: user_id = JWT sub claim
- Refresh token은 반드시 암호화 저장 (plaintext 금지)
- 로그/에러에 토큰 값 노출 금지
- Incremental scopes: 필요한 API 호출 시점에 scope 요청
- [P1] OAuth state/code_verifier: 서버 측 해시 저장, TTL 5분, 1회 사용 후 소멸, replay 시도 시 보안 이벤트 기록
- [P1] Token family 모델: `token_families(family_id, user_id, generation, compromised)` 테이블, reuse detection 시 전체 family 폐기 + 재인증
- [P1] Token refresh 동시 요청: AsyncMutex로 1회만 갱신, 나머지 대기 후 새 토큰 수신
- [P1] DPoP: "서버 지원 시 활성화" (선택), 기본은 PKCE + state 강화
- [P2] Scope 거절/부분 승인 시 `SCOPE_DENIED` 에러 + 기능별 degraded mode 안내
- [P2] Drive upload/download: Node.js Stream 사용 필수 (대용량 파일 OOM 방지)
- [P1] SaaS OAuth Relay: Phase 6 통합 전까지 `OAuthFlow.ts`에 `ICallbackHandler` 인터페이스 정의 (LocalCallbackServer 구현, SaaS용 RelayCallbackHandler는 Phase 6에서 구현)
- Google API 호출 실패 시 3회 재시도 (exponential backoff)
- 메일 리포트: HTML 템플릿 + 마크다운 본문
</constraints>

## Output Format
<output_format>

### Files to Create
- `src/google/TokenStore.ts`
- `src/google/ScopeManager.ts`
- `src/google/OAuthFlow.ts`
- `src/google/services/GmailService.ts`
- `src/google/services/DriveService.ts`
- `src/google/services/SheetsService.ts`
- `src/google/services/CalendarService.ts`
- `src/google/types.ts`
- `src/tools/google/index.ts`
- `src/google/TokenStore.test.ts`
- `src/google/OAuthFlow.test.ts`

### Files to Modify
- `src/cli/commands/` — google 명령어 확장
- `src/sync/` — Drive 실제 업로드 연결
- `src/tools/index.ts` — Google 도구 export

### Verification Commands
- `pnpm test -- --grep google`
- `pnpm build`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 로컬: `vibe google auth` → 브라우저 열림 → 인증 → 토큰 암호화 저장
- [ ] SaaS: 사용자별 독립 OAuth 토큰 관리
- [ ] `core_gmail_send`로 메일 발송 동작
- [ ] `core_gmail_report`로 에러/완료 리포트 HTML 메일 발송
- [ ] `core_drive_upload/download`로 파일 관리
- [ ] `core_sheets_read/write`로 스프레드시트 데이터 접근
- [ ] `core_calendar_create/list`로 일정 관리
- [ ] Refresh token 자동 갱신 (80% lifetime)
- [ ] 토큰 envelope encryption 적용
- [ ] Google API 호출 응답 ≤5초 (timeout 10초)
- [ ] Token refresh ≤2초, 실패 시 재인증 유도 메시지
- [ ] Google API 호출 실패 시 3회 재시도 (1s → 2s → 4s backoff)
- [ ] API 에러 시 사용자 친화적 메시지 반환 (토큰 값 미노출)
- [ ] OAuth 인증 플로우 콜백 수신 timeout 120초
- [ ] 모든 테스트 통과 + 빌드 성공
</acceptance>
