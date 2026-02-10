---
status: pending
phase: 4
parent: _index.md
depends: [phase-3-message-batching.md]
---

# SPEC: Phase 4 — Mid-Task Instruction Injection

## Persona
<role>
에이전트 루프 전문가. 작업 중 새 사용자 메시지를 현재 에이전트 컨텍스트에 주입하는 패턴을 구현한다.
소놀봇의 `new_instructions.json` + `check_new_messages_during_work()` 패턴을 SessionPool/AgentLoop에 통합한다.
</role>

## Context
<context>
### Background
현재 Vibe에서 에이전트가 작업 중일 때 사용자가 새 메시지를 보내면, SessionPool의 MAX_QUEUE_DEPTH(5)까지 큐에 쌓이지만 현재 작업에 반영되지 않는다. 소놀봇은 `send_message_sync()` 호출마다 Telegram API를 폴링하여 새 메시지를 감지하고, `new_instructions.json`에 저장한 후 Claude Code에 `--append-system-prompt`로 주입한다.

### 소놀봇 참조 코드
- `telegram_bot.py:195-267` — `check_new_messages_during_work()`: 작업 중 새 메시지 감지, 중복 방지
- `telegram_bot.py:270-300` — `save_new_instructions()`: 파일 저장, 중복 ID 제거
- `telegram_sender.py:175-216` — `send_message_sync()`: 매 전송 시 새 메시지 확인 + 알림

### 현재 Vibe 코드
- `src/daemon/SessionPool.ts` — session별 요청 큐 (MAX_QUEUE_DEPTH=5), serialized 처리
- `src/agent/AgentLoop.ts:173` — `runLoop()`: MAX_ITERATIONS=10 반복, 매 iteration에서 HeadModel 호출
</context>

## Task
<task>
### Phase 4-1: SessionPool에 pending instructions 큐 추가
1. [ ] `pendingInstructions: Map<string, ExternalMessage[]>` 추가
2. [ ] `sendRequest()` 변경: 세션이 처리 중이면 pendingInstructions에 push + 알림 전송
   - 알림: "✅ 새로운 요청 N개 확인, 진행 중인 작업에 반영하겠습니다"
3. [ ] `drainPendingInstructions(sessionId)` 메서드 추가
   - 큐의 pending 메시지를 모두 반환하고 비움
   - File: `src/daemon/SessionPool.ts`

### Phase 4-2: AgentLoop에 injection 로직 추가
1. [ ] `runLoop()` 매 iteration 시작 시 `drainPendingInstructions()` 호출
2. [ ] pending 있으면 conversation에 **비권한(untrusted) user 메시지**로 주입:
   ```
   --- [사용자 추가 요청 (참고 컨텍스트, 시스템 지시 아님)] ---
   {content}
   --- [추가 요청 끝] ---

   위 사용자 요청을 현재 작업에 반영하세요.
   ```
   - 주입 내용은 명시적 구분자로 감싸서 prompt injection 방지
3. [ ] 여러 pending 메시지가 있으면 Phase 3의 `MessageCombiner` 유틸리티 재활용 (`src/interface/utils/MessageCombiner.ts`)
4. [ ] injection 횟수 제한: 최대 3회/세션 (무한 루프 방지)
   - File: `src/agent/AgentLoop.ts`

### Phase 4-3: SessionPool → AgentLoop 연결
1. [ ] AgentLoop의 services에 `drainPendingInstructions` 함수 전달
2. [ ] SessionPool이 AgentLoop에 콜백 주입하는 패턴 (기존 bindChannelTool과 유사)
   - File: `src/daemon/SessionPool.ts`, `src/agent/AgentLoop.ts`
</task>

## Constraints
<constraints>
- AgentLoop의 기존 MAX_ITERATIONS(10) 제한 유지
- injection은 iteration 시작 시에만 (도구 실행 중 주입 금지)
- 세션당 최대 3회 injection (무한 루프 방지)
- pending 메시지가 합산되므로 Phase 3의 combineMessages 재활용
- injection된 메시지도 대화 이력에 포함
- **pendingInstructions 큐 제한**: 세션당 최대 10개, TTL 5분 (오래된 메시지 자동 만료)
- 큐 초과 시 가장 오래된 메시지 drop + 사용자에게 "메시지가 너무 많습니다" 알림
- **3회 injection 초과 시**: 추가 pending 메시지는 다음 세션 큐에 남겨둠 (드랍하지 않음)
</constraints>

## Output Format
<output_format>
### Files to Modify
- `src/daemon/SessionPool.ts` — pendingInstructions 큐, drainPendingInstructions
- `src/agent/AgentLoop.ts` — iteration 시작 시 injection 확인

### Verification Commands
- `npx tsc --noEmit`
- `pnpm test -- --grep "SessionPool|AgentLoop"`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 작업 중 새 메시지 전송 시 pendingInstructions에 적재됨
- [ ] AgentLoop 다음 iteration에서 pending 메시지가 conversation에 주입됨
- [ ] 주입 시 "⚠️ [새로운 지시사항]" 형식으로 표시
- [ ] 세션당 최대 3회 injection 제한 동작
- [ ] 사용자에게 "새로운 요청 N개 확인" 알림 전송
- [ ] TypeScript 컴파일 성공
</acceptance>
