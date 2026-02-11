---
status: pending
phase: 3
---

# SPEC: self-evolution — Phase 3: Auto Generation

## Persona
<role>
Senior TypeScript engineer building code generation pipelines.
Generate valid skill/agent/rule definitions from structured insights.
Ensure all generated artifacts pass quality gates before activation.
</role>

## Context
<context>
### Background
Phase 2에서 발견된 insights (특히 skill_gap, pattern, optimization)를
실행 가능한 Skill, Agent, Rule로 자동 변환.

### 기존 시스템
- `~/.claude/vibe/skills/`: YAML frontmatter + markdown body
- `~/.claude/agents/`: agent definition .md 파일
- `~/.claude/vibe/rules/`: YAML frontmatter + markdown (impact level)
- `src/lib/SkillQualityGate.ts`: 60점+ 통과 기준

### Research Insights (Security Critical)
- GPT Security: "Generated skills are untrusted input — sanitize before use"
- GPT Security: "Enforce trigger uniqueness + no overlap with existing"
- Gemini Security: "Recursive prompt injection via memory poisoning — allowlist schemas"
- Kimi: "Atomic skill registration — SQLite transaction + ROLLBACK on validation failure"
- Kimi: "Trigger arbitration — (priority, timestamp, hash) tuple ordering"
- Kimi: "Circular trigger chain detection — DAG validation, max depth 10"
</context>

## Task
<task>
### Phase 3-1: Generation Registry
1. [ ] `src/lib/evolution/GenerationRegistry.ts` 생성
   - File: `src/lib/evolution/GenerationRegistry.ts`
   - Schema (memories.db에 추가):
     ```
     generations {
       id TEXT PRIMARY KEY,
       insightId TEXT REFERENCES insights(id),
       type TEXT ('skill' | 'agent' | 'rule'),
       name TEXT NOT NULL,
       content TEXT NOT NULL (생성된 markdown 전문),
       filePath TEXT (저장된 파일 경로),
       status TEXT ('draft' | 'testing' | 'active' | 'disabled' | 'deleted'),
       qualityScore INTEGER (0-100),
       triggerPatterns JSON,
       usageCount INTEGER DEFAULT 0,
       lastUsedAt TEXT,
       ttlDays INTEGER DEFAULT 7,
       version INTEGER DEFAULT 1,
       parentId TEXT (이전 버전 ID, nullable),
       createdAt TEXT,
       updatedAt TEXT
     }
     ```

### Phase 3-2: Skill Generator
2. [ ] `src/lib/evolution/generators/SkillGenerator.ts` 생성
   - File: `src/lib/evolution/generators/SkillGenerator.ts`
   - 입력: Insight (type: 'skill_gap' | 'pattern')
   - 출력: SKILL.md 파일 (frontmatter + body)
   - 생성 프로세스:
     1. Insight의 description, evidence, tags 분석
     2. 기존 skill 목록 로드 → trigger 충돌 검사
     3. Skill markdown 템플릿 생성:
        ```yaml
        ---
        name: auto-{insight-based-name}
        model: sonnet
        triggers: [{extracted-patterns}]
        generated: true
        insightId: {source-insight-id}
        version: 1
        ---
        # {Skill Title}
        {Generated instructions based on insight}
        ```
     4. SkillQualityGate 검증 (60점+)
     5. Trigger 충돌 검사 (기존 skills 전체 스캔)
     6. 통과 시 → GenerationRegistry에 저장
   - 저장 경로: `~/.claude/vibe/skills/auto/{name}.md`

### Phase 3-3: Agent Generator
3. [ ] `src/lib/evolution/generators/AgentGenerator.ts` 생성
   - File: `src/lib/evolution/generators/AgentGenerator.ts`
   - 입력: Insight (type: 'skill_gap' with agent-level complexity)
   - 출력: Agent .md 파일
   - Agent는 skill보다 복잡한 경우에만 생성 (evidence 개수 5+ AND description 500+ chars)
   - 생성된 agent markdown:
     ```markdown
     # {Agent Name}
     {Description}
     ## Capabilities
     {Generated from insight}
     ## Tools
     {Inferred tool requirements}
     ```
   - 저장 경로: `~/.claude/agents/auto/{name}.md`

### Phase 3-4: Rule Generator
4. [ ] `src/lib/evolution/generators/RuleGenerator.ts` 생성
   - File: `src/lib/evolution/generators/RuleGenerator.ts`
   - 입력: Insight (type: 'anti_pattern' | 'pattern')
   - 출력: Rule .md 파일 (impact level 포함)
   - 생성된 rule markdown:
     ```yaml
     ---
     title: {Rule Title}
     impact: MEDIUM
     tags: [auto-generated, {tags}]
     generated: true
     insightId: {source-insight-id}
     ---
     ## {Rule Title}
     {Description}
     **Incorrect:**
     ```typescript
     {Anti-pattern code from insight}
     ```
     **Correct:**
     ```typescript
     {Recommended pattern from insight}
     ```
     ```
   - 저장 경로: `~/.claude/vibe/rules/auto/{name}.md`

