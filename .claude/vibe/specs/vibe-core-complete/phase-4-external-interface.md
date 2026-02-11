---
status: pending
phase: 4
createdAt: 2026-02-06T10:49:09+09:00
---

# SPEC: Phase 4 - External Interface (Telegram, Web, Webhook)

## Persona

<role>
Senior backend engineer specializing in:
- Bot development (Telegram)
- WebSocket/HTTP server
- Real-time communication
- TypeScript strict mode
</role>

## Context

<context>

### Background
Vibe Core가 진정한 OS가 되려면 **다양한 입력 채널**을 지원해야 한다.
터미널 외에 Telegram, Web UI, Webhook 등에서 요청을 받아 동일한 방식으로 처리한다.

### Why
- 이동 중에도 코딩 작업 가능 (Telegram)
- 웹 기반 대시보드 (Web UI)
- CI/CD 연동 (Webhook)
- 어떤 채널이든 동일한 Job/Policy 파이프라인

### Tech Stack
- Telegram: node-telegram-bot-api (polling mode)
- Web: Express.js + WebSocket (ws)
- Claude Code 연동: `claude -p --stream-json` 모드

### Related Code
- `src/daemon/VibeDaemon.ts`: 데몬 서버
- `hooks/scripts/llm-orchestrate.js`: Gemini voice 연동 참고
- `commands/vibe.voice.md`: 음성 인터페이스 참고

### Design Reference
- OpenClaw: Claude Code 웹 인터페이스
- Telegram Bot API: 봇 개발 패턴

### Key Discovery (테스트 결과)
```bash
# Claude Code stream-json 모드로 양방향 통신 가능
echo '{"type":"user","message":{"role":"user","content":"1+1은?"}}' \
  | claude -p --input-format stream-json --output-format stream-json --verbose

# 응답도 JSON
{"type":"assistant","message":{"content":[{"text":"2입니다."}]}}
{"type":"result","subtype":"success","result":"2입니다."}
```

</context>

## Task

<task>

### Phase 4.1: Interface Abstraction
1. [ ] `src/interface/types.ts` 생성
   - ExternalInterface 인터페이스
   - Message 인터페이스 (채널 무관 공통 형식)
   - Response 인터페이스
   - Verify: 타입 체크 통과

2. [ ] `src/interface/BaseInterface.ts` 생성
   - 추상 클래스 (공통 로직)
   - 메시지 → Job 변환
   - 응답 포맷팅
   - Verify: 서브클래스 구현 테스트

### Phase 4.2: Telegram Bot
3. [ ] `src/interface/telegram/TelegramBot.ts` 생성
   - Polling 모드 (서버 불필요)
   - 메시지 수신 → Job 생성
   - 결과 → Telegram 메시지 전송
   - Verify: 봇 연결 테스트

4. [ ] Telegram 인증/설정
   - `vibe telegram setup` - 봇 토큰 설정
   - `vibe telegram chat <chat-id>` - 허용 채팅 설정
   - 토큰 저장: keytar(OS keychain) 우선, 불가 시 vault (`~/.vibe/vault.enc`)
   - Verify: 인증 플로우 테스트

5. [ ] Telegram 메시지 처리
   - 텍스트 → Intent 파싱
   - 음성 → Gemini STT → Intent
   - 파일 → 프로젝트에 저장 (파일명 sanitize, 최대 10MB, 허용 확장자: .ts/.js/.json/.md/.txt/.py/.html/.css, 대상 프로젝트는 채팅별 바인딩)
   - Verify: 각 메시지 유형 테스트

6. [ ] Telegram 응답 포맷팅
   - 코드 블록 (Markdown)
   - 긴 응답 분할 (4096자 제한)
   - 진행 상태 업데이트
   - Verify: 포맷팅 테스트

### Phase 4.3: Claude Code Bridge
7. [ ] `src/interface/ClaudeCodeBridge.ts` 생성
   - `claude -p --stream-json` 프로세스 관리
   - JSON 스트림 파싱
   - 양방향 통신 (stdin/stdout)
   - Verify: 통신 테스트

8. [ ] 멀티턴 대화 지원
   - 세션 유지 (`--resume` 옵션)
   - 컨텍스트 연속성
   - Verify: 멀티턴 테스트

9. [ ] 권한 요청 처리
   - Claude Code의 권한 요청 감지
   - 사용자에게 전달 (Telegram/Web)
   - 응답 받아 Claude Code에 전달
   - Verify: 권한 플로우 테스트

### Phase 4.4: Web Interface (Optional)
10. [ ] `src/interface/web/WebServer.ts` 생성
    - Express.js HTTP 서버
    - WebSocket 실시간 통신
    - 포트: 7860 (기본, VIBE_PORT 환경변수로 설정 가능)
    - **인증 토큰 lifecycle:**
      - 데몬 시작 시 crypto.randomBytes(32)로 생성
      - `~/.vibe/web-token` 파일에 저장 (권한 0600)
      - CLI가 자동 검색하여 사용
      - 토큰 갱신: `vibe web rotate-token`
    - **WebSocket 인증:**
      - 연결 시 첫 메시지로 `{"type":"auth","token":"..."}`
      - **인증 타임아웃: 3초 이내에 auth 메시지 미수신 시 연결 종료 (Slowloris 방지)**
      - 인증 실패 시 즉시 연결 종료
    - 외부 노출 시 HTTPS 강제 + rate limiting (100 req/min per IP)
    - 응답 시간: p95 < 500ms (API), p95 < 100ms (WebSocket ping)
    - Verify: 서버 시작 테스트, 인증 테스트, 비인증 연결 거부 테스트

