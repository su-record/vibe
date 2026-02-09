---
status: pending
phase: 3
parent: _index.md
depends_on: [phase-1]
---

# SPEC: Phase 3 - Gemini Live Vision + Missing Tools

## Persona
<role>
Senior real-time systems engineer specializing in WebSocket streaming and multimodal AI.
- GeminiVision REST → Gemini Live WebSocket 전환
- 누락된 도구 모듈(browser agent, DM pairing) 추가
- OpenClaw에서 영감받은 기능 도입
</role>

## Context
<context>
### Background
두 가지 핵심 결함:
1. `GeminiVision.ts`가 REST API 사용 — `analyzeStream()`이 가짜(REST 루프), `startLiveSession()`이 flag만 설정
2. OpenClaw에 있는 브라우저 에이전트 업그레이드, DM 페어링 기능 누락

### 현재 GeminiVision (REST, 가짜 스트리밍)
`src/interface/vision/GeminiVision.ts`:
- `analyzeFrame()`: REST `generateContent` API로 단일 프레임 분석
- `analyzeStream()`: 단순 루프로 REST 호출 반복 (진짜 스트리밍 아님)
- `startLiveSession()` / `stopLiveSession()`: boolean flag만 토글

### Gemini Live API (Target)
- WebSocket: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`
- 양방향 스트리밍: 오디오/비디오/이미지 실시간 전송 + 실시간 응답
- 세션 기반: setup message → content messages → response streaming
- 인증: API Key (query param) 또는 OAuth (Bearer token)

### Research Insights (Gemini)
- WebSocket 연결 유지: PING/PONG + 5분 idle timeout
- 멀티모달 입력: base64 인코딩 (image/jpeg, audio/wav)
- 응답 스트리밍: 부분 응답 청크로 도착, 클라이언트에서 조합

### Related Code
- `src/interface/vision/GeminiVision.ts`: 전면 재작성 대상
- `src/interface/vision/VisionInterface.ts`: GeminiVision 사용처
- `src/agent/tools/vision-analyze.ts`: vision_analyze 도구
- `src/agent/tools/vision-capture.ts`: vision_capture 도구
- `src/router/browser/BrowserAgent.ts`: 기존 브라우저 에이전트
</context>

## Task
<task>
### Task 3.1: GeminiVision → GeminiLive 재작성
1. [ ] `src/interface/vision/GeminiLive.ts` 신규 작성
   - WebSocket 클라이언트 (`node:net` + TLS)
   - 연결 관리:
     a. `connect()`: WSS 연결 + setup message 전송
     b. `disconnect()`: graceful close (opcode 0x8)
     c. 자동 재연결: exponential backoff (1s → 2s → 4s, max 30s, 3회)
   - 세션 프로토콜:
     a. setup: `{ model, systemInstruction }` 전송
     b. `sendContent()`: 텍스트/이미지/오디오 전송
     c. `onResponse()`: 스트리밍 응답 수신 + 조합
   - Heartbeat: 30초 PING 주기
   - 인증: `GEMINI_API_KEY` (query param) 또는 OAuth token
   - Verify: `npx vitest run src/interface/vision/GeminiLive.test.ts`

2. [ ] `src/interface/vision/GeminiLive.test.ts` 작성
   - Mock WebSocket 서버로 테스트
   - 연결/해제/재연결 시나리오
   - 텍스트/이미지 전송 + 응답 수신
   - Heartbeat timeout 시 자동 재연결

### Task 3.2: VisionInterface 업데이트
1. [ ] `src/interface/vision/VisionInterface.ts` 수정
   - GeminiVision → GeminiLive 교체
   - `analyzeFrame()`: GeminiLive.sendContent() 호출
   - `analyzeStream()`: 실시간 WebSocket 스트리밍
   - `startSession()` / `stopSession()`: WebSocket 연결 관리
   - Verify: `npm run build`

### Task 3.3: Vision 도구 업데이트
1. [ ] `src/agent/tools/vision-analyze.ts` 수정
   - REST 호출 → GeminiLive.sendContent() 호출
   - 스트리밍 응답 지원
   - JSON Schema 직접 정의 (Phase 1 패턴)
   - Verify: `npx tsc --noEmit`

2. [ ] `src/agent/tools/vision-capture.ts` 수정
   - 스크린 캡처 → base64 → GeminiLive.sendContent()
   - JSON Schema 직접 정의
   - Verify: `npx tsc --noEmit`

### Task 3.4: 브라우저 에이전트 업그레이드
1. [ ] `src/router/browser/BrowserAgent.ts` 도구 등록
   - 기존 BrowserAgent.browse() 메서드를 ToolDefinition handler로 래핑 (adapter 패턴)
   - `web_browse_advanced` 도구:
     a. URL 입력 → 페이지 로드 → 컨텐츠 추출
     b. JavaScript 실행 지원
     c. 스크린샷 캡처
   - SSRF 방어: 기존 `web-browse.ts` 검증 로직 재사용
     - 차단 대상: private IP (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 127.0.0.0/8, 0.0.0.0/8, ::1, fc00::/7, fe80::/10, ::ffff:127.0.0.0/104)
     - 허용 scheme: http, https만 (file://, ftp:// 차단)
     - DNS resolution 후 IP 재검증 (DNS rebinding 방지): resolve→validate→connect 순서, 캐시된 IP로 직접 연결 + Host 헤더 설정
     - HTTP redirect 최대 3회, **각 redirect 대상 URL에 DNS resolve→IP validate→connect 전체 과정 재적용** (redirect followRedirects 비활성화, 수동 처리)
   - JSON Schema 직접 정의
   - Verify: `npx tsc --noEmit`

### Task 3.5: DM Pairing 도구
1. [ ] `src/agent/tools/dm-pair.ts` 작성
   - 채널 간 메시지 브릿지 (예: Telegram 메시지를 Slack으로 전달)
   - Schema: `{ sourceChannel, targetChannel, message }`
   - allowlist 기반 채널 제한
   - PolicyEngine safety policy로 보호
   - JSON Schema 직접 정의
   - Verify: `npx vitest run src/agent/tools/dm-pair.test.ts`

### Task 3.6: 통합 테스트
1. [ ] `src/interface/vision/vision-integration.test.ts` 작성
   - Mock WebSocket으로 GeminiLive 연결 검증
   - 프레임 분석 → 응답 수신 end-to-end
   - 재연결 시나리오
   - Verify: `npx vitest run src/interface/vision/`
</task>

## Constraints
<constraints>
- GeminiLive는 macOS 외 플랫폼에서도 텍스트/이미지 모드로 작동해야 함
- WebSocket 구현: `ws` npm 패키지 사용 가능 (기존 WebServer.ts는 manual RFC 6455이나, 클라이언트는 라이브러리 사용 허용)
- 기존 `GeminiVision.ts`는 삭제하지 않고 deprecated 주석 추가 (fallback 유지)
- Vision 도구의 기존 handler 시그니처 유지
- SSRF 방어: `web-browse.ts`의 `isPrivateIP()`, `isAllowedUrl()` 함수 재사용
- base64 이미지 크기 제한: 5MB
- WebSocket 메시지 크기 제한: 10MB
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/interface/vision/GeminiLive.ts`
- `src/interface/vision/GeminiLive.test.ts`
- `src/interface/vision/vision-integration.test.ts`
- `src/agent/tools/dm-pair.ts`
- `src/agent/tools/dm-pair.test.ts`

