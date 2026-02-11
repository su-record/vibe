---
status: pending
phase: 3
parent: _index.md
depends: [phase-2-file-attachment.md]
---

# SPEC: Phase 3 — Multi-Message Batching

## Persona
<role>
인터페이스 레이어 전문가. 사용자가 여러 메시지를 연속 전송 시 하나로 합쳐서 처리하는 배치 패턴을 구현한다.
소놀봇의 `combine_tasks()` 패턴을 BaseInterface에 통합한다.
</role>

## Context
<context>
### Background
현재 BaseInterface는 메시지를 받으면 즉시 handler에 전달한다. 사용자가 "이거 해줘" + "아 그리고 이것도" + (사진 첨부)를 연속 전송하면 3개의 별도 작업으로 처리된다. 소놀봇은 `combine_tasks()`로 대기 메시지를 시간순 정렬 후 하나로 합산한다.

### 소놀봇 참조 코드
- `telegram_bot.py:726-839` — `combine_tasks()`: 시간순 정렬, `[요청 N]` 형식, 📎 첨부파일/📍 위치 포함, stale_resume 헤더, 24h 컨텍스트 주입
- 합산 결과: `combined_instruction`, `message_ids[]`, `files[]`, `stale_resume`

### 현재 Vibe 코드
- `src/interface/BaseInterface.ts:40` — `dispatchMessage()`: 즉시 handler 호출 (큐/버퍼 없음)
- `src/interface/types.ts` — ExternalMessage (Phase 2에서 files, location 추가됨)
</context>

## Task
<task>
### Phase 3-1: ExternalMessage 배치 필드 추가
1. [ ] `ExternalMessage`에 optional 필드 추가
   - `batchedFrom?: string[]` (합산된 원본 메시지 ID 목록)
   - `allTimestamps?: string[]` (각 메시지의 타임스탬프)
   - File: `src/interface/types.ts`

### Phase 3-2: BaseInterface에 배치 버퍼 구현
1. [ ] private 필드 추가: `messageBuffers: Map<string, ExternalMessage[]>`, `batchTimers: Map<string, NodeJS.Timeout>` (per-chat 격리, key = `{channel}:{chatId}`)
2. [ ] `BATCH_WAIT_MS = 2000` (2초 debounce)
3. [ ] `dispatchMessage()` 변경: 즉시 handler 호출 → 버퍼에 push + debounce timer 리셋
4. [ ] `flushBatch()` 메서드: 버퍼 비우고 `combineMessages()` 후 handler 호출
5. [ ] `combineMessages()` → **공유 유틸리티 `MessageCombiner` 모듈로 추출** (`src/interface/utils/MessageCombiner.ts`)
   - Phase 4 AgentLoop에서도 재사용 가능하도록 순수 함수로 구현
   - 1개면 그대로 반환
   - 2개 이상이면 시간순 정렬
   - `[요청 N] (timestamp)` + content 형식으로 합산
   - files[], location 메타데이터 병합
   - batchedFrom, allTimestamps 설정
6. [ ] `flushBatch()` 시 atomic swap: 현재 버퍼를 로컬 변수로 이동 후 Map에서 삭제 → 새 메시지는 즉시 새 배치 시작
7. [ ] `stop()` 시 모든 타이머 clear + 모든 버퍼 즉시 flush
   - File: `src/interface/BaseInterface.ts`, `src/interface/utils/MessageCombiner.ts`

### Phase 3-3: Stale Resume 지원
1. [ ] stale 태스크 재시작 시 특별 헤더 추가
   - `"⚠️ [중단된 작업 재시작]"` + 이전 결과 확인 안내
2. [ ] Phase 1의 stale 감지와 연동: stale=true인 태스크가 재시작될 때 stale_resume 플래그
   - File: `src/interface/BaseInterface.ts`
</task>

## Constraints
<constraints>
- `dispatchMessage()`의 기존 시그니처 유지 (protected async)
- 단일 메시지 전송 시 2초 지연 발생 (trade-off: 배치 vs 즉시성)
- stop() 시 타이머 clear + 남은 버퍼 즉시 flush
- 메시지 합산 시 첫 번째 메시지의 channel, chatId, userId 사용
- 빈 content 메시지도 파일/위치가 있으면 합산에 포함
- flushBatch() handler 호출 실패 시 버퍼는 비우고 에러 로깅 (메시지 유실 방지보다 시스템 안정성 우선)
- 배치 버퍼 최대 크기: 20개 메시지 (초과 시 즉시 flush)
</constraints>

## Output Format
<output_format>
### Files to Modify
- `src/interface/types.ts` — batchedFrom, allTimestamps 필드 추가
- `src/interface/BaseInterface.ts` — 배치 버퍼, combineMessages, flushBatch

### Verification Commands
- `npx tsc --noEmit`
- `pnpm test -- --grep "BaseInterface|batch"`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 2초 이내 연속 메시지가 하나로 합산됨
- [ ] 합산 메시지에 `[요청 1]`, `[요청 2]` 형식 포함
- [ ] 합산 메시지에 batchedFrom, allTimestamps 필드 설정
- [ ] 파일/위치 메타데이터가 올바르게 병합됨
- [ ] 단일 메시지는 2초 후 정상 전달
- [ ] stop() 시 남은 버퍼가 즉시 flush됨
- [ ] TypeScript 컴파일 성공
</acceptance>
