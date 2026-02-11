---
status: pending
phase: 4
title: Async Job System
---

# SPEC: vibe-agent - Phase 4: Async Job System

## Persona
<role>
Senior TypeScript developer specializing in async job processing.
- Queue-based 비동기 시스템 설계 전문
- Telegram Bot 진행률 보고 경험
- 기존 BackgroundManager에 정통
</role>

## Context
<context>
### Background
개발 요청 등 장시간 작업은 즉시 응답 → 진행률 보고 → 완료 알림 패턴이 필요하다.
기존 BackgroundManager의 fire-and-forget 패턴을 확장하여 Telegram 진행률 보고를 추가한다.

### Current System
- `src/orchestrator/BackgroundManager.ts`: launch/poll 패턴
- Concurrency 관리: 모델별 제한 (Opus 3, Sonnet 5, Haiku 8)
- Bounded Queue: 100 tasks max

### Target Flow
```
User: "로그인 기능 만들어줘" (음성/텍스트)
  ↓
Head: "네, 로그인 기능 개발을 시작합니다. 진행 상황을 알려드리겠습니다."
  ↓ (즉시 응답)
Head: tool_call → claude_code({ task: "로그인 기능 구현" })
  ↓ (비동기 실행)
[진행률] "Phase 1/3: 타입 정의 완료..."
[진행률] "Phase 2/3: API 구현 중..."
[진행률] "Phase 3/3: 테스트 작성 완료"
  ↓
Head: "로그인 기능 구현이 완료되었습니다. [요약]"
```

### Related Code
- `src/orchestrator/BackgroundManager.ts`: 기존 Job 큐
- `src/orchestrator/AgentAnnouncer.ts`: 진행 알림
</context>

## Task
<task>
### Phase 4-1: Job 타입 확장
1. [ ] `src/agent/jobs/types.ts` 생성
   - `AgentJob`: `{ id, chatId, task, status, progress, createdAt, completedAt, result }`
   - `JobStatus`: `'queued' | 'running' | 'completed' | 'failed' | 'cancelled'`
   - `JobProgress`: `{ phase, totalPhases, message, percent }`
   - File: `src/agent/jobs/types.ts`

### Phase 4-2: JobManager 구현
1. [ ] `src/agent/jobs/JobManager.ts` 생성
   - `create(chatId, task)`: Job 생성 → 즉시 jobId 반환
   - `start(jobId)`: 비동기 실행 시작
   - `updateProgress(jobId, progress)`: 진행률 업데이트
   - `complete(jobId, result)`: 완료 처리
   - `cancel(jobId)`: 취소 (AbortController)
   - `getStatus(jobId)`: 상태 조회
   - `listActive(chatId)`: 활성 Job 목록
   - SQLite에 Job 상태 영속화
   - **DB 스키마**: `agent_jobs` 테이블
     - `id TEXT PRIMARY KEY, chatId TEXT NOT NULL, task TEXT, status TEXT DEFAULT 'queued'`
     - `progress TEXT (JSON), result TEXT, createdAt TEXT, completedAt TEXT`
     - Index: `idx_jobs_chatId_status ON agent_jobs(chatId, status)`
   - **Retention**: 완료/실패 Job은 7일 보관 후 자동 삭제 (startup 시 cleanup)
   - 동시 실행: 최대 3개 (개인 에이전트 기준)
   - **Startup Recovery**: 초기화 시 status='running' 상태의 Job → status='failed' (error: 'system_restart') 변경, 사용자에게 알림
   - File: `src/agent/jobs/JobManager.ts`
   - Verify: `npm test`

### Phase 4-3: Telegram Progress Reporter
1. [ ] `src/agent/jobs/ProgressReporter.ts` 생성
   - `reportStart(chatId, jobId, task)`: "작업을 시작합니다" 메시지 전송
   - `reportProgress(chatId, jobId, progress)`: 진행률 메시지 (기존 메시지 편집)
   - `reportComplete(chatId, jobId, summary)`: 완료 요약 전송
   - `reportError(chatId, jobId, error)`: 에러 알림
   - Telegram `editMessageText` API로 기존 메시지 업데이트 (새 메시지 스팸 방지)
   - editMessageText 실패 시 새 메시지로 fallback 전송
   - 진행률 업데이트 rate limiting: 최소 3초 간격
   - File: `src/agent/jobs/ProgressReporter.ts`

### Phase 4-4: Agent Tool 연동
1. [ ] `src/agent/tools/claude-code.ts` 수정
   - 장시간 작업 감지: 예상 소요 30초 이상 → Job으로 전환
   - Job 생성 → 즉시 jobId 반환 → 비동기 실행
   - 실행 중 진행률 콜백으로 ProgressReporter 호출
   - File: `src/agent/tools/claude-code.ts`
</task>

## Constraints
<constraints>
- 동시 Job 실행: 최대 3개
- Job timeout: 10분
- Progress 업데이트 rate limit: 3초 간격
- Job 상태 SQLite 영속화 (재시작 시 복구)
- Telegram editMessageText로 기존 메시지 업데이트 (스팸 방지)
- editMessageText 실패 시 새 메시지로 fallback 전송
- SQLite DB 연결 실패 시 graceful error 반환 (Job 생성 불가 메시지)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/agent/jobs/types.ts`
- `src/agent/jobs/JobManager.ts`
- `src/agent/jobs/ProgressReporter.ts`

### Files to Modify
- `src/agent/tools/claude-code.ts` (Job 연동)

### Verification Commands
- `npm run build`
- `npm test`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: Job 생성 시 즉시 jobId가 반환된다
- [ ] AC-2: Job이 비동기로 실행되고 상태가 SQLite에 저장된다
- [ ] AC-3: 진행률 업데이트가 Telegram editMessageText로 전달된다
- [ ] AC-4: 진행률 업데이트 rate limiting이 3초 간격으로 동작한다
- [ ] AC-5: Job 완료 시 요약 메시지가 전송된다
- [ ] AC-6: Job 취소가 동작한다 (AbortController)
- [ ] AC-7: 동시 3개 초과 Job은 대기열에 들어간다
- [ ] AC-8: Job timeout 10분 동작한다
- [ ] AC-9: claude_code tool이 장시간 작업을 Job으로 자동 전환한다
- [ ] AC-10: SQLite DB 연결 실패 시 Job 생성이 에러 반환하고 사용자에게 알린다
- [ ] AC-11: editMessageText 실패 시 새 메시지로 fallback 전송된다
- [ ] AC-12: 빌드 성공 (`npm run build`)
</acceptance>
