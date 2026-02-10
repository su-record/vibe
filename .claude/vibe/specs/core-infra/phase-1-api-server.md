---
status: pending
currentPhase: 1
totalPhases: 5
createdAt: 2026-02-09T00:14:38Z
lastUpdated: 2026-02-09T00:14:38Z
---

# SPEC: core-infra — Phase 1: API Server (SSE + WebSocket)

## Persona
<role>
- Senior TypeScript/Node.js developer
- 기존 `WebServer` 및 `BaseInterface` 패턴에 정통
- WebSocket/SSE 스트리밍 프로토콜 전문가
- 보안(Auth, CORS, Rate Limiting) 설계 경험
</role>

## Context
<context>
### Background
- 현재 `WebServer`(src/interface/web/WebServer.ts)는 REST API만 지원 (POST /api/job, GET /api/job/:id)
- Visee(외부 UI: Electron Desktop + PWA)가 실시간 스트리밍 응답을 받으려면 SSE와 WebSocket 필요
- `AgentLoop`의 tool call 진행 상황, 최종 응답을 실시간 push
- 로컬(127.0.0.1) + 클라우드(0.0.0.0 + OAuth) 모두 지원

### Tech Stack
- `node:http` (기존 패턴 유지, 외부 프레임워크 미사용)
- `crypto` (token generation, timingSafeEqual)
- Zod (request validation)

### Related Code
- `src/interface/web/WebServer.ts`: 기존 REST API 서버 (확장 대상)
- `src/interface/BaseInterface.ts`: 추상 클래스
- `src/interface/types.ts`: `WebServerConfig`, `WebSocketMessage` 타입
- `src/router/types.ts`: `RouteServices` (sendTelegram 패턴 참고)
- `src/agent/AgentLoop.ts`: 메시지 처리 + tool call 루프

### Design Reference
- Anthropic Claude API SSE streaming 패턴
- OpenAI Realtime API WebSocket 패턴
</context>

## Task
<task>
### Phase 1-1: WebSocket 업그레이드 핸들링
1. [ ] `WebServer.ts`에 WebSocket upgrade 핸들러 추가
   - File: `src/interface/web/WebServer.ts`
   - `server.on('upgrade', ...)` 핸들링
   - 13-byte WebSocket handshake 구현 (node:crypto SHA-1)
   - Auth token 검증 후 upgrade 허용
   - Verify: WebSocket 연결 테스트

2. [ ] WebSocket 클라이언트 관리
   - File: `src/interface/web/WebServer.ts`
   - `Map<string, WebSocketClient>` 연결 풀
   - ping/pong heartbeat (30초 간격)
   - 최대 동시 연결 수 제한 (config.maxConnections, 기본 50)
   - 연결 종료 시 cleanup

3. [ ] WebSocket 메시지 프로토콜
   - File: `src/interface/web/types.ts` (신규)
   - 메시지 타입: `auth`, `message`, `subscribe`, `unsubscribe`, `ping`, `pong`
   - Zod 스키마로 inbound 메시지 검증
   - 구조화된 outbound 메시지: `{ type, jobId?, data, timestamp }`

### Phase 1-2: SSE 스트리밍 엔드포인트
4. [ ] SSE 연결 엔드포인트 추가
   - File: `src/interface/web/WebServer.ts`
   - `GET /api/stream` — SSE 연결 (Authorization Bearer token)
   - `GET /api/stream/:jobId` — 특정 job의 SSE 스트림
   - 올바른 SSE 헤더 설정 (`text/event-stream`, `no-cache`, `keep-alive`)
   - 15초 간격 `:keep-alive\n\n` comment 전송
   - 클라이언트 disconnection 감지 및 cleanup

5. [ ] SSE 이벤트 타입 정의
   - File: `src/interface/web/types.ts`
   - `job:created` — 새 job 생성
   - `job:progress` — tool call 진행 (tool name, status)
   - `job:chunk` — assistant 응답 청크 (스트리밍)
   - `job:complete` — 최종 응답
   - `job:error` — 에러 발생
   - `permission:request` — 권한 요청 (tool approval)

### Phase 1-3: AgentLoop 스트리밍 연동
6. [ ] AgentLoop에 progress callback 추가
   - File: `src/agent/AgentLoop.ts`
   - `AgentLoopDeps`에 `onProgress?: (event: AgentProgressEvent) => void` 추가
   - tool call 실행 전/후 progress 이벤트 emit
   - assistant 응답 시 chunk 이벤트 emit

7. [ ] WebServer ↔ AgentLoop 브릿지
   - File: `src/interface/web/WebServer.ts`
   - `POST /api/job` 시 AgentLoop.process() 호출 + progress callback 등록
   - progress callback → SSE/WebSocket으로 실시간 전달
   - jobId 기반으로 SSE 구독자에게만 전달

### Phase 1-4: 인증 및 보안
8. [ ] 이중 인증 모드
   - File: `src/interface/web/WebServer.ts`
   - **로컬 모드**: Bearer token (현재 방식, 변경 없음)
   - **클라우드 모드**: OAuth Bearer token + API key 검증
   - `VIBE_AUTH_MODE=local|cloud` 환경변수로 전환
   - 클라우드 모드: JWT 검증 (HS256 HMAC-SHA256, `VIBE_JWT_SECRET` 환경변수, node:crypto로 구현)
   - JWT payload 필수 필드: `{ sub: string, iat: number, exp: number }`
   - exp 만료 검증, clock skew 허용: 30초

