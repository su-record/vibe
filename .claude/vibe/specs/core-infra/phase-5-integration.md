---
status: pending
currentPhase: 5
totalPhases: 5
createdAt: 2026-02-09T00:14:38Z
lastUpdated: 2026-02-09T00:14:38Z
---

# SPEC: core-infra — Phase 5: Integration & Multi-Channel Orchestration

## Persona
<role>
- Senior TypeScript architect
- 멀티채널 메시징 시스템 통합 경험
- 기존 VIBE daemon/router 아키텍처 숙지
- 테스트 전략 설계 (unit, integration, e2e)
</role>

## Context
<context>
### Background
- Phase 1~4에서 API Server, Vision, Slack, iMessage를 개별 구현
- Phase 5에서 이들을 통합하고, 멀티채널 라우팅, 공통 설정, 테스트를 완성
- `RouteServices`를 채널 무관하게 동작하도록 확장
- daemon 시작 시 설정에 따라 채널을 선택적으로 활성화

### Tech Stack
- 기존 daemon 구조 활용
- Zod (설정 스키마 검증)
- Vitest (테스트)

### Related Code
- `src/daemon/`: 서비스 시작/종료 lifecycle
- `src/router/`: 메시지 라우팅 로직
- `src/router/types.ts`: `RouteServices` — 현재 Telegram 전용 (`sendTelegram`)

### Design Reference
- 기존 daemon 초기화 패턴
</context>

## Task
<task>
### Phase 5-1: RouteServices 채널 추상화
1. [ ] RouteServices를 채널 무관하게 확장
   - File: `src/router/types.ts`
   - 현재 `sendTelegram` → `sendMessage(channel, chatId, text, options?)` 패턴 추가
   - 기존 `sendTelegram`은 호환성 유지 (deprecated 처리하지 않음, 그대로 유지)
   - `RouteServices.channels: Map<ChannelType, ExternalInterface>` 추가
   - 각 채널의 sendResponse를 통합하는 `sendToChannel()` 헬퍼

2. [ ] 멀티채널 메시지 브로드캐스트
   - File: `src/router/MultiChannelRouter.ts` (신규)
   - 단일 메시지 → 여러 채널로 전달 (설정에 따라)
   - 채널별 포맷 변환 자동 적용
   - 부분 실패 처리: 하나 실패해도 다른 채널은 계속 전송

### Phase 5-2: Daemon 채널 관리
3. [ ] 채널 설정 스키마
   - File: `src/interface/types.ts` (수정)
   - `VibeChannelsConfig` 통합 스키마 (Zod)
   - 각 채널 enabled/disabled + 개별 config
   - 환경변수 매핑 (VIBE_TELEGRAM_ENABLED, VIBE_SLACK_ENABLED, VIBE_IMESSAGE_ENABLED, VIBE_VISION_ENABLED)

4. [ ] Daemon 채널 초기화
   - File: `src/daemon/` (해당 파일 수정)
   - 시작 시 설정에 따라 채널 선택적 활성화
   - 각 채널의 start()/stop() lifecycle 관리
   - 실패한 채널은 로그 + 스킵 (다른 채널에 영향 없음)
   - graceful shutdown: 모든 채널 순차 stop()

### Phase 5-3: 공통 테스트
5. [ ] 채널 통합 테스트
   - File: `src/interface/__tests__/multi-channel.test.ts` (신규)
   - Mock 채널을 사용한 멀티채널 메시지 라우팅 테스트
   - 부분 실패 시나리오 테스트
   - 포맷 변환 정확성 테스트

6. [ ] API Server 테스트
   - File: `src/interface/web/__tests__/WebServer.test.ts` (신규 또는 확장)
   - WebSocket 연결/인증/메시지 교환 테스트
   - SSE 연결/이벤트 수신 테스트
   - Rate limit 테스트

7. [ ] Vision 테스트
   - File: `src/interface/vision/__tests__/vision.test.ts` (신규)
   - ScreenCapture mock 테스트 (플랫폼별)
   - GeminiVision mock 테스트 (API 응답 mock)
   - rate limit / 이미지 크기 제한 테스트

8. [ ] Slack/iMessage 테스트
   - File: `src/interface/slack/__tests__/SlackBot.test.ts` (신규)
   - File: `src/interface/imessage/__tests__/IMessageBot.test.ts` (신규)
   - Socket Mode 연결 mock
   - 메시지 파싱/포매팅 테스트
   - DB 폴링 mock (iMessage)

### Phase 5-4: 문서 및 설정
9. [ ] CLAUDE.md 업데이트
   - File: `CLAUDE.md`
   - Built-in Tools에 vision_capture, vision_analyze, send_slack, send_imessage 추가
   - 채널 설정 환경변수 문서화
   - Agent export 사용법

10. [ ] package.json exports 최종 확인
    - File: `package.json`
    - `"./agent"` export 확인
    - 모든 export 경로 정확성 검증
</task>

## Constraints
<constraints>
- 기존 `sendTelegram` 인터페이스 유지 (하위 호환)
- 채널 설정은 환경변수 기반 (config.json 보조)
- 채널 시작 실패 시 다른 채널에 영향 없음 (독립 lifecycle)
- 모든 테스트는 외부 서비스 없이 mock으로 실행 가능
- graceful shutdown 보장: 모든 채널 stop() 완료 후 프로세스 종료
- 테스트 커버리지: 각 Phase의 핵심 경로 80% 이상
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/router/MultiChannelRouter.ts`
- `src/interface/__tests__/multi-channel.test.ts`
- `src/interface/web/__tests__/WebServer.test.ts`
- `src/interface/vision/__tests__/vision.test.ts`
- `src/interface/slack/__tests__/SlackBot.test.ts`
- `src/interface/imessage/__tests__/IMessageBot.test.ts`

### Files to Modify
- `src/router/types.ts` — RouteServices 확장
- `src/interface/types.ts` — VibeChannelsConfig 추가
- `src/daemon/` — 채널 초기화 로직
- `CLAUDE.md` — 새 tool/채널 문서화
- `package.json` — export 최종 확인

### Verification Commands
- `npx tsc --noEmit`
- `npx vitest run`
- `npx vitest run --coverage`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] RouteServices.sendToChannel() — 모든 활성 채널로 메시지 전달
- [ ] 멀티채널 브로드캐스트 동작 (부분 실패 허용)
- [ ] Daemon 시작 시 설정된 채널만 활성화
- [ ] 채널 시작 실패 시 다른 채널 정상 동작
- [ ] graceful shutdown — 모든 채널 stop() 완료
- [ ] 통합 테스트 통과 (멀티채널 라우팅)
- [ ] API Server 테스트 통과 (WS + SSE)
- [ ] Vision 테스트 통과
- [ ] Slack 테스트 통과
- [ ] iMessage 테스트 통과
- [ ] CLAUDE.md에 새 도구/채널 문서화 완료
- [ ] `npx tsc --noEmit` 통과
- [ ] `npx vitest run` 전체 통과
- [ ] package.json exports 검증 완료
</acceptance>
