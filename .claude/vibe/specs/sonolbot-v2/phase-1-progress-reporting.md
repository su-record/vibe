---
status: pending
phase: 1
parent: _index.md
---

# SPEC: Phase 1 — Real-time Progress Reporting

## Persona
<role>
에이전트 파이프라인 전문가. AgentLoop의 기존 progress 이벤트를 Telegram 실시간 메시지 편집으로 연결한다.
소놀봇의 진행률 보고(10% → 40% → 70% → 완료) UX를 구현한다.
</role>

## Context
<context>
### Background
AgentLoop에 `AgentProgressEvent` 시스템이 구현되어 있다 (`emitProgress()` → `onProgress` 콜백).
WebServer(SSE/WS)에만 연결되어 있고, Telegram으로는 전달되지 않는다.
`telegram-assistant-bridge.ts`에서 `agentLoop.setOnProgress()`를 호출하지 않음.
TelegramBot에 `editMessageText` API 메서드가 없어서 메시지 편집(갱신)이 불가능.

### 소놀봇 참조
- `telegram_sender.py:send_message_sync()` — 매 전송 시 진행 상태 갱신
- 실제 UX: "10% - 이미지 분석 중" → "40% - 분석 완료!" → "70% - 정보 확인 완료" → 최종 응답

### Related Code
- `src/agent/AgentLoop.ts:593-599` — `emitProgress()`
- `src/agent/AgentLoop.ts:128-130` — `setOnProgress()` setter
- `src/agent/types.ts:159-182` — `AgentProgressEvent` (job:created/progress/chunk/complete/error)
- `src/interface/telegram/TelegramBot.ts:79-100` — `sendResponse()` (sendMessage만 사용)
- `src/bridge/telegram-assistant-bridge.ts:163-169` — AgentLoop 초기화 (onProgress 미연결)
- `src/agent/preprocessors/MediaPreprocessor.ts:130-132` — `showConfirmation` (음성만)
</context>

## Task
<task>
### Phase 1-1: TelegramBot.editMessage() 추가
1. [ ] `editMessage(chatId: string, messageId: number, text: string, parseMode?: string): Promise<void>`
   - Telegram API `POST /bot{token}/editMessageText` 호출
   - 실패 시 로깅만 (에러 throw 금지)
   - File: `src/interface/telegram/TelegramBot.ts`
2. [ ] `sendResponse()` 반환값 변경: `Promise<void>` → `Promise<number | undefined>`
   - Telegram API 응답의 `result.message_id` 반환
   - File: `src/interface/telegram/TelegramBot.ts`

### Phase 1-2: ProgressReporter 서비스 구현
1. [ ] `src/router/services/ProgressReporter.ts` 신규 생성
   - constructor: `(chatId: string, telegramBot: TelegramBot)` — chatId별 1인스턴스, bridge의 handleMessage에서 생성
   - `handleProgressEvent(event: AgentProgressEvent): void`
   - 내부 상태: `{ messageId: number; lastUpdate: number; stepCount: number }`
   - 이벤트 매핑:
     - `job:created` → 새 메시지 전송 "🔄 작업을 시작합니다"
     - `job:progress (tool_start)` → stepCount 증가 + 메시지 편집 "🔄 {stepCount}단계: {toolName} 실행 중..."
     - `job:progress (tool_end)` → 메시지 편집 "🔄 {stepCount}단계 완료"
     - `job:complete` → 메시지 편집 "✅ 완료!"
     - `job:error` → 메시지 편집 "❌ 오류 발생"
   - `minIntervalMs: 3000` — 편집 최소 간격 (Telegram rate limit 방지)
   - `job:chunk` 이벤트 무시
   - **[C3] `dispose(): void`** — 내부 상태 초기화, `job:complete`/`job:error` 시 자동 호출
   - File: `src/router/services/ProgressReporter.ts`

### Phase 1-3: Bridge에 연결
1. [ ] Bridge에 `activeReporters: Map<string, ProgressReporter>` 관리
2. [ ] handleMessage에서 ProgressReporter 생성 → Map에 저장
3. [ ] **[C6] `setOnProgress()` → 리스너 배열로 변경**: `addProgressListener(fn)` / `removeProgressListener(fn)`
   - Bridge가 fan-out: ProgressReporter + ModelARouter.heartbeat 양쪽에 전달
   - 또는: Bridge에서 단일 콜백으로 받아 내부에서 분배
4. [ ] job:complete/error 시 activeReporters에서 해당 chatId 제거 (메모리 누수 방지)
   - File: `src/bridge/telegram-assistant-bridge.ts`, `src/agent/AgentLoop.ts`

### Phase 1-4: MediaPreprocessor 사진 확인 메시지
1. [ ] `processPhotoFile()` 시작 시 "🔄 이미지 분석 중..." 전송
2. [ ] 분석 완료 후 "✅ 이미지 분석 완료!" 전송
   - 기존 `showConfirmation` config 재활용 (현재 음성만 → 사진도 추가)
   - File: `src/agent/preprocessors/MediaPreprocessor.ts`
</task>

## Constraints
<constraints>
- TelegramBot 기존 `sendResponse()` 시그니처 하위 호환 유지 (반환값만 추가)
- editMessage 실패 시 메인 플로우 중단 금지
- Telegram API rate limit: 동일 채팅 초당 1회 편집 권장 → minIntervalMs 3초
- ProgressReporter는 AgentLoop에 직접 의존하지 않음 (콜백 기반)
- job:chunk 이벤트 무시 (스트리밍 텍스트는 Telegram에 부적합)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/router/services/ProgressReporter.ts`

### Files to Modify
- `src/interface/telegram/TelegramBot.ts`
- `src/bridge/telegram-assistant-bridge.ts`
- `src/agent/preprocessors/MediaPreprocessor.ts`

### Verification Commands
- `npx tsc --noEmit`
- `pnpm test -- --grep "TelegramBot|ProgressReporter"`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] TelegramBot.editMessage()가 Telegram API editMessageText 호출
- [ ] sendResponse()가 message_id 반환
- [ ] job:created → "🔄 작업을 시작합니다" 새 메시지 전송
- [ ] job:progress → 기존 메시지 편집 (3초 간격 제한)
- [ ] job:complete → "✅ 완료!" 메시지 편집
- [ ] 사진 전송 시 "🔄 이미지 분석 중..." 확인 메시지 전송
- [ ] editMessage 실패 시 메인 처리 계속 진행
- [ ] 동시 다중 chatId에서 ProgressReporter 인스턴스 격리 동작
- [ ] sendResponse 실패 시 (messageId undefined) 후속 edit 시도 안함
- [ ] ProgressReporter.dispose() 호출 시 내부 상태 초기화
- [ ] job:complete/error 후 activeReporters Map에서 제거 (메모리 누수 없음)
- [ ] TypeScript 컴파일 성공
</acceptance>
