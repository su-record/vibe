---
status: pending
phase: 4
parent: _index.md
---

# SPEC: openclaw-integration — Phase 4: Agent Infrastructure

## Persona
<role>
Senior TypeScript 개발자. EventEmitter 패턴, SQLite 데이터베이스, 비동기 태스크 관리에 경험이 있으며, Vibe의 BackgroundManager와 SessionStore 아키텍처를 이해한다.
</role>

## Context
<context>
### Background
에이전트 실행의 가시성과 복구력을 강화한다.
- **Announce**: 서브에이전트 완료 시 부모에게 자동 통보 + 통계 수집
- **Registry**: 에이전트 실행 이력을 SQLite에 영속 저장, 세션 재시작 시 복구

### Tech Stack
- TypeScript (ESM, strict)
- Node.js `events.EventEmitter`
- `better-sqlite3` (이미 의존성에 포함)

### Related Code
- `src/orchestrator/BackgroundManager.ts`: task lifecycle (pending → running → completed/failed)
- `src/orchestrator/SessionStore.ts`: in-memory session store (TTL 1h)
- `src/orchestrator/PhasePipeline.ts`: onPhaseStart/onPhaseComplete 콜백 패턴
- `src/orchestrator/types.ts`: `AgentResult`, `BackgroundAgentArgs`, `TaskInfo`
- `src/lib/memory/MemoryStorage.ts` (475 lines): SQLite 패턴 참조 (WAL mode, prepared statements)
- `src/lib/memory/SessionRAGStore.ts`: 구조화된 데이터 저장 패턴

### Design Reference
- OpenClaw `src/agents/subagent-announce.ts` (520 lines): 완료 통보 + 통계
- OpenClaw `src/agents/subagent-registry.ts` (430 lines): 디스크 영속 레지스트리
</context>

## Task
<task>
### Phase 4-A: Subagent Announce Pattern

1. [ ] `src/orchestrator/AgentAnnouncer.ts` 생성 (~150 lines)
   - `EventEmitter` 확장
   - Events: `agent-start`, `agent-complete`, `agent-error`
   - `AgentStartEvent`: taskId, agentName, model, prompt(200자 절삭), timestamp
   - `AgentCompleteEvent`: taskId, agentName, success, duration, model, resultSummary(500자), timestamp
   - `AgentErrorEvent`: taskId, agentName, error, retryable, duration, timestamp
   - `AgentStats` 집계:
     ```typescript
     interface AgentStats {
       totalLaunched: number;
       totalCompleted: number;
       totalFailed: number;
       totalDuration: number;
       avgDuration: number;
       byModel: Record<string, { count: number; totalDuration: number }>;
       byAgent: Record<string, { count: number; successRate: number }>;
     }
     ```
   - `announceStart(event)`, `announceComplete(event)`, `announceError(event)` 메서드
   - `getStats()`, `getRecentHistory(limit?)`, `resetStats()` 메서드
   - `formatStatusLine(event)`: 한 줄 요약 포맷
   - In-memory history (maxHistory: 100, FIFO)
   - Singleton export: `export const agentAnnouncer`

2. [ ] `src/orchestrator/BackgroundManager.ts` 수정 (+25 lines)
   - `executeTask()` 시작 시: `agentAnnouncer.announceStart()`
   - `executeTask()` 성공 시: `agentAnnouncer.announceComplete()`
   - `executeTask()` 실패 시: `agentAnnouncer.announceError()`
   - `getStats()` 에 announcer 통계 포함

3. [ ] `src/orchestrator/index.ts` 수정 (+3 lines)
   - `AgentAnnouncer`, `agentAnnouncer` export

### Phase 4-B: Disk Persistent Agent Registry

