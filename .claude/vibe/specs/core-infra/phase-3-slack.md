---
status: pending
currentPhase: 3
totalPhases: 5
createdAt: 2026-02-09T00:14:38Z
lastUpdated: 2026-02-09T00:14:38Z
---

# SPEC: core-infra — Phase 3: Slack Channel

## Persona
<role>
- Senior TypeScript developer, Slack API 전문가
- 기존 `BaseInterface` 및 `TelegramBot` 구현 패턴 숙지
- OAuth 2.0 + Bot Token 인증 체계 경험
- 이벤트 기반 메시징 시스템 설계 경험
</role>

## Context
<context>
### Background
- 현재 VIBE는 Telegram만 메신저 채널로 지원
- Slack은 개발팀 커뮤니케이션의 표준 → 업무 중 VIBE 에이전트에 바로 요청 가능
- TelegramBot과 동일한 패턴: polling/socket 기반 메시지 수신 → AgentLoop 처리 → 응답 전송

### Tech Stack
- Slack API: Socket Mode (WebSocket 기반, 서버 노출 불필요)
- 인증: Bot Token (`xoxb-`) + App-Level Token (`xapp-`)
- 외부 라이브러리: 미사용 — `node:https` + Socket Mode WebSocket 직접 구현

### Related Code
- `src/interface/telegram/TelegramBot.ts`: 동일 패턴 참조 (BaseInterface 확장)
- `src/interface/telegram/TelegramFormatter.ts`: 포매터 패턴
- `src/interface/types.ts`: `TelegramConfig` 패턴 참조
- `src/interface/BaseInterface.ts`: 추상 클래스

### Design Reference
- Slack Socket Mode API
- Slack Block Kit 메시지 포맷
</context>

## Task
<task>
### Phase 3-1: Slack Bot 기본 구조
1. [ ] SlackBot 클래스 (BaseInterface 확장)
   - File: `src/interface/slack/SlackBot.ts` (신규)
   - `BaseInterface` 확장, channel: `'slack'`
   - Socket Mode WebSocket 연결 (apps.connections.open → wss:// URL)
   - 메시지 수신 → `ExternalMessage` 변환 → `dispatchMessage()`
   - 응답 전송: `chat.postMessage` API 호출
   - Reconnect: 연결 끊김 시 자동 재연결 (최대 5회, 지수 백오프)

2. [ ] Slack 설정 및 인증
   - File: `src/interface/types.ts` (수정)
   - `SlackConfig`: `{ botToken: string, appToken: string, allowedChannelIds: string[] }`
   - 환경변수: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_ALLOWED_CHANNELS`
   - 허용된 채널에서만 메시지 수신 (보안)

### Phase 3-2: 메시지 처리
3. [ ] Slack 이벤트 파싱
   - File: `src/interface/slack/SlackBot.ts`
   - Socket Mode envelope 파싱: `{ type: "events_api", payload: { event: ... } }`
   - 지원 이벤트: `message` (채널/DM), `app_mention` (@vibe)
   - Bot 자신의 메시지 무시 (무한루프 방지)
   - Thread 지원: thread_ts 기반 대화 추적

4. [ ] Slack 메시지 포매터
   - File: `src/interface/slack/SlackFormatter.ts` (신규)
   - Markdown → Slack mrkdwn 변환
   - 코드블록: ```code``` → Slack 코드블록
   - 긴 메시지 분할: 최대 4000자/메시지 (Slack 제한: 40000자이나, 가독성을 위해 4000자)
   - 링크 변환: `[text](url)` → `<url|text>`

### Phase 3-3: 양방향 통신
5. [ ] 파일 업로드/다운로드
   - File: `src/interface/slack/SlackBot.ts`
   - 사용자가 파일 첨부 → `files.info` API로 URL 취득 → 다운로드 → MediaPreprocessor
   - 응답에 파일 첨부: `files.uploadV2` API
   - 지원 파일 타입: 이미지(png, jpg), 텍스트(txt, md), 코드(ts, js, py)

6. [ ] send_slack agent tool 등록
   - File: `src/agent/tools/send-slack.ts` (신규)
   - send-telegram.ts 패턴과 동일한 구조
   - AsyncLocalStorage로 channelId 바인딩
   - Parameters: `{ message: string, channel?: string, thread_ts?: string }`
   - scope: `execute`
</task>

## Constraints
<constraints>
- 외부 Slack SDK 미사용 (`@slack/bolt`, `@slack/web-api` 사용 안함)
- `node:https` + WebSocket(node:http upgrade) 직접 구현
- Socket Mode 전용 (Webhook 모드 미지원 — 서버 노출 불필요)
- 허용된 채널에서만 메시지 수신
- Bot 자신의 메시지 무시
- 메시지 최대 길이: 4000자 (초과 시 분할)
- API rate limit 준수: Tier 3 (50+ req/min) — Token bucket (burst 5, refill rate 30/min)
- ChannelType에 `'slack'` 추가
- 파일 다운로드 최대 크기: 10MB
- Socket Mode reconnect: 최대 5회, 지수 백오프 (1s, 2s, 4s, 8s, 16s)
- **Socket Mode envelope ACK**: `envelope_id` 수신 후 3초 이내 ACK 응답 필수, `event_id` 기반 중복 이벤트 필터링 (dedup 윈도우: 60초)
- **Outbound allowlist**: `send_slack` tool도 `allowedChannelIds` 제한 적용, 미허용 채널 전송 시도 시 에러 반환
- **Slack file download**: `url_private` 다운로드 시 `Authorization: Bearer <botToken>` 헤더 필수
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/interface/slack/SlackBot.ts`
- `src/interface/slack/SlackFormatter.ts`
- `src/interface/slack/index.ts`
- `src/agent/tools/send-slack.ts`

### Files to Modify
- `src/interface/types.ts` — `SlackConfig`, ChannelType에 `'slack'` 추가
- `src/interface/index.ts` — slack export
- `src/agent/tools/index.ts` — send-slack 등록

### Verification Commands
- `npx tsc --noEmit`
- `npx vitest run src/interface/slack/`
- `npx vitest run src/agent/`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] SlackBot Socket Mode 연결 성공
- [ ] 허용된 채널의 메시지 수신 → ExternalMessage 변환
- [ ] @vibe mention 감지 및 처리
- [ ] Thread 기반 대화 추적
- [ ] Markdown → Slack mrkdwn 변환 정확
- [ ] 4000자 초과 메시지 분할 전송
- [ ] 파일 첨부 수신 및 다운로드
- [ ] `send_slack` tool — AgentLoop에서 Slack 메시지 전송
- [ ] AsyncLocalStorage 기반 channelId 격리
- [ ] 연결 끊김 시 자동 재연결
- [ ] Bot 자신의 메시지 무시 (무한루프 방지)
- [ ] 비허용 채널 메시지 거부
- [ ] TypeScript 컴파일 통과
- [ ] 기존 테스트 통과
</acceptance>
