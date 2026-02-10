# Feature: self-evolution — Phase 3: Auto Generation

**SPEC**: `.claude/vibe/specs/self-evolution/phase-3-generation.md`
**Master Feature**: `.claude/vibe/features/self-evolution/_index.feature`

## User Story (Phase Scope)
**As a** vibe 사용자
**I want** 발견된 insight가 자동으로 실행 가능한 skill/agent/rule로 변환되길
**So that** 부족한 능력이 자동으로 보충되고 반복되는 안티패턴이 규칙화됨

## Scenarios

### Scenario 1: Skill 자동 생성
```gherkin
Scenario: skill_gap insight에서 skill 자동 생성
  Given type='skill_gap', status='confirmed' insight "CSV 분석"이 존재하고
  When EvolutionOrchestrator.generate()가 실행되면
  Then ~/.claude/vibe/skills/auto/auto-csv-analyzer.md 파일이 생성되고
  And frontmatter에 generated=true, insightId가 포함되고
  And SkillQualityGate 60점+ 통과됨
```
**Verification**: SPEC AC #1

### Scenario 2: Agent 자동 생성
```gherkin
Scenario: 복잡한 insight에서 agent 자동 생성
  Given type='skill_gap' insight의 evidence 개수가 5개 이상이고 description이 500자 이상일 때
  When AgentGenerator가 실행되면
  Then ~/.claude/agents/auto/{name}.md 파일이 생성됨
```
**Verification**: SPEC AC #2

### Scenario 3: Rule 자동 생성
```gherkin
Scenario: anti_pattern insight에서 rule 자동 생성
  Given type='anti_pattern' insight "console.log 커밋"이 존재하고
  When RuleGenerator가 실행되면
  Then ~/.claude/vibe/rules/auto/{name}.md 파일이 생성되고
  And impact level이 포함됨
```
**Verification**: SPEC AC #3

### Scenario 4: Trigger 충돌 탐지 (exact)
```gherkin
Scenario: 기존 skill과 동일한 trigger 패턴이면 거부
  Given 기존 skill에 trigger="review"가 존재하고
  When 새 skill이 trigger="review"로 생성 시도되면
  Then TriggerCollisionDetector가 exact collision을 감지하고
  And 생성이 거부됨
```
**Verification**: SPEC AC #4

### Scenario 5: Suggest 모드 동작
```gherkin
Scenario: suggest 모드에서 draft 상태로 저장
  Given config.evolution.mode="suggest"이고
  When skill이 생성되면
  Then GenerationRegistry에 status='draft'로 저장되고
  And 파일은 생성되지만 skill-injector에서 활성화되지 않음
```
**Verification**: SPEC AC #5

### Scenario 6: Auto 모드 동작
```gherkin
Scenario: auto 모드에서 자동 활성화
  Given config.evolution.mode="auto"이고
  When skill이 생성되고 Quality Gate를 통과하면
  Then status가 'testing'으로 설정되고
  And skill-injector에서 즉시 활성화됨
```
**Verification**: SPEC AC #6

### Scenario 7: 생성 실패 시 롤백
```gherkin
Scenario: Quality Gate 실패 시 원자적 롤백
  Given skill 생성 중 Quality Gate가 40점을 반환하면
  When 트랜잭션이 롤백되면
  Then GenerationRegistry에 레코드가 생성되지 않고
  And 파일 시스템에 파일이 생성되지 않음
```
**Verification**: SPEC AC #8

### Scenario 8: auto/ 디렉토리에만 저장
```gherkin
Scenario: 생성된 파일은 auto/ 하위에만 저장
  Given skill/agent/rule이 생성될 때
  When 파일이 저장되면
  Then 경로가 반드시 /auto/ 서브디렉토리를 포함함
```
**Verification**: SPEC AC #9

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (skill generation) | ✅ |
| 2 | AC-2 (agent generation) | ✅ |
| 3 | AC-3 (rule generation) | ✅ |
| 4 | AC-4 (trigger collision) | ✅ |
| 5 | AC-5 (suggest mode) | ✅ |
| 6 | AC-6 (auto mode) | ✅ |
| 7 | AC-8 (rollback) | ✅ |
| 8 | AC-9 (auto/ directory) | ✅ |