4. [ ] `src/orchestrator/AgentRegistry.ts` 생성 (~220 lines)
   - SQLite DB: `{projectPath}/.claude/vibe/agents/registry.db`
   - WAL mode (MemoryStorage 패턴 따름), PRAGMA busy_timeout = 5000
   - `agent_executions` 테이블:
     ```sql
     CREATE TABLE IF NOT EXISTS agent_executions (
       id TEXT PRIMARY KEY,
       task_id TEXT NOT NULL,
       agent_name TEXT NOT NULL,
       prompt TEXT,
       result TEXT,
       status TEXT NOT NULL DEFAULT 'pending',
       duration INTEGER,
       model TEXT,
       started_at INTEGER NOT NULL,
       completed_at INTEGER,
       session_id TEXT,
       error TEXT,
       created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
     );
     CREATE INDEX IF NOT EXISTS idx_status ON agent_executions(status);
     CREATE INDEX IF NOT EXISTS idx_agent_name ON agent_executions(agent_name);
     ```
   - DB 파일 권한: 0o600, 디렉토리 권한: 0o700
   - prompt/result 저장: 최대 2000자로 truncate (민감정보 노출 최소화)
   - error 필드: 토큰/키 패턴 자동 마스킹 후 저장
   - Prepared statements (MemoryStorage 패턴)
   - `recordStart(execution)`: INSERT, return id
   - `recordComplete(id, result, duration)`: UPDATE status='completed'
   - `recordFailure(id, error, duration)`: UPDATE status='failed'
   - `getIncompleteExecutions()`: SELECT WHERE status='running' (크래시 감지)
   - `markOrphaned(olderThanMs)`: running 상태 + olderThanMs 이상 → failed로 변경
   - `getHistory(limit?, agentName?)`: SELECT ORDER BY created_at DESC
   - `getAgentStats(agentName)`: 총 실행, 성공률, 평균 소요시간
   - `getGlobalStats()`: 전체 통계 (byAgent, byModel)
   - `cleanup(ttlMs?)`: completed/failed + ttlMs 이상 삭제 (default 24h)

5. [ ] `src/orchestrator/BackgroundManager.ts` 수정 (+20 lines)
   - constructor에서 `AgentRegistry` 인스턴스 생성 (선택적 — projectPath가 있을 때만)
   - `launch()` 시: `registry.recordStart()`
   - `executeTask()` 성공: `registry.recordComplete()`
   - `executeTask()` 실패: `registry.recordFailure()`
   - 시작 시: `registry.markOrphaned(3600000)` (1시간 이상 running = crashed)

6. [ ] `src/orchestrator/orchestrator.ts` 수정 (+5 lines)
   - CoreOrchestrator constructor에서 AgentRegistry 초기화, BackgroundManager에 전달

7. [ ] `src/orchestrator/index.ts` 수정 (+2 lines)
   - `AgentRegistry` export
</task>

## Constraints
<constraints>
- AgentAnnouncer는 in-memory only (디스크 저장은 AgentRegistry가 담당)
- AgentRegistry의 SQLite DB는 MemoryStorage와 별도 파일 (충돌 방지)
- DB 경로에 projectPath가 없으면 AgentRegistry를 생성하지 않음 (graceful skip)
- `better-sqlite3` 사용 (이미 package.json에 포함)
- Registry cleanup은 애플리케이션 시작 시 자동 실행
- 테이블 마이그레이션은 CREATE IF NOT EXISTS로 처리 (별도 마이그레이션 스크립트 불필요)
- EventEmitter listener 누수 방지: maxListeners = 20 설정
- resultSummary 절삭: result 문자열의 첫 500자를 사용 (truncate, 요약 아님)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/orchestrator/AgentAnnouncer.ts` (~150 lines)
- `src/orchestrator/AgentAnnouncer.test.ts` (~100 lines)
- `src/orchestrator/AgentRegistry.ts` (~220 lines)
- `src/orchestrator/AgentRegistry.test.ts` (~120 lines)

### Files to Modify
- `src/orchestrator/BackgroundManager.ts` (+45 lines)
- `src/orchestrator/orchestrator.ts` (+5 lines)
- `src/orchestrator/index.ts` (+5 lines)

### Verification Commands
- `npx vitest run src/orchestrator/AgentAnnouncer.test.ts`
- `npx vitest run src/orchestrator/AgentRegistry.test.ts`
- `npx tsc --noEmit`
- `npm run build`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] BackgroundManager task 시작 시 `agent-start` 이벤트 발생
- [ ] Task 완료 시 `agent-complete` 이벤트 발생 (success, duration, resultSummary 포함)
- [ ] Task 실패 시 `agent-error` 이벤트 발생 (error, retryable 포함)
- [ ] `agentAnnouncer.getStats()` 호출 시 정확한 집계 반환
- [ ] History가 100개 초과 시 오래된 항목 자동 삭제 (FIFO)
- [ ] AgentRegistry DB가 `{projectPath}/.claude/vibe/agents/registry.db`에 생성됨
- [ ] `recordStart()` + `recordComplete()` 호출 시 DB에 완전한 레코드 저장
- [ ] 프로세스 재시작 후 `getIncompleteExecutions()`이 이전 running 태스크 반환
- [ ] `markOrphaned(3600000)` 호출 시 1시간 이상 running 태스크가 failed로 변경
- [ ] `cleanup(86400000)` 호출 시 24시간 이상 completed/failed 레코드 삭제
- [ ] `npm run build` 성공
</acceptance>
