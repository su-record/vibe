---
status: pending
currentPhase: 4
totalPhases: 4
createdAt: 2026-02-07T09:39:00+09:00
lastUpdated: 2026-02-07T09:39:00+09:00
---

# SPEC: telegram-model-a / Phase 4 - 모니터링 + 복합 라우트

## Persona
<role>
TypeScript/Node.js 시니어 개발자. cron 기반 스케줄링, GitHub 이벤트 모니터링, DAG 기반 복합 태스크 실행 엔진 구현에 전문성을 가진다. 기존 WebhookHandler와 JobManager의 이벤트 패턴을 확장하여 자동화 시스템을 구축한다.
</role>

## Context
<context>
### Background
텔레그램에서 정기 작업 스케줄링, GitHub 모니터링, 복합 명령 실행을 제공하는 2개 라우트. "매일 9시에 뉴스 보내줘", "검색해서 메일로 보내줘" 등의 복합 작업을 DAG로 분해하여 실행한다.

### Who
본인 전용 (1인)

### Tech Stack
- Scheduler: node-cron v3.0+
- GitHub: 기존 WebhookHandler + gh CLI
- DAG: 자체 구현 (topological sort)
- Existing: BaseRoute, RouteRegistry, NotificationManager, JobManager

### Related Code
- `src/interface/webhook/WebhookHandler.ts`: GitHub 이벤트 수신 + HMAC 검증
- `src/job/JobManager.ts`: Job 상태 머신, 이벤트 시스템
- `src/router/routes/BaseRoute.ts`: Phase 1에서 생성
- Phase 2-3의 서비스들: GmailService, WebSearchService 등

### Research Insights
- **Kimi**: DAG 순환 의존성 감지 필수 (topological sort), checkpoint persistence, 병렬 실행 세마포어
- **GPT**: 구조화된 로깅, dead letter queue, graceful degradation
- **Gemini**: Push notification webhooks for real-time updates
- **Kimi 아키텍처**: Saga Pattern for distributed transactions, Observer Pattern for monitoring
</context>

## Task
<task>
### Phase 4.1: 스케줄러 엔진
1. [ ] `src/router/services/SchedulerEngine.ts` 생성
   - node-cron 기반 정기 작업 관리
   - 자연어 → cron 표현식 변환 (LLM 활용):
     - "매일 9시" → `0 9 * * *`
     - "매주 월요일 오전 10시" → `0 10 * * 1`
     - "매시간" → `0 * * * *`
   - 스케줄 CRUD:
     - `create(name, schedule, action): ScheduleJob`
     - `update(jobId, updates): ScheduleJob`
     - `delete(jobId): void`
     - `list(): ScheduleJob[]`
   - 작업 실행: 스케줄 트리거 시 ModelARouter.handleMessage() 호출
   - 영속성: SQLite DB (`~/.vibe/schedules.db`)
     - 스키마: id, name, cron, action, enabled, lastRun, nextRun, createdAt
   - 앱 시작 시 DB에서 스케줄 복원
   - timezone: Asia/Seoul
   - Verify: unit test

2. [ ] `package.json` 수정 — node-cron 추가
   - `node-cron: ^3.0.3`
   - `@types/node-cron` (devDependencies)
   - Verify: `npm install`

### Phase 4.2: GitHub 모니터
3. [ ] `src/router/services/GitHubMonitor.ts` 생성
   - 기존 WebhookHandler 활용:
     - workflow_run.completed (실패 시 알림)
     - pull_request.review_requested (리뷰 요청 알림)
   - 알림 포맷팅:
     - CI 실패: `"[repo] CI 실패: workflow_name - commit_message"`
     - PR 리뷰: `"[repo] PR #N 리뷰 요청: title"`
   - 모니터링 대상 레포: `~/.vibe/router.json`의 `monitor.github.repos`
   - 이벤트 필터링: `monitor.github.events` 설정 기반
   - Verify: unit test

