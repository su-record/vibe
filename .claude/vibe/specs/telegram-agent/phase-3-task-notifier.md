---
status: pending
phase: 3
createdAt: 2026-02-06T17:31:00+09:00
---

# SPEC: Phase 3 - 비동기 작업 + 완료 알림 + 세션 컨텍스트

## Persona

<role>
Senior TypeScript engineer specializing in:
- 비동기 작업 큐 관리
- 이벤트 기반 알림 시스템
- 세션 컨텍스트 관리 (SessionRAG)
- SQLite 기반 상태 추적
</role>

## Context

<context>

### Background
개발 작업은 수 분이 소요될 수 있으므로 비동기로 처리한 후 완료 시 텔레그램으로 알림을 보내야 한다.
또한 대화 컨텍스트를 SessionRAG에 저장하여 이전 대화를 기억하고 참조할 수 있어야 한다.

### Why
- 개발 작업 중에도 사용자가 다른 메시지를 보낼 수 있어야 함
- 작업 완료/실패 시 즉시 텔레그램으로 알림
- 대화 맥락 유지로 연속적인 작업 가능
- 작업 이력 조회 (/tasks 명령)

### Related Code
- `src/orchestrator/BackgroundManager.ts`: `launch()`, `poll()`, `cancel()`, `getStats()`
- `src/orchestrator/AgentRegistry.ts`: `recordStart()`, `recordComplete()`, `recordFailure()`
- `src/lib/memory/SessionRAGStore.ts`: Decision, Constraint, Goal, Evidence 엔티티
- `src/lib/MemoryManager.ts`: `retrieveSessionContext()`, `addEvidence()`
- `src/interface/telegram/TelegramBot.ts`: `sendResponse()`

</context>

## Task

<task>

### 1. 비동기 작업 알림 (`src/bridge/task-notifier.ts`)

1. [ ] `TaskNotifier` 클래스 구현
   ```typescript
   class TaskNotifier {
     constructor(
       private bot: TelegramBot,
       private registry: AgentRegistry
     )
   }
   ```

2. [ ] `launchAndNotify(chatId: string, request: DevTaskRequest): Promise<string>` 구현
   - `DevTaskRequest`: `{ task: string, workspace: string, maxTurns?: number }`
   - 즉시 "작업 시작" 메시지 전송
   - BackgroundManager.launch() 호출
   - 폴링 루프 시작 (5초 간격)
   - 완료 시 결과 알림 전송
   - 실패 시 에러 알림 전송
   - AgentRegistry에 실행 기록
   - taskId 반환

3. [ ] `getActiveTasks(chatId: string): TaskInfo[]` 구현
   - 해당 chatId의 진행 중인 작업 목록 반환
   - taskId, 작업 설명, 시작 시간, 경과 시간 포함

4. [ ] `cancelTask(chatId: string, taskId: string): boolean` 구현
   - BackgroundManager.cancel() 호출
   - 취소 알림 전송
   - 해당 chatId의 작업만 취소 가능 (권한 검증)

5. [ ] 폴링 루프 구현
   - 5초 간격으로 BackgroundManager.poll() 호출
   - 상태 변화 감지 시 텔레그램 알림
   - running → 진행 중 (최초 1회만 알림)
   - completed → 결과 전송 (텍스트 4096자 초과 시 분할)
   - failed → 에러 알림
   - cancelled → 취소 알림
   - 폴링 최대 시간: 600초 (10분)

6. [ ] 결과 포매팅
   - 성공: "작업 완료!\n\n{결과 요약}\n\n사용된 도구: {toolsUsed}\n소요 시간: {duration}"
   - 실패: "작업 실패\n\n{에러 메시지}"
   - 긴 결과: 4000자까지 표시 + "... (결과가 길어 일부만 표시)"

### 2. 세션 컨텍스트 관리

7. [ ] `SessionContextManager` 클래스 구현
   ```typescript
   class SessionContextManager {
     constructor(private memoryManager: MemoryManager)
   }
   ```

8. [ ] `getContext(chatId: string, query: string): Promise<string>` 구현
   - `sessionId`: `telegram-${chatId}`
   - MemoryManager.retrieveSessionContext() 호출
   - 최근 5개 관련 컨텍스트 반환
   - 프롬프트에 포함할 수 있는 형태로 포매팅

9. [ ] `saveContext(chatId: string, item: ContextItem): Promise<void>` 구현
   - ContextItem 유형:
     - 사용자 결정 → Decision으로 저장
     - 작업 결과 → Evidence로 저장
     - 중요 메모 → Goal 또는 Decision으로 저장
   - sessionId 자동 설정

10. [ ] `saveTaskResult(chatId: string, taskSummary: string, result: ClaudeAgentResult): Promise<void>` 구현
    - 작업 결과를 Evidence로 저장
    - type: 'build' (개발), 'review' (분석), 'info' (조회/검색/메모)
    - status: result.success ? 'pass' : 'fail'
    - metrics에 duration, toolsUsed 포함

### 3. 작업 상태 저장소

11. [ ] `activeTasksMap: Map<string, ActiveTask[]>` 관리
    - key: chatId
    - value: 진행 중인 작업 목록
    - 작업 시작 시 추가, 완료/실패/취소 시 제거
    - 최대 3개/chatId (동시 작업 제한)

12. [ ] 봇 재시작 시 복구
    - AgentRegistry.getIncompleteExecutions()로 미완료 작업 조회
    - telegram- 세션의 작업만 필터
    - 폴링 재개 또는 orphaned 처리

</task>

## Constraints

<constraints>
- 폴링 간격: 5초 (너무 짧으면 리소스 낭비, 너무 길면 응답 지연)
- 동시 작업 제한: per-chatId 최대 3개
- 결과 알림: 4096자 텔레그램 제한 준수 (분할 전송)
- sessionId 형식: `telegram-{chatId}` (일관성)
- 작업 취소는 요청한 chatId만 가능 (다른 사용자 작업 취소 불가)
- 폴링 최대 시간 초과 시 타임아웃 알림 전송
- MemoryManager는 싱글톤 getInstance() 사용
- AgentRegistry DB 접근 시 에러 핸들링 (graceful degradation)
</constraints>

## Output Format

<output_format>

### Files to Create
- `src/bridge/task-notifier.ts` - 비동기 작업 알림 + 세션 컨텍스트 관리

### Files to Modify
- (없음 - Phase 4에서 telegram-bridge.ts에 연동)

### Verification Commands
- `npm run build`
- `npx vitest run src/bridge/task-notifier.test.ts`

</output_format>

## Acceptance Criteria

<acceptance>
- [ ] launchAndNotify() 호출 시 즉시 "작업 시작" 메시지가 텔레그램으로 전송됨
- [ ] 작업 완료 시 결과 알림이 텔레그램으로 전송됨
- [ ] 작업 실패 시 에러 알림이 텔레그램으로 전송됨
- [ ] getActiveTasks()로 진행 중인 작업 목록 조회 가능
- [ ] cancelTask()로 진행 중인 작업 취소 가능
- [ ] 다른 chatId의 작업은 취소 불가
- [ ] 동시 작업 3개 초과 시 거부 메시지 반환
- [ ] 결과 4096자 초과 시 분할 전송됨
- [ ] getContext()로 이전 대화 컨텍스트 검색 가능
- [ ] saveTaskResult()로 작업 결과가 Evidence로 저장됨
- [ ] 봇 재시작 시 미완료 작업이 감지됨
- [ ] `npm run build` 성공
</acceptance>
