---
status: pending
phase: 2
createdAt: 2026-02-06T10:49:09+09:00
---

# SPEC: Phase 2 - Job/Order 시스템

## Persona

<role>
Senior backend engineer specializing in:
- Task queue systems
- State machine design
- Event-driven architecture
- TypeScript strict mode
</role>

## Context

<context>

### Background
외부에서 들어온 모든 요청은 **Job**으로 정규화되어야 한다.
Job은 즉시 실행되지 않고, Intent 해석 → ActionPlan 생성 → Policy 평가를 거친다.

### Why
- 일관된 요청 처리 (어떤 인터페이스에서 와도 동일)
- 실행 전 판단 단계 강제
- 모든 작업의 추적 가능성 (audit trail)

### Tech Stack
- Database: SQLite (better-sqlite3) - 이미 사용 중
- Queue: 인메모리 + SQLite 영속화
- State Machine: XState 패턴 (의존성 없이 직접 구현)

### Related Code
- `src/orchestrator/BackgroundManager.ts`: 작업 큐 패턴 참고
- `src/lib/memory/SessionRAGStore.ts`: SQLite 사용 패턴
- `src/orchestrator/types.ts`: 기존 타입 정의

### Design Reference
- Bull/BullMQ: 작업 큐 패턴
- Temporal: 워크플로우 오케스트레이션

</context>

## Task

<task>

### Phase 2.1: Job Model
1. [ ] `src/job/types.ts` 생성
   - Job 인터페이스 정의
   - JobStatus enum (pending, parsing, planning, evaluating, awaiting_approval, approved, rejected, executing, completed, failed, cancelled)
   - ActionPlan 인터페이스
   - Verify: 타입 체크 통과

2. [ ] `src/job/JobStore.ts` 생성
   - SQLite 테이블 (`jobs`, `action_plans`, `job_logs`)
   - CRUD 메서드
   - 상태 변경 로깅
   - Verify: 유닛 테스트

### Phase 2.2: Job Lifecycle
3. [ ] `src/job/JobManager.ts` 생성
   - Job 생성 (외부 요청 → Job 변환)
   - 상태 머신 구현
   - **상태 전이 다이어그램:**
     ```
     pending → parsing → planning → evaluating → approved → executing → completed
                                              ↘ rejected   ↘ failed
                                        (awaiting_approval) ↗ cancelled
     ```
   - **허용 전이:** pending→parsing, parsing→planning, planning→evaluating,
     evaluating→approved/rejected/awaiting_approval, awaiting_approval→approved/rejected,
     approved→executing, executing→completed/failed/cancelled
   - 상태 전이 이벤트 발행
   - Verify: 상태 전이 테스트

4. [ ] Intent Parser
   - 자연어 요청 → 구조화된 Intent
   - 프로젝트 경로 추출
   - 작업 유형 분류 (code, analyze, review, etc.)
   - Verify: 다양한 입력 파싱 테스트

5. [ ] ActionPlan Generator
   - Intent → ActionPlan 변환
   - 단계별 액션 정의
   - 리스크 레벨 계산
   - confidence 점수
   - Verify: ActionPlan 구조 검증

```yaml
# ActionPlan 예시
job:
  id: "job-123"
  intent: "Add login feature to project"
  project_path: "/Users/grove/workspace/my-app"
  actions:
    - type: analyze_codebase
      target: "src/"
    - type: create_spec
      feature: "login"
    - type: implement
      spec_path: ".claude/vibe/specs/login.md"
    - type: test
      command: "npm test"
  risk_level: medium
  confidence: 0.85
  estimated_files: 5
```

### Phase 2.3: Job Queue
6. [ ] `src/job/JobQueue.ts` 생성
   - 우선순위 큐 (1=highest ~ 10=lowest, 기본 5)
   - 동시 실행 제한 (기본 3)
   - 재시도 로직 (최대 3회, 지수 백오프 + jitter: 30s/60s/120s ±20%)
   - **재시도 상태 전이:** `failed` → `pending` (retry_count 증가, next_run_at DB 저장)
   - Verify: 동시성 테스트, 백오프 스케줄 테스트