### Phase 3-5: Trigger Collision Detector
5. [ ] `src/lib/evolution/TriggerCollisionDetector.ts` 생성
   - File: `src/lib/evolution/TriggerCollisionDetector.ts`
   - Methods:
     - `checkCollision(newTriggers: string[], existingSkills: Skill[]): CollisionResult`
     - `detectCircularChain(triggerGraph: TriggerGraph): CircularChain[]`
   - **TriggerGraph 모델**:
     - 노드: 각 skill (generationId로 식별)
     - 엣지: skill A의 output에 skill B의 trigger가 포함되면 A→B 엣지
     - 구축: 모든 active/testing skill의 `triggerPatterns`을 스캔하여 다른 skill의 name/trigger와 리터럴 매칭
     - 예: skill-A의 body에 "deploy"가 포함되고, skill-B의 trigger가 "deploy"이면 A→B 엣지
   - 충돌 유형:
     - exact: 동일 trigger 문자열 (소문자 정규화 후 비교) → 거부
     - prefix: 기존 trigger의 prefix와 일치 → 경고 (suggest 모드에서 사용자 확인)
     - circular: A→B→A 순환 → 거부 (DFS + visited set, 최대 depth 10)
   - Trigger 패턴은 리터럴 문자열 매칭만 지원 (정규식 미지원 — ReDoS 방지)

### Phase 3-6: Generation Orchestrator
6. [ ] `src/lib/evolution/EvolutionOrchestrator.ts` 생성
   - File: `src/lib/evolution/EvolutionOrchestrator.ts`
   - 전체 생성 흐름 관리:
     1. `InsightStore.getActionable()` — status='confirmed', type in (skill_gap, pattern, anti_pattern)
     2. Insight type별 적합한 generator 선택
     3. 생성 실행 (SQLite transaction)
     4. 검증 (Quality Gate + Trigger Collision)
     5. 모드별 처리:
        - suggest: draft 상태로 저장, 사용자에게 알림
        - auto: testing → active 자동 승격
     6. 결과 로깅
   - Config 기반 모드 선택: `config.json > evolution.mode`
</task>

## Constraints
<constraints>
- 생성된 파일은 반드시 `auto/` 서브디렉토리에만 저장 (기존 파일 오염 방지)
- frontmatter에 `generated: true`, `insightId` 필수 (추적성)
- Skill Quality Gate 60점 미만 → 거부 (재시도 없음)
- Trigger collision exact match → 무조건 거부
- 한 번의 orchestration cycle에서 최대 5개 생성물 (과부하 방지)
- auto/ 디렉토리가 없으면 자동 생성
- auto/ 디렉토리에 최대 50개 파일 제한 (초과 시 가장 오래된 disabled 먼저 삭제)
- 생성 실패 시 SQLite ROLLBACK (원자성 보장)
- **DB+파일시스템 원자성**: 파일은 임시 경로(`auto/.tmp-{name}.md`)에 먼저 쓰고, DB 커밋 성공 후 최종 경로로 `rename()`. DB 롤백 시 임시 파일 삭제. 프로세스 시작 시 `.tmp-*` 잔여 파일 정리

### Security — Path Traversal Prevention

- 생성 파일명은 `/^[a-z0-9-]+\.md$/` 패턴만 허용 (특수문자, `..`, `/` 차단)
- 실제 저장 전 `path.resolve()` 결과가 auto/ 디렉토리 내인지 검증
- 위반 시: 생성 거부 + 보안 경고 로그
- **Insight 경유 프롬프트 인젝션 방지**: 생성 템플릿에 삽입되는 title/description/tags는 허용 문자셋(`[a-zA-Z0-9가-힣 _.,-]`)으로 sanitize. 제어 문자, markdown 지시문(`<role>`, `<task>` 등), 시스템 프롬프트 패턴 차단

### Performance Targets

- SkillGenerator: < 100ms (템플릿 기반, LLM 미사용)
- AgentGenerator: < 100ms
- RuleGenerator: < 100ms
- TriggerCollisionDetector: < 200ms (전체 skill 스캔)
- 전체 orchestration cycle: < 2초 (최대 5개 생성물)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/evolution/GenerationRegistry.ts`
- `src/lib/evolution/generators/SkillGenerator.ts`
- `src/lib/evolution/generators/AgentGenerator.ts`
- `src/lib/evolution/generators/RuleGenerator.ts`
- `src/lib/evolution/TriggerCollisionDetector.ts`
- `src/lib/evolution/EvolutionOrchestrator.ts`
- `src/lib/evolution/__tests__/generation.test.ts`

### Files to Modify
- `src/lib/memory/MemoryStorage.ts` (generations 테이블 추가)
- `.claude/vibe/config.json` (evolution 설정 키 추가)

### Verification Commands
- `vitest run src/lib/evolution/__tests__/generation.test.ts`
- `npx tsc --noEmit`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] SkillGenerator가 insight에서 유효한 SKILL.md를 생성함
- [ ] AgentGenerator가 복잡한 insight에서 agent .md를 생성함
- [ ] RuleGenerator가 anti_pattern insight에서 rule .md를 생성함
- [ ] TriggerCollisionDetector가 exact/partial/circular 충돌을 탐지함
- [ ] 생성된 skill이 SkillQualityGate 60점+를 통과함
- [ ] suggest 모드: draft 상태로 저장됨
- [ ] auto 모드: testing → active로 자동 승격됨
- [ ] 생성 실패 시 SQLite ROLLBACK으로 원자성 보장됨
- [ ] auto/ 서브디렉토리에만 파일이 저장됨
- [ ] 모든 테스트 통과, 빌드 성공
</acceptance>
