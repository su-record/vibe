---
status: pending
phase: 1
---

# SPEC: agent-autonomy — Phase 1: Event Core & Audit Foundation

## Persona
<role>
Senior TypeScript engineer specializing in event-driven architecture and audit systems.
Follow existing vibe patterns: SQLite WAL mode, Zod validation, typed EventEmitter.
Build foundational event bus and immutable audit log for governance layer.
</role>

## Context
<context>
### Background
자율 에이전트 시스템의 핵심 인프라. 모든 에이전트 행위를 이벤트로 캡처하고,
불변 감사 로그에 기록하여 추적성과 감사 가능성을 확보.
이후 Phase 2-5의 모든 컴포넌트가 이 이벤트 코어 위에 구축됨.

### 기존 시스템
- `src/lib/evolution/CircuitBreaker.ts`: 기존 서킷 브레이커 패턴
- `src/lib/memory/MemoryStorage.ts`: SQLite 테이블 관리 패턴
- `hooks/scripts/evolution-engine.js`: PostToolUse 이벤트 처리 패턴
- `src/lib/evolution/GenerationRegistry.ts`: SQLite 레지스트리 패턴

### Research Insights
- GPT: "Centralize a Security Sentinel as PEP + PDP + audit store"
- GPT: "Use outbox pattern for reliable event dispatch from SQLite to message bus"
- GPT: "Store all decisions with correlation IDs and causation IDs"
- Gemini: "Event-Sourced Audit Log — immutable event sequence in SQLite"
- Gemini: "SQLite WAL Mode Concurrency for concurrent reads during writes"
- Gemini: "Immutable Audit Log Triggers — BEFORE UPDATE/DELETE RAISE ABORT"
- Kimi: "Transactional Outbox — exactly-once event delivery"
- Kimi: "Batched Audit Writes — buffer and flush in batches"
- Kimi: "Indexed Audit Schema — composite indexes on (agent_id, timestamp)"
</context>

## Task
<task>
### Phase 1-1: EventBus 구현
1. [ ] `src/lib/autonomy/EventBus.ts` 생성
   - File: `src/lib/autonomy/EventBus.ts`
   - Typed EventEmitter (TypeScript generic)
   - 이벤트 타입: `agent_action`, `policy_check`, `risk_assessed`, `confirmation_requested`, `confirmation_resolved`, `action_executed`, `action_blocked`, `suggestion_created`, `audit_logged`
   - 각 이벤트에 Zod 스키마 검증
   - correlationId 자동 주입 (UUIDv7)
   - 동기/비동기 리스너 지원
   - 리스너 에러 격리: 각 리스너를 try-catch로 래핑, 한 리스너 실패 시 나머지 계속 실행. 실패한 리스너 에러는 `error` 이벤트로 발행 + AuditStore에 기록
   - 최대 리스너 수: 50 (메모리 누수 방지)
   - Verify: `vitest run src/lib/autonomy/__tests__/event-bus.test.ts`

2. [ ] 이벤트 스키마 정의
   - File: `src/lib/autonomy/schemas.ts`
   - Zod 스키마:
     ```
     AgentActionEvent { correlationId, agentId, actionType, target, params, riskLevel?, timestamp }
     PolicyCheckEvent { correlationId, actionEvent, policies, result, duration }
     RiskAssessedEvent { correlationId, actionEvent, riskLevel, factors, score }
     ConfirmationEvent { correlationId, actionId, channel, status, ownerResponse?, expiresAt }
     AuditLogEvent { correlationId, eventType, payload, sourceAgentId, timestamp }
     ```
   - RiskLevel enum: `LOW` | `MEDIUM` | `HIGH`
   - ActionType enum: `file_write` | `file_delete` | `bash_exec` | `git_push` | `skill_generate` | `config_modify` | `dependency_install` | `external_api_call`
   - Verify: Zod 스키마 파싱 테스트

