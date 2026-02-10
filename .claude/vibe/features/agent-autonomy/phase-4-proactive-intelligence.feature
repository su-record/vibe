# Feature: agent-autonomy — Phase 4: Proactive Intelligence

**SPEC**: `.claude/vibe/specs/agent-autonomy/phase-4-proactive-intelligence.md`
**Master Feature**: `.claude/vibe/features/agent-autonomy/_index.feature`

## User Story (Phase Scope)
**As a** vibe 사용자
**I want** vibe가 보안 취약점, 성능 문제, 코드 품질, 의존성 업데이트를 사전에 감지하고 제안하길
**So that** 요청 전에 문제를 인지하고 빠르게 대응할 수 있음

## Scenarios

### Scenario 1: 제안 생성 + 중복 검사
```gherkin
Scenario: 동일 주제 제안이 중복 생성되지 않음
  Given SuggestionStore에 title='Hardcoded API key' 제안이 존재하고
  When 유사한 title의 제안 생성을 시도하면
  Then 새 레코드가 생성되지 않고
  And 기존 제안이 반환됨
```
**Verification**: SPEC AC #1

### Scenario 2: SecurityScanner 분석
```gherkin
Scenario: hardcoded secret 패턴 감지
  Given SecurityScanner 모듈이 활성화되고
  And 파일에 'API_KEY = "sk-abc123"' 패턴이 존재할 때
  When 해당 파일이 변경 트리거되면
  Then type='security' 제안이 생성되고
  And priority가 1(highest)로 설정됨
```
**Verification**: SPEC AC #2

### Scenario 3: BackgroundMonitor 자동 실행
```gherkin
Scenario: 파일 변경 시 SecurityScanner 자동 실행
  Given BackgroundMonitor가 시작되고
  When *.ts 파일 변경 이벤트가 발생하면
  Then SecurityScanner가 500ms 디바운스 후 자동 실행됨
```
**Verification**: SPEC AC #3

### Scenario 4: 디바운싱
```gherkin
Scenario: 500ms 이내 중복 트리거 무시
  Given BackgroundMonitor가 시작되고
  When 100ms 간격으로 동일 파일 변경 이벤트가 5회 발생하면
  Then SecurityScanner가 1회만 실행됨
```
**Verification**: SPEC AC #4

### Scenario 5: 세션 시작 제안 표시
```gherkin
Scenario: 세션 시작 시 priority 1-2 제안 요약
  Given pending 제안 3개 (priority 1 security, priority 2 quality, priority 3 dependency)가 존재하고
  When 새 세션이 시작되면
  Then priority 1-2인 security, quality 제안만 요약 표시됨
```
**Verification**: SPEC AC #5

### Scenario 6: Insight → Suggestion 변환
```gherkin
Scenario: self-evolution anti_pattern insight가 quality suggestion으로 변환
  Given InsightExtractor가 type='anti_pattern' insight를 생성하고
  When ProactiveAnalyzer가 evolution 연계 분석을 실행하면
  Then type='quality' suggestion이 생성되고
  And evidence에 insight ID가 포함됨
```
**Verification**: SPEC AC #6

### Scenario 7: MCP 도구 동작
```gherkin
Scenario: core_proactive_suggestions 도구로 제안 관리
  Given pending 제안 5개가 존재하고
  When core_proactive_suggestions({ action: 'list' })를 호출하면
  Then 5개 제안이 우선순위순으로 반환되고
  And accept/dismiss로 제안 해결 가능
```
**Verification**: SPEC AC #7

### Scenario 8: 동시 분석 제한
```gherkin
Scenario: 동시 분석 2개 제한 초과 시 대기
  Given BackgroundMonitor에서 2개 분석이 실행 중이고
  When 3번째 분석 트리거가 발생하면
  Then 3번째는 기존 분석 완료까지 대기함
```
**Verification**: SPEC AC #8

### Scenario 9: 비활성화 설정
```gherkin
Scenario: autonomy.proactive.enabled=false 시 분석 비활성화
  Given config.json에 autonomy.proactive.enabled=false이고
  When 세션이 시작되면
  Then BackgroundMonitor가 시작되지 않고
  And 프로액티브 분석이 실행되지 않음
```
**Verification**: SPEC AC #9 (비활성화 경로)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (suggestion dedup) | ⬜ |
| 2 | AC-2 (security scanner) | ⬜ |
| 3 | AC-3 (background monitor) | ⬜ |
| 4 | AC-4 (debouncing) | ⬜ |
| 5 | AC-5 (session start display) | ⬜ |
| 6 | AC-6 (insight → suggestion) | ⬜ |
| 7 | AC-7 (MCP tool) | ⬜ |
| 8 | AC-8 (concurrency limit) | ⬜ |
| 9 | AC-9 (disable config) | ⬜ |
