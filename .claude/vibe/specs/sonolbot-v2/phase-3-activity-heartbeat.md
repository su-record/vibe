---
status: pending
phase: 3
parent: _index.md
depends: [phase-1-progress-reporting.md]
---

# SPEC: Phase 3 — Activity Heartbeat + Lock Safety

## Persona
<role>
인프라 안정성 전문가. 장시간 작업 시 비정상 종료 감지 + 동시 실행 방지를 구현한다.
소놀봇의 `working.json` + `update_working_activity()` + 3단계 안전 패턴을 적용한다.
</role>

## Context
<context>
### Background
Phase 2에서 추가한 `processingChats`가 비정상 종료 시 영원히 남아서 해당 chatId 처리 불가.
DevSessionManager는 세션 재사용 로직이 있지만 mutex 없어 동시 sendMessage 위험.

### 소놀봇 참조
- `telegram_bot.py:79-129` — `check_working_lock()`: `last_activity` 기준 30분 stale 감지
- `telegram_bot.py:171-192` — `update_working_activity()`: 매 전송 시 갱신
- `telegram_bot.py:132-168` — `create_working_lock()`: 원자적 락

### Related Code
- `src/router/ModelARouter.ts` — Phase 2의 processingChats
- `src/router/sessions/DevSessionManager.ts` — 세션 관리 (mutex 없음)
- `src/interface/ClaudeCodeBridge.ts` — `running` boolean (lock 없음)
</context>

## Task
<task>
### Phase 3-1: ModelARouter Activity Heartbeat
1. [ ] `processingChats` Phase 2에서 이미 `Map<string, { startedAt: number; lastActivity: number }>`으로 구현됨 — 추가 변경 불필요
2. [ ] onProgress 이벤트 수신 시 `lastActivity = Date.now()` 갱신
3. [ ] Stale 감지 타이머: `setInterval(60_000)` 1분 주기
   - `Date.now() - lastActivity > 600_000` (10분) → 정리 + 사용자 알림: "⚠️ 작업이 응답 없이 10분 경과하여 자동 종료되었습니다"
   - **[C5] pending 자동 재처리 시 retryCount 확인**: pending 메시지에 `_retryCount?: number` 필드 추가
     - `retryCount < 1` → 자동 재처리 (`_retryCount++`)
     - `retryCount >= 1` → 재처리 거부 + 사용자 알림: "⚠️ 반복 실패로 요청을 건너뛰었습니다. 다시 보내주세요."
4. [ ] **[C7] `dispose(): void`** — stale 타이머 clearInterval + processingChats/pendingMessages 정리
5. [ ] bridge 종료 시 `dispose()` 호출
   - File: `src/router/ModelARouter.ts`

### Phase 3-2: DevSessionManager async mutex
1. [ ] `withLock(key: string, fn: () => Promise<T>): Promise<T>` 구현
   - Promise 체이닝 기반 (외부 라이브러리 불필요)
   - 대기 최대 30초 timeout
2. [ ] `getSession()` 내부에서 withLock 사용
   - File: `src/router/sessions/DevSessionManager.ts`

### Phase 3-3: ClaudeCodeBridge running 보호
1. [ ] 중복 start() 방지 (기존 Promise 반환)
2. [ ] 비정상 종료 시 running = false 보장
   - File: `src/interface/ClaudeCodeBridge.ts`
</task>

## Constraints
<constraints>
- ACTIVITY_TIMEOUT 기본값: 600_000ms (10분)
- lock 대기 최대 30초, 초과 시 대기자에게 timeout 에러 반환 (기존 소유자의 lock은 유지)
- stale 정리 시 에러 로깅만 (프로세스 종료 금지)
- DevSessionManager 기존 max concurrent 3 / idle timeout 2h 유지
- withLock은 비재진입(non-reentrant) — 동일 key로 중첩 호출 금지 (deadlock 위험)
- 다중 stale 동시 정리 시 auto-reprocess는 순차 실행 (Promise.allSettled 아님)
</constraints>

## Output Format
<output_format>
### Files to Modify
- `src/router/ModelARouter.ts`
- `src/router/sessions/DevSessionManager.ts`
- `src/interface/ClaudeCodeBridge.ts`

### Verification Commands
- `npx tsc --noEmit`
- `pnpm test -- --grep "ModelARouter|DevSessionManager|ClaudeCodeBridge"`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] processingChats에 startedAt, lastActivity 포함
- [ ] progress 이벤트 시 lastActivity 갱신
- [ ] 10분 무활동 → stale 정리 + 사용자 알림
- [ ] stale 후 pending 메시지 자동 재처리 (retryCount < 1일 때만)
- [ ] retryCount >= 1인 pending은 재처리 거부 + 사용자 알림
- [ ] DevSessionManager.withLock()으로 동시 호출 직렬화
- [ ] withLock timeout 시 대기자에게 에러 반환 (기존 소유자 lock 유지)
- [ ] ClaudeCodeBridge 중복 start() 방지
- [ ] 비정상 종료 시 running = false 보장
- [ ] ModelARouter.dispose() 호출 시 타이머 정리 + 상태 초기화
- [ ] TypeScript 컴파일 성공
</acceptance>