### Phase 1-2: AuditStore 구현
3. [ ] `src/lib/autonomy/AuditStore.ts` 생성
   - File: `src/lib/autonomy/AuditStore.ts`
   - 기존 memories.db에 `audit_events` 테이블 추가:
     ```sql
     audit_events {
       id TEXT PRIMARY KEY (UUIDv7),
       correlationId TEXT NOT NULL,
       causationId TEXT,
       eventType TEXT NOT NULL,
       agentId TEXT,
       actionType TEXT,
       riskLevel TEXT,
       payload JSON NOT NULL,
       outcome TEXT ('allowed' | 'blocked' | 'pending' | 'expired'),
       createdAt TEXT NOT NULL (ISO8601)
     }
     ```
   - FTS5 테이블: `audit_events_fts` (content=audit_events, content_rowid=rowid)
     ```sql
     CREATE VIRTUAL TABLE IF NOT EXISTS audit_events_fts USING fts5(
       eventType, agentId, payload,
       content='audit_events', content_rowid='rowid'
     );
     CREATE TRIGGER IF NOT EXISTS audit_events_ai AFTER INSERT ON audit_events BEGIN
       INSERT INTO audit_events_fts(rowid, eventType, agentId, payload)
       VALUES (new.rowid, new.eventType, new.agentId, new.payload);
     END;
     ```
   - FTS5 검색 입력 sanitization: 특수문자(", *, -, OR, AND) 이스케이프 처리
   - 복합 인덱스: `(agentId, createdAt)`, `(eventType, createdAt)`, `(correlationId)`
   - payload 저장 전 민감 데이터 redaction: `AuditStore.redactSensitive(payload)` 메서드
     - 정규식 패턴: API 키(`sk-*`, `key-*`), 토큰(`Bearer *`), 비밀번호 필드 → `[REDACTED]`
   - Verify: `vitest run src/lib/autonomy/__tests__/audit-store.test.ts`

4. [ ] Immutable audit 보호 (SQLite TRIGGER)
   - File: `src/lib/autonomy/AuditStore.ts` (initTables 메서드 내)
   - TRIGGER:
     ```sql
     CREATE TRIGGER IF NOT EXISTS prevent_audit_update
       BEFORE UPDATE ON audit_events
       BEGIN SELECT RAISE(ABORT, 'Audit logs are immutable'); END;

     CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
       BEFORE DELETE ON audit_events
       BEGIN SELECT RAISE(ABORT, 'Audit logs are immutable'); END;
     ```
   - Verify: UPDATE/DELETE 시도 시 에러 발생 테스트

5. [ ] 감사 로그 조회 API
   - File: `src/lib/autonomy/AuditStore.ts`
   - `query(filters)`: agentId, eventType, riskLevel, dateRange 필터링
   - `getByCorrelation(correlationId)`: 연관 이벤트 체인 조회
   - `getStats(dateRange)`: 기간별 통계 (이벤트 수, 위험도 분포, 차단율)
   - `search(query)`: FTS5 풀텍스트 검색
   - 결과 pagination: 기본 50건, 최대 200건
   - Verify: 필터링, 페이지네이션, FTS 검색 테스트

### Phase 1-3: Transactional Outbox
6. [ ] `src/lib/autonomy/EventOutbox.ts` 생성
   - File: `src/lib/autonomy/EventOutbox.ts`
   - `event_outbox` 테이블:
     ```sql
     event_outbox {
       id TEXT PRIMARY KEY (UUIDv7),
       eventType TEXT NOT NULL,
       payload JSON NOT NULL,
       status TEXT DEFAULT 'pending' ('pending' | 'processing' | 'published' | 'failed'),
       retryCount INTEGER DEFAULT 0,
       createdAt TEXT NOT NULL,
       publishedAt TEXT
     }
     ```
   - `enqueue(event)`: 트랜잭션 내 outbox에 이벤트 추가
   - `start()`: 1초 간격 setInterval로 processOutbox() 호출 + 즉시 'processing' 상태 이벤트 복구
   - `stop()`: graceful shutdown — 현재 배치 완료 후 interval 정지
   - `processOutbox()`: pending 이벤트를 EventBus로 발행 후 published로 변경
   - 실패 시 retryCount 증가 (최대 3회, exponential backoff: 1s → 5s → 10s)
   - 3회 초과 시 failed로 마킹 + `dead_letter_events` 테이블에 이동 + stderr 에러 로그
   - `dead_letter_events` 테이블 스키마:
     ```sql
     dead_letter_events {
       id TEXT PRIMARY KEY (UUIDv7),
       originalEventId TEXT NOT NULL,
       eventType TEXT NOT NULL,
       payload TEXT NOT NULL,
       error TEXT NOT NULL,
       retryCount INTEGER NOT NULL,
       failedAt TEXT NOT NULL (ISO8601),
       resolvedAt TEXT,
       status TEXT DEFAULT 'failed' ('failed' | 'retried' | 'discarded')
     }
     ```
   - Dead Letter 이벤트는 `vibe sentinel audit --dead-letter` CLI로 수동 재시도 가능
   - exactly-once 보장:
     1. `processOutbox()`: status를 'processing'으로 원자적 변경 (SELECT + UPDATE in transaction)
     2. EventBus 발행 시도
     3. 성공 시 'published'로 변경, 실패 시 'pending'으로 롤백 + retryCount 증가
     4. 프로세스 재시작 시: `startup()` 메서드에서 'processing' 상태 이벤트를 'pending'으로 복구
     5. 컨슈머 idempotency: event_outbox.id를 eventId로 사용, EventBus에서 최근 1000개 eventId LRU 캐시로 중복 발행 무시
   - Verify: exactly-once 발행 테스트, 실패 재시도 테스트, Dead Letter Queue 테스트, 프로세스 재시작 복구 테스트

### Phase 1-4: 모듈 Export & 테스트
7. [ ] `src/lib/autonomy/index.ts` 생성
   - File: `src/lib/autonomy/index.ts`
   - EventBus, AuditStore, EventOutbox, schemas export
   - Verify: import 테스트

8. [ ] 통합 테스트
   - File: `src/lib/autonomy/__tests__/event-core.test.ts`
   - 시나리오: 이벤트 발행 → AuditStore 기록 → Outbox 처리 → 조회
   - 동시성 테스트: 10개 이벤트 병렬 기록 (SQLITE_BUSY 시 busy_timeout 5000ms 대기)
   - 성능 테스트: 1000개 이벤트 100ms 이내 기록
   - FTS5 검색 성능: 1000개 이벤트 중 검색 100ms 이내
   - Verify: `vitest run src/lib/autonomy/__tests__/event-core.test.ts`
</task>

## Constraints
<constraints>
- 기존 MemoryStorage.initTables() 패턴 따르기
- better-sqlite3 동기 API 사용 (WAL 모드)
- 모든 쓰기는 트랜잭션 내 완료
- PRAGMA busy_timeout = 5000
- 이벤트 처리 지연: 리스너당 5ms 이내, 전체 이벤트 처리(모든 동기 리스너) 50ms 이내
- 비동기 작업(Outbox 발행 등): 최대 5초 타임아웃, 이후 background 처리
- 감사 로그 보관: 기본 무제한, config.json `sentinel.auditRetentionDays`로 설정 가능
- 메모리 사용: EventBus 리스너 최대 50개
- Zod strict mode로 스키마 정의 (unknown 필드 거부)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/autonomy/EventBus.ts`
- `src/lib/autonomy/schemas.ts`
- `src/lib/autonomy/AuditStore.ts`
- `src/lib/autonomy/EventOutbox.ts`
- `src/lib/autonomy/index.ts`
- `src/lib/autonomy/__tests__/event-bus.test.ts`
- `src/lib/autonomy/__tests__/audit-store.test.ts`
- `src/lib/autonomy/__tests__/event-core.test.ts`

### Files to Modify
- `src/lib/memory/MemoryStorage.ts` (initTables에 autonomy 테이블 추가)

### Verification Commands
- `vitest run src/lib/autonomy/__tests__/`
- `npx tsc --noEmit`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: EventBus가 typed 이벤트를 발행/구독하고, correlationId를 자동 주입함
- [ ] AC-2: 모든 이벤트에 Zod 스키마 검증이 적용됨
- [ ] AC-3: audit_events 테이블이 append-only (UPDATE/DELETE TRIGGER로 보호)
- [ ] AC-4: AuditStore.query()가 agentId, eventType, riskLevel, dateRange 필터링 지원
- [ ] AC-5: AuditStore.getByCorrelation()이 연관 이벤트 체인을 반환
- [ ] AC-6: EventOutbox가 트랜잭션 내 이벤트를 enqueue하고 비동기로 발행
- [ ] AC-7: Outbox 실패 시 3회 재시도 후 failed 마킹
- [ ] AC-8: 1000개 이벤트 기록이 100ms 이내에 완료
- [ ] AC-9: 모든 테스트 통과 + TypeScript 빌드 성공
</acceptance>
