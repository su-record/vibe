# Feature: telegram-model-a - Phase 4: 모니터링 + 복합 라우트

**SPEC**: `.claude/vibe/specs/telegram-model-a/phase-4-monitor-composite.md`
**Master Feature**: `.claude/vibe/features/telegram-model-a/_index.feature`

## User Story (Phase Scope)

**As a** 개인 사용자
**I want** 텔레그램에서 정기 작업을 스케줄링하고, 복합 명령을 DAG로 자동 분해하여 실행하기를
**So that** 반복 업무를 자동화하고, 여러 단계의 복잡한 요청을 한 번에 처리할 수 있다

## Scenarios

### Scenario 1: 스케줄 등록 (자연어)

```gherkin
Scenario: "매일 9시에 AI 뉴스 검색해서 메일로 보내줘" → cron 등록
  Given 사용자가 "매일 9시에 AI 뉴스 검색해서 메일로 보내줘"를 전송
  And IntentClassifier가 "monitor"로 분류
  When MonitorRoute가 실행 (subIntent: schedule_create)
  Then SchedulerEngine이 자연어→cron 변환: "0 9 * * *"
  And action: "AI 뉴스 검색해서 메일로 보내줘"
  And SQLite에 스케줄 저장
  And 텔레그램에 "스케줄 등록됨: 매일 09:00" 알림
```
**Verification**: SPEC AC #1

### Scenario 2: 스케줄 목록 조회

```gherkin
Scenario: "스케줄 목록" → 등록된 스케줄 표시
  Given 3개의 스케줄이 등록됨
  When 사용자가 "스케줄 목록"을 전송
  Then MonitorRoute가 SchedulerEngine.list() 호출
  And 포맷팅된 스케줄 목록을 텔레그램에 전송
  And 각 항목에 이름, cron, 다음 실행 시간 포함
```
**Verification**: SPEC AC #2

### Scenario 3: 스케줄 실행 (cron 트리거)

```gherkin
Scenario: cron 트리거 시 등록된 action 실행
  Given "매일 09:00" 스케줄이 등록됨
  And action이 "AI 뉴스 검색해서 메일로 보내줘"
  When 09:00 cron 트리거 발생
  Then ModelARouter.handleMessage()로 action 전달
  And 복합 라우트 실행 (search → gmail)
  And 결과를 텔레그램에 전송
```
**Verification**: SPEC AC #1

### Scenario 4: GitHub CI 실패 알림

```gherkin
Scenario: GitHub Actions 실패 → 텔레그램 알림
  Given WebhookHandler가 GitHub workflow_run.completed 이벤트 수신
  And conclusion이 "failure"
  When GitHubMonitor가 이벤트 처리
  Then 텔레그램에 "[repo] CI 실패: workflow_name - commit_message" 알림 전송
```
**Verification**: SPEC AC #3

### Scenario 5: 복합 태스크 - 순차 실행

```gherkin
Scenario: "검색해서 메일로 보내줘" → DAG 순차 실행
  Given 사용자가 "AI 관련 뉴스 검색해서 메일로 보내줘"를 전송
  And IntentClassifier가 "composite"로 분류
  When TaskPlanner가 DAG 생성:
    | id | type | action | dependsOn |
    | 1 | research | web_search("AI 뉴스") | [] |
    | 2 | google | gmail_send(step1.result) | [1] |
  Then TaskExecutor가 순차 실행: step1 → step2
  And 텔레그램에 최종 결과 전송
```
**Verification**: SPEC AC #4

### Scenario 6: 복합 태스크 - 병렬 실행

```gherkin
Scenario: "논문 찾아서 요약 후 시트+메일로 보내줘" → DAG 병렬
  Given 사용자가 "AI 논문 3개 찾아서 요약하고 시트에 정리하고 메일로 보내줘"를 전송
  When TaskPlanner가 DAG 생성:
    | id | type | action | dependsOn |
    | 1 | research | web_search | [] |
    | 2 | research | summarize | [1] |
    | 3 | google | sheets_write | [2] |
    | 4 | google | gmail_send | [2] |
  Then TaskExecutor가 실행: 1→2→(3,4 병렬)
  And step 3, 4가 Promise.all로 동시 실행
```
**Verification**: SPEC AC #5

### Scenario 7: DAG 순환 의존성 거부

```gherkin
Scenario: 순환 의존성이 있는 DAG → 즉시 거부
  Given TaskPlanner가 LLM으로 DAG 생성
  And DAG에 순환 의존성 존재 (A→B→C→A)
  When topological sort 검증 실행
  Then 즉시 거부
  And 텔레그램에 "순환 의존성이 감지되었습니다" 에러 메시지
```
**Verification**: SPEC AC #6

### Scenario 8: DAG 노드 부분 실패

```gherkin
Scenario: DAG 일부 노드 실패 → 부분 결과 반환
  Given 4개 노드 DAG 실행 중
  And 노드 3 (gmail_send) 실패
  When TaskExecutor가 실행
  Then 노드 1, 2 결과는 정상 반환
  And 노드 3 실패 정보 포함
  And 노드 4 (sheets_write)는 노드 3에 의존하지 않으면 실행
  And 텔레그램에 "3/4 완료, 1개 실패" 결과 전송
```
**Verification**: SPEC AC #7

### Scenario 9: 자연어 히스토리

```gherkin
Scenario: "어제 뭐 했지?" → 히스토리 조회
  Given 사용자가 "어제 뭐 했지?"를 전송
  When CompositeRoute가 실행
  Then git log + JobManager 히스토리 + NoteService 데이터 수집
  And LLM으로 자연어 요약 생성
  And 텔레그램에 요약 전송
```
**Verification**: SPEC AC #8

### Scenario 10: 일일 리포트

```gherkin
Scenario: 매일 21:00 자동 일일 리포트
  Given DailyReportGenerator가 SchedulerEngine에 등록됨 (21:00)
  When 21:00 cron 트리거
  Then git log (오늘 커밋) + Job 히스토리 + 메모 수집
  And LLM으로 종합 요약 생성
  And 텔레그램에 리포트 전송
```
**Verification**: SPEC AC #9

### Scenario 11: DAG 진행 알림

```gherkin
Scenario: DAG 각 노드 시작/완료 시 진행 알림
  Given 4개 노드 DAG 실행 시작
  When 각 노드 실행 시작
  Then NotificationManager로 "Step 1/4 실행 중: web_search" 알림
  When 노드 완료
  Then "Step 1/4 완료" 알림
```
**Verification**: SPEC AC #4, AC #5

### Scenario 12: 알림 중요도 필터링

```gherkin
Scenario: 중요도별 알림 필터링
  Given 알림 설정이 "normal" 모드
  When urgent 알림 발생 (CI 실패)
  Then 방해금지 시간에도 즉시 전송
  When low 알림 발생 (일반 진행)
  Then 1시간 모아서 일괄 전송
```
**Verification**: SPEC AC #1 (알림 관련)

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 |  |
| 2 | AC-2 |  |
| 3 | AC-1 |  |
| 4 | AC-3 |  |
| 5 | AC-4 |  |
| 6 | AC-5 |  |
| 7 | AC-6 |  |
| 8 | AC-7 |  |
| 9 | AC-8 |  |
| 10 | AC-9 |  |
| 11 | AC-4, AC-5 |  |
| 12 | AC-1 |  |