### Files to Modify
- `src/interface/vision/VisionInterface.ts`
- `src/agent/tools/vision-analyze.ts`
- `src/agent/tools/vision-capture.ts`
- `src/agent/tools/index.ts` (새 도구 추가)

### Files to Deprecate
- `src/interface/vision/GeminiVision.ts` (deprecated 주석 추가)

### Verification Commands
- `npx tsc --noEmit`
- `npm run build`
- `npx vitest run src/interface/vision/`
- `npx vitest run src/agent/tools/`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: GeminiLive가 WebSocket으로 연결되어 실시간 양방향 통신 작동
- [ ] AC-2: 이미지 프레임이 base64로 인코딩되어 Gemini에 전송되고 분석 결과 수신
- [ ] AC-3: WebSocket 연결 끊김 시 exponential backoff로 자동 재연결 (최대 3회)
- [ ] AC-4: Heartbeat(PING/PONG)로 idle timeout 방지
- [ ] AC-5: vision_analyze 도구가 GeminiLive를 통해 실시간 분석 수행
- [ ] AC-6: DM pairing 도구가 채널 간 메시지 전달 (allowlist 준수)
- [ ] AC-7: SSRF 방어가 모든 브라우저/Vision 관련 도구에 적용
- [ ] AC-8: 모든 테스트 통과 + 빌드 성공
- [ ] AC-9: base64 이미지 5MB 초과 시 에러 반환 (연결 유지)
- [ ] AC-10: WebSocket 메시지 10MB 초과 시 에러 반환 (연결 유지)
</acceptance>