7. [ ] Job 실행기
   - ActionPlan을 Claude Code로 전달
   - 단계별 실행 및 상태 업데이트
   - 실행 결과 수집
   - **실행 타임아웃:** 액션별 10분, Job 전체 60분 (초과 시 cancelled)
   - **Plan-to-Execution 바인딩:** pre-tool-guard에서 실행 중 액션이 승인된 ActionPlan 범위 내인지 검증, 범위 이탈 시 차단 + Evidence 기록
   - **상태 전이 원자성:** SQLite 트랜잭션으로 status/logs/evidence 동시 업데이트
   - Verify: E2E 실행 테스트, 타임아웃 테스트, 범위 이탈 차단 테스트

### Phase 2.4: Job API
8. [ ] Daemon RPC 메서드 추가
   - `job.create` - 새 Job 생성
   - `job.get` - Job 조회
   - `job.list` - Job 목록
   - `job.cancel` - Job 취소
   - `job.approve` - Job 승인 (Policy 통과 후)
   - Verify: RPC 호출 테스트

9. [ ] CLI 명령어 추가
   - `vibe job list`
   - `vibe job status <job-id>`
   - `vibe job cancel <job-id>`
   - Verify: CLI 동작 테스트

</task>

## Constraints

<constraints>
- Job ID는 UUID v4
- 모든 상태 변경은 DB에 기록
- 실행 중인 Job은 취소 가능 (graceful)
- Job 데이터는 30일 보관 후 자동 정리
- **DB 정리 메커니즘:**
  - 데몬 시작 시 + 24시간마다 백그라운드 정리 실행
  - `DELETE FROM jobs WHERE created_at < date('now', '-30 days')`
  - `PRAGMA wal_checkpoint(TRUNCATE)` 실행
  - Evidence 테이블도 동일 정책 적용
- **승인 결정은 PolicyEngine이 단독 결정** (ActionPlan의 risk_level은 참고 입력값, PolicyEngine의 `requiresApproval` 결과가 최종)
- **승인 메커니즘:** Job이 `awaiting_approval` 상태 진입 → IPC/Telegram/Web으로 알림 발송 → `vibe job approve <id>` 또는 Telegram 버튼으로 승인 → `approved` 상태로 전이
- 승인 대기 타임아웃: 24시간 (초과 시 자동 rejected)
- `job.create` RPC는 DB 저장 후 즉시 반환 (< 100ms), Intent 파싱/ActionPlan 생성은 비동기 처리
- Intent 파싱 시간: p95 < 3000ms (LLM 호출 경유), 휴리스틱 파싱 시 < 500ms
- **크래시 복구:** 데몬 재시작 시 `executing` → `failed` (retry_count < 3이면 재큐), `awaiting_approval` 유지, `parsing/planning/evaluating` → `pending` (재처리)
- **DB 스키마:** `jobs` 테이블 (id UUID PK, status TEXT, intent TEXT, project_path TEXT, priority INT, retry_count INT, created_at TEXT ISO-8601 UTC, updated_at TEXT), 인덱스: status, created_at, project_path
- **관련 데이터 정리:** `action_plans`, `job_logs`, `evidence` 테이블에 job_id FK + `ON DELETE CASCADE` (job 삭제 시 관련 데이터 자동 정리)
</constraints>

## Output Format

<output_format>

### Files to Create
- `src/job/types.ts` - 타입 정의
- `src/job/JobStore.ts` - DB 저장소
- `src/job/JobManager.ts` - 생명주기 관리
- `src/job/JobQueue.ts` - 작업 큐
- `src/job/IntentParser.ts` - Intent 파싱
- `src/job/ActionPlanGenerator.ts` - 실행 계획 생성
- `src/job/index.ts` - 모듈 export
- `src/cli/commands/job.ts` - CLI 명령어

### Files to Modify
- `src/daemon/VibeDaemon.ts` - RPC 메서드 등록
- `src/cli/index.ts` - job 명령어 등록

### Verification Commands
- `npm run build`
- `npm test`
- `vibe job list`

</output_format>

## Acceptance Criteria

<acceptance>
- [ ] 외부 요청이 Job으로 변환됨
- [ ] Job 상태 머신 동작 (9개 상태)
- [ ] ActionPlan 자동 생성
- [ ] Job 큐 동작 (우선순위, 동시성 제한)
- [ ] `vibe job list/status/cancel` CLI 동작
- [ ] Job 이력 SQLite 저장
- [ ] 빌드 성공
- [ ] 테스트 통과
</acceptance>
