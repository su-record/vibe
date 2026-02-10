---
status: pending
phase: 1
parent: _index.md
---

# SPEC: Phase 1 — Activity-Based Timeout + Dual-Layer Lock

## Persona
<role>
BackgroundManager 인프라 전문가. 기존 retry 로직을 유지하면서 activity-based timeout을 추가한다.
소놀봇의 `working.json` + `last_activity` 패턴을 TypeScript 이벤트 기반으로 재설계한다.
</role>

## Context
<context>
### Background
현재 BackgroundManager는 고정 `TASK_TIMEOUT`(5분)으로 태스크를 관리한다. 실제로 작업 중인 에이전트도 5분이 지나면 강제 cancel된다. 소놀봇은 `last_activity` 타임스탬프를 매 활동마다 갱신하여, 진짜 멈춘 태스크만 감지한다.

### 소놀봇 참조 코드
- `telegram_bot.py:79-129` — `check_working_lock()`: `last_activity` 기준 30분 stale 감지
- `telegram_bot.py:171-192` — `update_working_activity()`: 매 `send_message_sync()` 시 타임스탬프 갱신
- `telegram_bot.py:132-168` — `create_working_lock()`: 원자적 락 생성 (`open("x")`)

### 현재 Vibe 코드
- `src/infra/orchestrator/BackgroundManager.ts` — TaskInfo, executeTask(), processQueue()
- `src/infra/orchestrator/constants.ts` — CONCURRENCY 객체 (TASK_TIMEOUT, MAX_RETRIES 등)
- `src/agent/AgentExecutor.ts` — onProgress 콜백, safeResolve 패턴

### Tech Stack
- TypeScript, AbortController, Promise.race

### Related Code
- `src/infra/orchestrator/BackgroundManager.ts:503-571` — executeTask retry 루프
- `src/infra/orchestrator/BackgroundManager.ts:450-500` — processQueue PIPELINE_TIMEOUT
- `src/infra/orchestrator/constants.ts:1-72` — 상수 정의
</context>

## Task
<task>
### Phase 1-1: constants.ts 확장
1. [ ] `CONCURRENCY` 객체에 `ACTIVITY_TIMEOUT: 180_000` 추가 (3분 무활동)
   - File: `src/infra/orchestrator/constants.ts`
   - Verify: `tsc --noEmit`

### Phase 1-2: TaskInfo에 activity 필드 추가
1. [ ] `TaskInfo` 인터페이스에 `lastActivity: number` 필드 추가
   - 초기값: `Date.now()` (태스크 생성 시)
2. [ ] `TaskInfo`에 `stale: boolean` 필드 추가
   - 초기값: `false`
   - File: `src/infra/orchestrator/BackgroundManager.ts`

### Phase 1-3: Activity 갱신 로직
1. [ ] `executeTask()` 내 AgentExecutor의 `onProgress` 콜백에서 `task.lastActivity = Date.now()` 호출
2. [ ] AgentAnnouncer 이벤트 발생 시마다 `lastActivity` 갱신
3. [ ] **Activity 화이트리스트** (의미 있는 활동만 갱신):
   - 갱신 O: tool_start, tool_end, model_token_output, user_visible_progress, announcer 이벤트
   - 갱신 X: background_ping, heartbeat, internal_log
   - File: `src/infra/orchestrator/BackgroundManager.ts`

### Phase 1-4: Stale 감지 + 자동 복구
1. [ ] `processQueue()` 루프에서 running 태스크 순회하며 stale 감지
   - 조건: `Date.now() - task.lastActivity > ACTIVITY_TIMEOUT`
   - 동작: `task.stale = true` → `task.handle.cancel()` → retry 큐에 재등록
2. [ ] 기존 `TASK_TIMEOUT`은 hard deadline으로 유지 (stale 감지와 별개)
3. [ ] stale 감지 주기: processQueue 루프 매 iteration (기존 루프에 통합)
   - File: `src/infra/orchestrator/BackgroundManager.ts`

### Phase 1-5: poll() 응답에 activity 정보 추가
1. [ ] `poll()` 반환값에 `lastActivity`, `stale` 필드 포함
   - File: `src/infra/orchestrator/BackgroundManager.ts`
</task>

## Constraints
<constraints>
- 기존 retry 로직 (MAX_RETRIES=3, 지수 백오프) 유지
- ConcurrencyManager 슬롯 관리 변경 없음 (Layer 1)
- Activity timeout은 Layer 2로 추가
- stale cancel 시에도 retry count 소진
- `TASK_TIMEOUT`(hard deadline)은 activity에 상관없이 적용
- **태스크 상태 전이 규칙**: `running` → `stale_canceling` → `retrying` → `running` (CAS 패턴)
  - stale 감지 시 상태를 `stale_canceling`으로 변경 후 cancel (이미 `stale_canceling`이면 skip)
  - cancel 완료 시 `retrying`으로 전환 → 새 실행 시 `running`으로 복귀
  - 태스크가 cancel 도중 자체 완료하면 완료 우선 (retry 불필요)
</constraints>

## Output Format
<output_format>
### Files to Modify
- `src/infra/orchestrator/constants.ts` — ACTIVITY_TIMEOUT 추가
- `src/infra/orchestrator/BackgroundManager.ts` — TaskInfo 확장, activity 갱신, stale 감지

### Verification Commands
- `npx tsc --noEmit`
- `pnpm test -- --grep "BackgroundManager"`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] TaskInfo에 lastActivity, stale 필드 존재
- [ ] 매 progress 이벤트마다 lastActivity 갱신됨
- [ ] 3분 무활동 시 stale=true 마킹 후 cancel+retry 실행
- [ ] TASK_TIMEOUT(5분) hard deadline 유지
- [ ] poll() 응답에 lastActivity, stale 필드 포함
- [ ] 기존 retry 로직(MAX_RETRIES=3) 정상 동작
- [ ] TypeScript 컴파일 성공
</acceptance>
