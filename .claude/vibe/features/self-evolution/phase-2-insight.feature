# Feature: self-evolution — Phase 2: Insight Extraction

**SPEC**: `.claude/vibe/specs/self-evolution/phase-2-insight.md`
**Master Feature**: `.claude/vibe/features/self-evolution/_index.feature`

## User Story (Phase Scope)
**As a** vibe 사용자
**I want** 축적된 관찰/성찰에서 자동으로 패턴과 부족한 점이 추출되길
**So that** 반복되는 문제나 빈번한 요청 패턴이 자동으로 식별됨

## Scenarios

### Scenario 1: Reflection에서 패턴 추출
```gherkin
Scenario: 3회 이상 반복된 관찰에서 insight 생성
  Given reflections에 "TypeScript any 타입 사용" 관련 observation이 3건 이상이고
  When InsightExtractor.extractFromRecent()가 실행되면
  Then insights 테이블에 type='anti_pattern' 레코드가 생성되고
  And confidence가 0.6 이상이고
  And evidence에 출처 reflection IDs가 포함됨
```
**Verification**: SPEC AC #2

### Scenario 2: Skill Gap 탐지
```gherkin
Scenario: 매칭 실패 패턴에서 skill gap 탐지
  Given prompt-dispatcher에서 "CSV 분석" 관련 매칭 실패가 3회 이상이고
  When SkillGapDetector가 gap을 분석하면
  Then insights 테이블에 type='skill_gap' 레코드가 생성되고
  And title에 "CSV 분석 관련 skill 부재"가 포함됨
```
**Verification**: SPEC AC #3

### Scenario 3: Agent 성능 분석
```gherkin
Scenario: 실패율 높은 에이전트 탐지
  Given AgentRegistry에서 "explorer-low" 에이전트 실패율이 35%이고
  When AgentAnalyzer가 분석을 실행하면
  Then insights 테이블에 type='optimization' 레코드가 생성됨
```
**Verification**: SPEC AC #4

### Scenario 4: 중복 Insight 병합
```gherkin
Scenario: 동일 주제 insight가 occurrences로 병합
  Given insights에 "console.log 제거 필요" insight가 이미 존재하고 (occurrences=2)
  When 동일한 패턴이 다시 추출되면
  Then 새 레코드가 생성되지 않고
  And 기존 insight의 occurrences가 3으로 증가함
```
**Verification**: SPEC AC #5

### Scenario 5: 저신뢰 Insight 자동 정리
```gherkin
Scenario: confidence 0.3 미만 insight 7일 후 삭제
  Given insight가 confidence=0.2로 7일 전에 생성되었고
  When lifecycle 정리가 실행되면
  Then 해당 insight가 삭제됨
```
**Verification**: SPEC AC #6

### Scenario 6: Insights 테이블 생성
```gherkin
Scenario: 기존 memories.db에 insights 테이블 추가
  Given memories.db가 존재할 때
  When InsightStore가 초기화되면
  Then insights 테이블과 insights_fts 테이블이 생성됨
  And 기존 memories/reflections 테이블에 영향 없음
```
**Verification**: SPEC AC #1

### Scenario 7: 데이터 형식 불일치 시 graceful skip
```gherkin
Scenario: 잘못된 형식의 observation은 skip하고 나머지 처리
  Given 50개 reflections 중 3개가 잘못된 JSON 형식이고
  When InsightExtractor.extractFromRecent()가 실행되면
  Then 잘못된 3개는 skip되고 에러 로그에 기록되고
  And 나머지 47개에서 정상적으로 패턴이 추출됨
```
**Verification**: SPEC Constraints — Error Handling

### Scenario 8: core_extract_insights 도구 동작
```gherkin
Scenario: 수동 insight 추출 트리거
  Given reflections와 observations에 데이터가 축적되어 있을 때
  When 사용자가 core_extract_insights 도구를 호출하면
  Then 배치 추출이 실행되고 발견된 insights 목록이 반환됨
  And 전체 추출 사이클이 1초 이내에 완료됨
```
**Verification**: SPEC AC #7 + Performance Targets

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-2 (pattern extraction) | ✅ |
| 2 | AC-3 (skill gap) | ✅ |
| 3 | AC-4 (agent analysis) | ✅ |
| 4 | AC-5 (deduplication) | ✅ |
| 5 | AC-6 (auto cleanup) | ✅ |
| 6 | AC-1 (table creation) | ✅ |
| 7 | Error Handling (graceful skip) | ✅ |
| 8 | AC-7 (tools + performance) | ✅ |