9. [ ] Rate limiting 개선
   - File: `src/interface/web/WebServer.ts`
   - 현재 per-IP 100req/min → per-token sliding window로 변경
   - WebSocket/SSE 연결에도 rate limit 적용
   - 429 응답 시 `Retry-After` 헤더 포함

### Phase 1-5: Agent Export
10. [ ] package.json에 `"./agent"` export 추가
    - File: `package.json`
    - `"./agent": { "types": "./dist/agent/index.d.ts", "default": "./dist/agent/index.js" }`
    - Visee에서 `import { AgentLoop } from '@su-record/core/agent'` 가능

11. [ ] Agent 모듈 export index 생성
    - File: `src/agent/index.ts` (신규)
    - `AgentLoop`, `AgentLoopDeps`, `HeadModelSelector`, `ToolRegistry` export
    - 타입만 export하는 항목과 런타임 export 분리
</task>

## Constraints
<constraints>
- 기존 `node:http` 서버 확장 (외부 WebSocket/SSE 라이브러리 미사용)
- **CORS**: 로컬 모드 `Access-Control-Allow-Origin: *`, 클라우드 모드 `VIBE_CORS_ORIGINS` 환경변수로 허용 도메인 지정
- **WebSocket RFC 6455 준수**: Sec-WebSocket-Key/Accept 검증, masked client frame 필수, close/ping/pong control frame 핸들링, fragmentation 미지원 시 1009 close
- WebSocket 프레임 파싱은 RFC 6455 텍스트 프레임만 지원 (바이너리 프레임 수신 시 1003 Unsupported Data close frame 전송)
- **WebSocket upgrade 타임아웃**: handshake 미완료 시 5초 후 소켓 파기 (DoS 방지)
- **Job stream 접근 제어**: `/api/stream/:jobId` 구독 시 해당 job 생성 token과 일치 검증
- **SSE Event ID**: 모든 SSE 이벤트에 `id` 필드 포함 (monotonic ULID), 클라이언트 재연결 시 `Last-Event-ID` 헤더로 이벤트 재전송 (최대 30초 버퍼, 최대 1000이벤트/1MB 중 먼저 도달 시 oldest 삭제)
- **Backpressure 정책**: WS/SSE write buffer가 64KB 초과 시 slow client로 판정 → 연결 종료 (WS: close code 1013 Try Again Later)
- **브라우저 인증**: SSE — `?token=` 쿼리 파라미터 (단기 토큰, 5분 만료), WS — `Sec-WebSocket-Protocol` 헤더로 토큰 전달
- **JWT 검증 강화 (클라우드 모드)**: `alg=none` 거부, `iss`/`aud` 필수 검증, `nbf` 체크, base64url strict parsing
- SSE 연결당 메모리 ≤ 1KB (이벤트 큐잉 없이 즉시 push, Event ID 버퍼 제외)
- 최대 동시 WebSocket 연결: 50 (설정 가능)
- 최대 동시 SSE 연결: 100 (설정 가능)
- Auth token은 `crypto.timingSafeEqual`로 비교 (timing attack 방지)
- WebSocket 메시지 최대 크기: 64KB
- SSE 이벤트 최대 크기: 64KB
- Idle WebSocket 연결 timeout: 300초 (5분)
- Idle SSE 연결 timeout: 600초 (10분)
- REST API 응답 시간: ≤200ms (P95)
- WebSocket handshake 응답 시간: ≤100ms (P95)
- SSE 첫 이벤트 전달 시간: ≤300ms (P95)
- WebSocket 최대 연결 초과 시: 503 Service Unavailable + `Retry-After` 헤더
- SSE 최대 연결 초과 시: 503 Service Unavailable
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/interface/web/types.ts` — WebSocket/SSE 메시지 타입 + Zod 스키마
- `src/agent/index.ts` — Agent 모듈 export

### Files to Modify
- `src/interface/web/WebServer.ts` — WebSocket upgrade + SSE 엔드포인트
- `src/interface/types.ts` — `WebServerConfig` 확장 (maxSseConnections, authMode)
- `src/agent/AgentLoop.ts` — progress callback 추가
- `src/agent/types.ts` — `AgentProgressEvent` 타입 추가
- `package.json` — `"./agent"` export 추가

### Verification Commands
- `npx tsc --noEmit`
- `npx vitest run src/interface/`
- `npx vitest run src/agent/`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] WebSocket 연결 성공 (upgrade + auth)
- [ ] WebSocket 메시지 송수신 (JSON 프로토콜)
- [ ] SSE `/api/stream` 연결 및 이벤트 수신
- [ ] SSE `/api/stream/:jobId` 특정 job 스트리밍
- [ ] 15초 간격 keep-alive 전송
- [ ] ping/pong heartbeat 동작
- [ ] Idle 연결 자동 종료
- [ ] 인증 실패 시 401/403
- [ ] Rate limit 초과 시 429 + Retry-After
- [ ] AgentLoop progress → SSE/WS 실시간 전달
- [ ] `import { AgentLoop } from '@su-record/core/agent'` 동작
- [ ] TypeScript 컴파일 통과
- [ ] 기존 테스트 통과 (regression 없음)
</acceptance>