### Phase 4.3: 일일 리포트
4. [ ] `src/router/services/DailyReportGenerator.ts` 생성
   - 매일 저녁(설정 가능, 기본 21:00) "오늘 한 일" 자동 요약
   - 데이터 소스:
     - git log (오늘 커밋 내역): spawn('git', ['log', '--since=midnight', ...])
     - 작업 히스토리 (JobManager 완료된 Job 목록)
     - 메모 (NoteService 오늘 생성된 메모)
   - LLM 요약: SmartRouter로 종합 요약 생성
   - 텔레그램으로 전송
   - SchedulerEngine에 자동 등록
   - Verify: `npx tsc --noEmit`

### Phase 4.4: 모니터 라우트
5. [ ] `src/router/routes/MonitorRoute.ts` 생성
   - canHandle: intent.category === 'monitor'
   - subIntent 분류:
     - `schedule_create`: 스케줄 등록
     - `schedule_list`: 스케줄 목록
     - `schedule_delete`: 스케줄 삭제
     - `github_status`: GitHub 모니터링 상태
     - `report_now`: 즉시 리포트 생성
   - 자연어 스케줄 해석: "매일 9시에 AI 뉴스 검색해서 메일로 보내줘"
     → schedule: "0 9 * * *", action: "AI 뉴스 검색해서 메일로 보내줘"
   - Verify: integration test

### Phase 4.5: 복합 태스크 플래너
6. [ ] `src/router/planner/TaskPlanner.ts` 생성
   - LLM 기반 복합 의도 분해: 자연어 → DAG (Directed Acyclic Graph)
   - DAG 노드: `{ id, type, action, dependsOn: string[], params }`
   - DAG 구성 규칙:
     - 의존성 있는 단계: 순차 실행
     - 의존성 없는 단계: 병렬 실행
     - 이전 단계 결과를 다음 단계 params에 주입
   - LLM 프롬프트: 복합 요청 → JSON DAG 구조 생성
   - LLM 응답 검증:
     - JSON schema 검증
     - 순환 의존성 감지 (topological sort)
     - 등록된 라우트/서비스만 참조 (화이트리스트)
   - Verify: unit test

7. [ ] `src/router/planner/TaskExecutor.ts` 생성
   - DAG 실행 엔진:
     1. topological sort로 실행 순서 결정
     2. 의존성 해결된 노드부터 실행
     3. 병렬 실행 가능한 노드는 Promise.allSettled (부분 실패 허용)
     4. 노드 실행 결과를 컨텍스트에 저장
     5. 다음 노드에 이전 결과 주입
   - 실행 제한:
     - 최대 노드 수: 10개
     - 최대 병렬: 3개 (p-limit 또는 자체 세마포어로 동시성 제어)
     - 노드 타임아웃: 120초
     - 전체 타임아웃: 600초 (10분)
   - 에러 처리:
     - 노드 실패 시 해당 노드만 실패 (의존 노드는 스킵)
     - 부분 결과 반환 (성공한 노드 결과 + 실패 정보)
   - 진행 알림: 각 노드 시작/완료 시 NotificationManager로 알림
   - Verify: unit test

### Phase 4.6: 복합 라우트
8. [ ] `src/router/routes/CompositeRoute.ts` 생성
   - canHandle: intent.category === 'composite'
   - execute 흐름:
     1. TaskPlanner로 DAG 생성
     2. DAG 텔레그램에 미리보기 전송 ("이렇게 실행합니다: ...")
     3. TaskExecutor로 DAG 실행
     4. 결과 종합하여 텔레그램 전송
   - 예시:
     - "AI 논문 3개 찾아서 요약하고 시트에 정리하고 메일로 보내줘"
       → search → summarize → sheets_write + gmail_send (병렬)
   - Verify: integration test

### Phase 4.7: 자연어 히스토리
9. [ ] CompositeRoute에 히스토리 기능 추가
   - "어제 뭐 했지?" → JobManager + git log + NoteService에서 데이터 수집
   - LLM으로 자연어 요약 생성
   - Verify: integration test

