---
status: pending
phase: 1
parent: _index.md
---

# SPEC: openclaw-integration — Phase 1: Foundation

## Persona
<role>
Senior TypeScript 개발자. Vibe 프레임워크의 인증/토큰 관리 아키텍처를 깊이 이해하고 있으며, 동시성 제어와 파일 시스템 보안에 경험이 풍부하다.
</role>

## Context
<context>
### Background
현재 Vibe는 GPT와 Gemini의 OAuth 토큰 리프레시를 각 모듈에서 개별적으로 처리한다. 병렬 에이전트 실행 시 동시에 토큰을 리프레시하면 Race Condition이 발생할 수 있다. 또한 Gemini CLI를 이미 설치한 사용자가 있다면 기존 인증 정보를 자동으로 가져올 수 있어야 한다.

### Tech Stack
- TypeScript (ESM, strict)
- Node.js `fs` + `crypto` (file locking)
- 기존 모듈: `src/lib/gpt-oauth.ts`, `src/lib/gemini-oauth.ts`

### Related Code
- `src/lib/gpt-oauth.ts`: `getValidAccessToken()` (라인 442-471) — 현재 리프레시 지점
- `src/lib/gemini-oauth.ts`: `getValidAccessToken()` (라인 442-466) — 현재 리프레시 지점
- `src/lib/gemini/auth.ts`: `getAuthInfo()` — Gemini 인증 진입점
- `src/lib/llm/auth/ConfigManager.ts`: `getGlobalConfigDir()` — 설정 디렉토리 경로
- `src/lib/llm/auth/ApiKeyManager.ts`: API 키 CRUD 패턴
</context>

## Task
<task>
### Phase 1-A: Centralized Token Refresh + File Lock

1. [ ] `src/lib/llm/auth/TokenRefresher.ts` 생성 (~100 lines)
   - `TokenRefresher` 클래스 구현
   - `refreshWithLock(provider, refreshFn, refreshToken)` 메서드
   - In-process dedupe: provider별 in-flight Promise Map으로 동일 프로세스 내 중복 호출 방지 (결과 공유)
   - 파일 lock: `{getGlobalConfigDir()}/.refresh-{provider}.lock` (mkdir atomic 패턴)
   - Lock 디렉토리 내부에 `owner.json` (pid + createdAt) 기록하여 stale 판정 근거 확보
   - Stale lock 감지: createdAt 기준 30초 이상 + process.kill(pid, 0)으로 PID 생존 확인 후 해제 (삭제 전 owner 재확인으로 TOCTOU 방지)
   - Lock timeout: 10초 (대기 후 실패)
   - Lock 미획득 시: provider-specific `readCurrentToken()` callback으로 토큰 저장소를 500ms 간격으로 polling, accessToken 변경 + 미만료 확인 시 즉시 반환 (max poll: 30초, 초과 시 lock 없이 refresh 시도)
   - Singleton export: `export const tokenRefresher`
   - File: `src/lib/llm/auth/TokenRefresher.ts`
   - Verify: `npx vitest run src/lib/llm/auth/TokenRefresher.test.ts`

2. [ ] `src/lib/gpt-oauth.ts` 수정 (+10 lines)
   - `getValidAccessToken()` 내부에서 `refreshAccessToken()` 호출을 `tokenRefresher.refreshWithLock()` 으로 래핑
   - File: `src/lib/gpt-oauth.ts`

3. [ ] `src/lib/gemini-oauth.ts` 수정 (+10 lines)
   - 동일 패턴 적용
   - File: `src/lib/gemini-oauth.ts`

4. [ ] `src/lib/llm/auth/index.ts` 수정 (+2 lines)
   - `TokenRefresher`, `tokenRefresher` re-export 추가

### Phase 1-B: Gemini CLI Auth Path

5. [ ] `src/lib/gemini/auth.ts` 수정 (+40 lines)
   - `getGeminiCliCredentials()` 함수 추가
   - 검색 경로: `~/.gemini/oauth_creds.json`, `~/.config/gemini-cli/oauth_creds.json`
   - 파일 검증: 일반 파일 여부(symlink 거부), 소유자 확인(macOS/Linux: process.getuid(), Windows: skip permission enforcement + 경고 로그, symlink 거부 + JSON schema validation으로 보호), 권한 0o600 이하
   - JSON schema validation + type guard (필수 필드: access_token, refresh_token, expiry_date, token_uri)
   - 토큰 만료 확인 (expiry_date 필드)
   - `getAuthInfo()`에서 OAuth 이전에 Gemini CLI 크레덴셜 체크 단계 추가

6. [ ] `src/lib/gemini-oauth.ts` 수정 (+20 lines)
   - `importGeminiCliTokens()` 함수 추가
   - `~/.gemini/oauth_creds.json` 포맷 → Vibe `GeminiOAuthTokens` 포맷 변환
   - `storage.addAccount()`로 저장

7. [ ] `src/cli/llm/gemini-commands.ts` 수정 (+10 lines)
   - `geminiStatus()` 내에서 계정이 없을 때 Gemini CLI 크레덴셜 감지 메시지
   - `geminiImport()` 함수 추가 (auto-import 트리거)
</task>

## Constraints
<constraints>
- 기존 `getValidAccessToken()` 동작을 깨뜨리지 않음
- Lock 파일은 프로세스 종료 시 자동 정리 (process.on('exit') 핸들러)
- Lock 실패 시에도 리프레시 시도 (lock은 best-effort)
- Gemini CLI 크레덴셜은 read-only로 참조 (원본 파일 수정 금지)
- Gemini CLI가 없어도 에러 없이 skip
- SIGINT/SIGTERM 핸들러로 lock 정리 (SIGKILL은 stale lock으로 처리)
- 토큰/리프레시 토큰은 로그에 절대 남기지 않음
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/llm/auth/TokenRefresher.ts` (~100 lines)
- `src/lib/llm/auth/TokenRefresher.test.ts` (~80 lines)

### Files to Modify
- `src/lib/gpt-oauth.ts` (+10 lines)
- `src/lib/gemini-oauth.ts` (+30 lines)
- `src/lib/gemini/auth.ts` (+30 lines)
- `src/cli/llm/gemini-commands.ts` (+10 lines)
- `src/lib/llm/auth/index.ts` (+2 lines)

### Verification Commands
- `npx vitest run src/lib/llm/auth/TokenRefresher.test.ts`
- `npx tsc --noEmit`
- `npm run build`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] `TokenRefresher.refreshWithLock()` 호출 시 lock 파일이 생성되고 완료 후 제거됨
- [ ] 동시에 2개의 리프레시 요청 시 하나만 실행되고 나머지는 대기 후 결과 공유
- [ ] 30초 이상 된 stale lock은 자동 해제됨
- [ ] Gemini CLI가 설치된 환경에서 `getAuthInfo()` 호출 시 CLI 토큰이 반환됨
- [ ] Gemini CLI가 없는 환경에서 에러 없이 기존 흐름으로 fallback
- [ ] `vibe gemini status` 실행 시 Gemini CLI 크레덴셜 감지 메시지 표시
- [ ] `npm run build` 성공
- [ ] TypeScript strict 모드 에러 없음
</acceptance>