11. [ ] Web API 엔드포인트
    - `POST /api/job` - Job 생성
    - `GET /api/job/:id` - Job 조회
    - `GET /api/jobs` - Job 목록
    - `WS /ws` - 실시간 스트림
    - **REST 인증:** 모든 HTTP 엔드포인트에 `Authorization: Bearer <token>` 헤더 필수 (WebSocket과 동일 토큰)
    - **CORS:** localhost만 허용 (기본), 외부 노출 시 명시적 origin allowlist 설정
    - **요청 제한:** Express body 최대 1MB, WebSocket maxPayload 1MB, 최대 동시 연결 50개, idle timeout 5분
    - Verify: API 테스트, 비인증 요청 거부 테스트, CORS 위반 테스트

### Phase 4.5: Webhook Interface
12. [ ] `src/interface/webhook/WebhookHandler.ts` 생성
    - HTTP POST 수신
    - 시크릿 검증: HMAC-SHA256 (`X-Hub-Signature-256` for GitHub, `X-Gitlab-Token` for GitLab)
    - **Replay 방지:** GitHub `X-GitHub-Delivery` / GitLab delivery ID 기반 nonce 저장 (SQLite, 1시간 보관 후 자동 정리)
    - **Raw body 필수:** HMAC 검증은 raw bytes 기준, Express `express.raw()` 미들웨어 사용 (JSON 파싱 전 검증)
    - GitHub/GitLab 이벤트 파싱
    - Verify: 웹훅 수신 테스트, 잘못된 시그니처 거부 테스트, 만료 타임스탬프 거부 테스트

13. [ ] Webhook 설정
    - `vibe webhook add <name> <secret>`
    - `vibe webhook list`
    - `vibe webhook remove <name>`
    - Verify: CLI 동작 테스트

### Phase 4.5b: Error Handling
12b. [ ] Telegram API 실패 처리
   - 네트워크 오류 시 재시도 (최대 3회, 지수 백오프: 1s/2s/4s)
   - Polling 연결 끊김 시 자동 재연결 (최대 5회, 이후 비활성화)
   - 봇 토큰 만료/무효 시 에러 로그 + 사용자 알림
   - Verify: 네트워크 단절 시뮬레이션 테스트

12c. [ ] Claude Code 프로세스 크래시 처리
   - 프로세스 비정상 종료 감지 (exit code != 0)
   - 세션 재시작 시도 (최대 2회)
   - 실패 시 해당 Job을 "failed" 상태로 전이 + 클라이언트 알림
   - Verify: 프로세스 크래시 복구 테스트

### Phase 4.6: CLI Integration
14. [ ] 인터페이스 관리 CLI
    - `vibe interface list` - 활성 인터페이스 목록
    - `vibe interface enable/disable <name>` - 인터페이스 활성화
    - Verify: CLI 동작 테스트

</task>

## Constraints

<constraints>
- **통합 Secret 저장:** 모든 자격증명(Telegram 토큰, Google OAuth, Webhook 시크릿)은 keytar(OS keychain) 우선, 불가 시 AES-256-GCM 암호화 vault (`~/.vibe/vault.enc`)
- Telegram 봇 토큰은 암호화 저장
- 허용된 chat_id만 요청 처리 (보안)
- Web 서버는 localhost만 바인딩 (기본)
- 외부 노출 시 인증 필수
- 메시지 4096자 초과 시 분할
- Claude Code 세션당 하나의 대화 (동시성 제한)
</constraints>

## Output Format

<output_format>

### Files to Create
- `src/interface/types.ts` - 타입 정의
- `src/interface/BaseInterface.ts` - 추상 클래스
- `src/interface/ClaudeCodeBridge.ts` - Claude Code 연동
- `src/interface/telegram/TelegramBot.ts` - Telegram 봇
- `src/interface/telegram/TelegramFormatter.ts` - 응답 포맷팅
- `src/interface/web/WebServer.ts` - Web 서버
- `src/interface/webhook/WebhookHandler.ts` - Webhook 처리
- `src/interface/index.ts` - 모듈 export
- `src/cli/commands/telegram.ts` - Telegram CLI
- `src/cli/commands/interface.ts` - 인터페이스 CLI

### Files to Modify
- `src/daemon/VibeDaemon.ts` - 인터페이스 관리
- `src/cli/index.ts` - 명령어 등록
- `package.json` - 의존성 추가 (node-telegram-bot-api, express, ws)

### Verification Commands
- `npm run build`
- `npm test`
- `vibe telegram setup && vibe daemon start`

</output_format>

## Acceptance Criteria

<acceptance>
- [ ] Telegram 봇으로 메시지 수신/응답
- [ ] Telegram 음성 메시지 → STT → 처리
- [ ] Claude Code stream-json 양방향 통신
- [ ] 멀티턴 대화 지원
- [ ] 권한 요청 Telegram으로 전달/응답
- [ ] Web API 동작 (선택)
- [ ] Webhook 수신 동작 (선택)
- [ ] `vibe telegram setup/chat` CLI 동작
- [ ] 빌드 성공
- [ ] 테스트 통과
</acceptance>