### Phase 4.8: 알림 필터링
10. [ ] NotificationManager 확장 (Phase 1 수정)
    - 중요도별 알림 설정:
      - `urgent`: 항상 전송 (방해금지 무시)
      - `normal`: 방해금지 시간 외 전송
      - `low`: 일괄 요약으로 전송 (1시간 모아서)
    - 설정: `~/.vibe/router.json`의 `notifications` 섹션
    - Verify: unit test

### Phase 4.9: 테스트
11. [ ] Unit Tests 작성
    - `SchedulerEngine.test.ts`: cron 등록/삭제/실행, 자연어→cron 변환
    - `TaskPlanner.test.ts`: DAG 생성, 순환 감지, 화이트리스트 검증
    - `TaskExecutor.test.ts`: 순차/병렬 실행, 타임아웃, 부분 실패
    - `GitHubMonitor.test.ts`: 이벤트 필터링, 알림 포맷
    - Verify: `npx vitest run`
</task>

## Constraints
<constraints>
- node-cron 스케줄은 SQLite에 영속화 (앱 재시작 시 복원)
- DAG 순환 의존성 반드시 감지 + 거부
- DAG 노드 최대 10개, 전체 타임아웃 10분
- LLM 응답 JSON schema 검증 필수 (hallucinated 노드 방지)
- GitHub webhook HMAC 검증 (기존 WebhookHandler 활용)
- spawn args array 사용 (git log 등)
- 함수 길이 30줄 이내, Nesting 3 이하
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/router/services/SchedulerEngine.ts`
- `src/router/services/GitHubMonitor.ts`
- `src/router/services/DailyReportGenerator.ts`
- `src/router/planner/TaskPlanner.ts`
- `src/router/planner/TaskExecutor.ts`
- `src/router/routes/MonitorRoute.ts`
- `src/router/routes/CompositeRoute.ts`

### Files to Modify
- `src/router/notifications/NotificationManager.ts` (알림 중요도 추가)
- `package.json` (node-cron 추가)

### Test Files to Create
- `src/router/services/SchedulerEngine.test.ts`
- `src/router/services/GitHubMonitor.test.ts`
- `src/router/planner/TaskPlanner.test.ts`
- `src/router/planner/TaskExecutor.test.ts`
- `src/router/routes/MonitorRoute.test.ts`
- `src/router/routes/CompositeRoute.test.ts`

### Verification Commands
- `npx tsc --noEmit`
- `npx vitest run`
- `npm install`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: "매일 9시에 AI 뉴스 검색해서 메일로 보내줘" → 스케줄 등록 → 매일 실행 확인
- [ ] AC-2: "스케줄 목록" → 등록된 스케줄 목록 텔레그램 전송
- [ ] AC-3: GitHub Actions 실패 → 텔레그램 알림 (CI 실패 정보 포함)
- [ ] AC-4: "검색해서 메일로 보내줘" → DAG 생성 (search → gmail) → 순차 실행 → 결과 전송
- [ ] AC-5: "논문 찾아서 요약하고 시트+메일로 보내줘" → DAG 병렬 실행 (sheets + gmail)
- [ ] AC-6: DAG 순환 의존성 → 즉시 거부 + 에러 메시지
- [ ] AC-7: DAG 노드 실패 시 → 부분 결과 반환 + 실패 노드 정보
- [ ] AC-8: "어제 뭐 했지?" → git log + job 히스토리 → 자연어 요약
- [ ] AC-9: 일일 리포트 매일 21:00 자동 생성 → 텔레그램 전송
- [ ] AC-10: `npx tsc --noEmit` 빌드 성공
- [ ] AC-11: `npx vitest run` 모든 테스트 통과

### Ambiguity Scan Auto-fixes

- SchedulerEngine 앱 종료 시: graceful shutdown (실행 중 작업 완료 대기 최대 30초)
- DailyReportGenerator "오늘" 기준: Asia/Seoul timezone 고정
</acceptance>
