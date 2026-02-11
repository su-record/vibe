---
status: pending
phase: 2
parent: _index.md
---

# SPEC: Phase 2 — Mid-Task Message Handling

## Persona
<role>
라우터/에이전트 루프 전문가. 작업 중 도착한 새 메시지를 현재 AgentLoop 실행에 주입한다.
소놀봇의 `check_new_messages_during_work()` + `new_instructions.json` 패턴을 ModelARouter + AgentLoop에 통합한다.
</role>

## Context
<context>
### Background
ModelARouter는 메시지를 즉시 `agentLoop.process()`로 전달한다. AgentLoop 실행 중 새 메시지가 오면 두 번째 `process()`가 동시 시작되어 충돌 위험.

### 소놀봇 참조
- `telegram_bot.py:195-267` — `check_new_messages_during_work()`: 작업 중 새 메시지 감지
- `telegram_bot.py:270-300` — `save_new_instructions()`: 파일 저장, 중복 ID 제거
- `telegram_sender.py:175-216` — `send_message_sync()`: 매 전송 시 새 메시지 확인

### Related Code
- `src/router/ModelARouter.ts:111-135` — `handleMessage()`: 즉시 agentLoop.process() 호출
- `src/agent/AgentLoop.ts:314-428` — runLoop: iteration → chat() → tool execution → 반복
</context>

## Task
<task>
### Phase 2-1: ModelARouter에 메시지 큐 추가
1. [ ] private 필드:
   - `processingChats: Map<string, { startedAt: number; lastActivity: number }>` — Phase 3 heartbeat 대비 Map 사용
   - `pendingMessages: Map<string, ExternalMessage[]>` — chatId별 대기 큐
2. [ ] `handleMessage()` 변경:
   - chatId in processingChats → pendingMessages에 push + "✅ 새 요청 확인" 알림 (debounce: 동일 chatId 5초 내 중복 알림 금지)
   - chatId not in processingChats → processingChats.set(chatId, { startedAt: Date.now(), lastActivity: Date.now() }) → process() → finally delete
3. [ ] `drainPendingMessages(chatId): ExternalMessage[]` 메서드
4. [ ] 큐 제한: chatId당 최대 10개, TTL 5분
   - 11번째 메시지 → 해당 chatId 큐 FIFO: 가장 오래된 메시지 제거 (per-chat limit만, 전역 eviction 없음)
   - drain 시 TTL(5분) 초과 메시지 → skip + 삭제
5. [ ] **[C1] pending 큐 진입 전 attachment 선처리**:
   - `ExternalMessage.files`가 있으면 `MediaPreprocessor.process()` 호출 후 canonical text로 변환
   - 선처리 실패 시 원본 텍스트만 큐잉 + 에러 로깅
   - File: `src/router/ModelARouter.ts`

### Phase 2-2: AgentLoop에 pending drain 로직
1. [ ] `process()`에 optional `drainPendingFn?: () => ExternalMessage[]`
2. [ ] `runLoop()` 매 iteration 시작 시 drain 호출
3. [ ] pending 있으면 conversation에 user 메시지로 주입:
   ```
   [ADDITIONAL_REQUEST:{requestId}]
   {content}
   [/ADDITIONAL_REQUEST]
   위 요청을 현재 작업에 반영하세요.
   ```
   - requestId는 `crypto.randomUUID()` (사용자 위조 방지)
4. [ ] injection 횟수 제한: 최대 3회/process
5. [ ] **[C2] injection content 길이 제한**: `MAX_INJECTION_CHARS: 4000`
   - 초과 시 뒷부분 truncate + "[...truncated]" 추가
   - File: `src/agent/AgentLoop.ts`

### Phase 2-3: 연결 + 후속 처리
1. [ ] handleMessage에서 process() 호출 시 drainPendingFn 전달
2. [ ] process 완료 후 남은 pending → 새 process 자동 시작
   - File: `src/router/ModelARouter.ts`
</task>

## Constraints
<constraints>
- AgentLoop.process() 기존 호출부 하위 호환 (drainPendingFn optional)
- MAX_ITERATIONS(10) 유지, injection이 iteration 소비하지 않음
- injection은 iteration 시작 시에만 (도구 실행 중 주입 금지)
- 3회 injection 초과 후 남은 pending은 새 process에서 처리
- pending 메시지의 파일 첨부는 큐 진입 전 MediaPreprocessor로 선처리 (drain 시점 아님)
- injection content 합산 최대 4000자 (LLM context overflow 방지)
</constraints>

## Output Format
<output_format>
### Files to Modify
- `src/router/ModelARouter.ts`
- `src/agent/AgentLoop.ts`

### Verification Commands
- `npx tsc --noEmit`
- `pnpm test -- --grep "ModelARouter|AgentLoop"`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AgentLoop 실행 중 새 메시지 → pendingMessages에 적재
- [ ] "✅ 새 요청 확인" 알림 전송
- [ ] 다음 iteration에서 pending 메시지가 conversation에 주입
- [ ] `[ADDITIONAL_REQUEST:{uuid}]` 구분자 포함
- [ ] process당 최대 3회 injection 제한
- [ ] chatId당 큐 최대 10개 제한
- [ ] process 완료 후 남은 pending → 새 process 자동 시작
- [ ] 기존 호출부 (drainPendingFn 없이) 정상 동작
- [ ] pending 메시지의 FileAttachment → 큐 진입 전 MediaPreprocessor 선처리
- [ ] injection content 4000자 초과 시 truncate 동작
- [ ] "새 요청 확인" 알림 debounce (5초 내 중복 방지)
- [ ] TypeScript 컴파일 성공
</acceptance>
