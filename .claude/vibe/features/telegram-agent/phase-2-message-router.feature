# Feature: telegram-agent - Phase 2: 의도 분류 + 라우팅 엔진

**SPEC**: `.claude/vibe/specs/telegram-agent/phase-2-message-router.md`
**Master Feature**: `.claude/vibe/features/telegram-agent/_index.feature`

## User Story (Phase Scope)
**As a** 텔레그램 봇 시스템
**I want** 사용자 메시지의 의도를 분류하여 최적의 처리 경로로 라우팅하고
**So that** 빠른 응답은 즉시, 복잡한 분석은 멀티 LLM, 개발 작업은 비동기로 효율적으로 처리할 수 있다

## Scenarios

### Scenario 1: 메모 의도 분류
```gherkin
Scenario: "메모해" 키워드로 memory/save 분류
  Given 사용자가 "내일 회의 메모해"라고 메시지를 보냄
  When classifyIntent()를 호출하면
  Then intent.type이 "memory"임
  And intent.action이 "save"임
```
**Verification**: SPEC AC #1

### Scenario 2: 개발 작업 + workspace 추출
```gherkin
Scenario: workspace 포함 개발 요청 분류
  Given 사용자가 "~/workspace/app에서 로그인 만들어"라고 메시지를 보냄
  When classifyIntent()를 호출하면
  Then intent.type이 "dev-task"임
  And intent.workspace가 홈디렉토리 + "/workspace/app"임
  And intent.task가 "로그인 만들어"를 포함함
```
**Verification**: SPEC AC #2

### Scenario 3: 멀티 LLM 분석 분류
```gherkin
Scenario: "분석해줘" 키워드로 multi-llm/analysis 분류
  Given 사용자가 "이 코드 분석해줘"라고 메시지를 보냄
  When classifyIntent()를 호출하면
  Then intent.type이 "multi-llm"임
  And intent.category가 "analysis"임
```
**Verification**: SPEC AC #3

### Scenario 4: 시스템 모니터링 분류
```gherkin
Scenario: "디스크 사용량" 키워드로 local/system 분류
  Given 사용자가 "디스크 사용량 확인해줘"라고 메시지를 보냄
  When classifyIntent()를 호출하면
  Then intent.type이 "local"임
  And intent.category가 "system"임
```
**Verification**: SPEC AC #4

### Scenario 5: SmartRouter 경유 응답
```gherkin
Scenario: quick 의도에서 SmartRouter 호출
  Given intent가 { type: 'quick', category: 'general' }로 분류됨
  When MessageRouter.route()를 호출하면
  Then SmartRouter.route()가 호출됨
  And 결과에 provider 정보가 포함됨
  And RouteResult.response에 LLM 응답이 포함됨
```
**Verification**: SPEC AC #5

### Scenario 6: LLMCluster 병렬 실행
```gherkin
Scenario: multi-llm 의도에서 3개 LLM 병렬 쿼리
  Given intent가 { type: 'multi-llm', category: 'analysis' }로 분류됨
  When MessageRouter.route()를 호출하면
  Then LLMCluster.multiQuery()가 호출됨
  And GPT, Gemini, NVIDIA 3개 LLM에 병렬 쿼리됨
  And 3개 결과가 종합된 응답이 반환됨
```
**Verification**: SPEC AC #6

### Scenario 7: BackgroundManager 비동기 실행
```gherkin
Scenario: dev-task 의도에서 비동기 작업 시작
  Given intent가 { type: 'dev-task', workspace: '/home/user/app', task: '로그인 구현' }임
  When MessageRouter.route()를 호출하면
  Then BackgroundManager.launch()가 호출됨
  And RouteResult.async가 true임
  And RouteResult.taskId가 반환됨
  And RouteResult.response가 "작업 시작됨" 메시지임
```
**Verification**: SPEC AC #7

### Scenario 8: MemoryManager 저장
```gherkin
Scenario: memory/save 의도에서 MemoryManager 호출
  Given intent가 { type: 'memory', action: 'save' }로 분류됨
  When MessageRouter.route()를 호출하면
  Then MemoryManager.save()가 호출됨
  And 저장 확인 메시지가 반환됨
```
**Verification**: SPEC AC #8

### Scenario 9: 분류 실패 폴백
```gherkin
Scenario: 의도 분류 실패 시 quick/general로 폴백
  Given 사용자가 모호한 메시지 "ㅋㅋㅋ"를 보냄
  When classifyIntent()를 호출하면
  Then intent.type이 "quick"임
  And intent.category가 "general"임
```
**Verification**: SPEC AC #9

### Scenario 10: Path traversal 차단
```gherkin
Scenario: workspace에 path traversal 시도 시 거부
  Given 사용자가 "../../etc/passwd에서 작업해줘"라고 메시지를 보냄
  When extractWorkspace()를 호출하면
  Then 기본 workspace가 반환됨
  And traversal 경로는 사용되지 않음
```
**Verification**: SPEC AC #10

### Scenario 11: 빌드 성공
```gherkin
Scenario: TypeScript 빌드 성공
  When npm run build를 실행하면
  Then 빌드 에러 없이 완료됨
  And dist/bridge/message-router.js가 생성됨
```
**Verification**: SPEC AC #11

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (메모 분류) | ⬜ |
| 2 | AC-2 (dev-task + workspace) | ⬜ |
| 3 | AC-3 (multi-llm 분류) | ⬜ |
| 4 | AC-4 (local/system 분류) | ⬜ |
| 5 | AC-5 (SmartRouter 호출) | ⬜ |
| 6 | AC-6 (LLMCluster 병렬) | ⬜ |
| 7 | AC-7 (BackgroundManager 비동기) | ⬜ |
| 8 | AC-8 (MemoryManager 저장) | ⬜ |
| 9 | AC-9 (분류 실패 폴백) | ⬜ |
| 10 | AC-10 (path traversal) | ⬜ |
| 11 | AC-11 (빌드) | ⬜ |
