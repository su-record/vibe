---
status: pending
phase: 2
---

# SPEC: self-evolution — Phase 2: Insight Extraction

## Persona
<role>
Senior TypeScript engineer building ML-adjacent data pipelines.
Extract actionable patterns from accumulated observations and reflections.
</role>

## Context
<context>
### Background
Phase 1에서 축적된 reflections + 기존 observations에서 패턴/인사이트를 자동 추출.
OpenClaw의 Retain/Recall/Reflect 루프에서 영감.

### 기존 시스템
- `src/lib/memory/ObservationStore.ts`: decision/bugfix/feature/refactor/discovery 타입
- Phase 1의 `ReflectionStore.ts`: minor/major reflections
- `src/lib/memory/KnowledgeGraph.ts`: 메모리 관계 그래프

### Research Insights
- GPT: "Episodic-to-Semantic Promotion — 에피소딕 로그에서 일반화 가능한 사실 추출"
- GPT: "Consolidation jobs: summarize, cluster, extract schemas/skills from observation batches"
- Gemini: "Token-Budgeted Triggering — 토큰 기반 동적 임계값"
- Kimi: "Semantic deduplication — AST hash + embedding cosine + I/O signature"
</context>

## Task
<task>
### Phase 2-1: Insight 데이터 모델
1. [ ] `src/lib/evolution/InsightStore.ts` 생성
   - File: `src/lib/evolution/InsightStore.ts`
   - Schema (기존 memories.db에 추가):
     ```
     insights {
       id TEXT PRIMARY KEY,
       type TEXT ('pattern' | 'anti_pattern' | 'preference' | 'skill_gap' | 'optimization'),
       title TEXT NOT NULL,
       description TEXT NOT NULL,
       evidence JSON (출처 reflections/observations IDs),
       confidence REAL (0-1, 증거 기반 신뢰도),
       occurrences INTEGER DEFAULT 1,
       tags JSON,
       status TEXT ('draft' | 'confirmed' | 'applied' | 'deprecated'),
       generatedFrom TEXT ('reflection' | 'observation' | 'agent_stats' | 'manual'),
       appliedAs TEXT (생성된 skill/agent/rule ID, nullable),
       createdAt TEXT,
       updatedAt TEXT
     }
     ```
   - FTS5: `insights_fts` (title, description, tags 검색)

### Phase 2-2: Insight Extraction Engine
2. [ ] `src/lib/evolution/InsightExtractor.ts` 생성
   - File: `src/lib/evolution/InsightExtractor.ts`
   - 입력: reflections + observations 배치
   - 처리:
     1. 최근 N개 reflections/observations 수집 (기본 50개)
     2. 클러스터링: 유사 주제 그룹화 (FTS5 overlap 기반)
     3. 패턴 추출: 3회+ 반복 관찰 → insight 후보
     4. 중복 검사: 기존 insights와 title/description 유사도 비교
     5. 신뢰도 계산: `confidence = min(1.0, occurrences * 0.2 + evidence_count * 0.1)`
     6. 저장: InsightStore.save()
   - LLM 미사용 (순수 텍스트 분석 + FTS5 매칭)
   - 대안: config에서 `evolution.useLLMInsight: true` 설정 시 LLM 분석 활성화

### Phase 2-3: Skill Gap Detection
3. [ ] `src/lib/evolution/SkillGapDetector.ts` 생성
   - File: `src/lib/evolution/SkillGapDetector.ts`
   - Gap 로그 저장소 (memories.db에 추가):
     ```
     skill_gaps {
       id TEXT PRIMARY KEY,
       prompt TEXT NOT NULL (매칭 실패한 사용자 프롬프트, 200자 truncate),
       normalizedPrompt TEXT (소문자 + 공백 정규화, 클러스터링용),
       sessionId TEXT,
       createdAt TEXT
     }
     ```
   - `logMiss(prompt, timestamp)`: prompt-dispatcher에서 호출, skill_gaps 테이블에 INSERT
   - 입력: skill_gaps 테이블 (prompt-dispatcher에서 적재)
   - 처리:
     1. 매칭 실패한 사용자 요청 수집 (skill_gaps 테이블 조회)
     2. normalizedPrompt 기준 유사 요청 클러스터링 (GROUP BY + COUNT)
     3. 3회+ 동일 유형 실패 → `type: 'skill_gap'` insight 생성
     4. 기존 skill 목록과 대조하여 실제 gap인지 검증
   - `prompt-dispatcher.js`에 매칭 실패 로깅 추가 필요 (Phase 5-2에서 연동)

### Phase 2-4: Agent Performance Analysis
4. [ ] `src/lib/evolution/AgentAnalyzer.ts` 생성
   - File: `src/lib/evolution/AgentAnalyzer.ts`
   - 입력: AgentRegistry의 agent_executions 테이블
   - 분석:
     - 실패율 > 30% 에이전트 → `type: 'optimization'` insight
     - 평균 실행시간 > 60초 에이전트 → `type: 'optimization'` insight
     - 특정 패턴의 반복 실패 → `type: 'anti_pattern'` insight

### Phase 2-5: Insight Tools
5. [ ] `src/tools/evolution/insightTools.ts` 생성
   - File: `src/tools/evolution/insightTools.ts`
   - Tools:
     - `core_extract_insights`: 수동 insight 추출 트리거
     - `core_search_insights`: insight 검색
     - `core_list_skill_gaps`: 현재 발견된 skill gaps
     - `core_insight_stats`: 통계 (타입별 개수, 상태별 개수)
</task>

## Constraints
<constraints>
- LLM 호출 없이 순수 텍스트 분석이 기본 (config로 LLM 옵션 제공)
- 기존 AgentRegistry 스키마 변경 없음 (읽기만)
- Insight 중복 검사: FTS5 rank 함수로 검색 후, 상위 1개 결과가 존재하면 중복으로 판정하여 occurrences+1
- 배치 처리: 한 번에 최대 100개 observation/reflection 처리
- confidence가 0.3 미만인 insight는 자동 삭제 (7일 후)

### Error Handling

- reflection/observation 데이터 형식 불일치 시: skip + 에러 로그 (배치 전체 실패 방지)
- AgentRegistry 조회 실패 시: agent 분석 단계만 skip, 나머지 insight 추출 계속
- skill_gaps 테이블 조회 실패 (테이블 미존재 등): skill gap detection skip + 경고 로그
- FTS5 중복 검사 실패 시: 새 레코드로 저장 (중복 허용, 이후 정리 가능)

### Performance Targets

- InsightExtractor.extractFromRecent(50): < 200ms
- SkillGapDetector 분석: < 300ms (최대 100개 gap log)
- AgentAnalyzer 분석: < 200ms
- 전체 insight 추출 사이클: < 1초
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/evolution/InsightStore.ts`
- `src/lib/evolution/InsightExtractor.ts`
- `src/lib/evolution/SkillGapDetector.ts`
- `src/lib/evolution/AgentAnalyzer.ts`
- `src/lib/evolution/__tests__/insight.test.ts`
- `src/tools/evolution/insightTools.ts`

### Files to Modify
- `src/lib/memory/MemoryStorage.ts` (insights 테이블 추가)
- `hooks/scripts/prompt-dispatcher.js` (매칭 실패 로깅)
- `src/tools/index.ts` (evolution tools export)

### Verification Commands
- `vitest run src/lib/evolution/__tests__/insight.test.ts`
- `npx tsc --noEmit`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] insights 테이블이 memories.db에 생성됨
- [ ] InsightExtractor가 reflections에서 패턴을 추출함
- [ ] SkillGapDetector가 매칭 실패에서 gap을 탐지함
- [ ] AgentAnalyzer가 실패 패턴을 분석함
- [ ] 중복 insight가 occurrences 증가로 병합됨
- [ ] confidence < 0.3 insight는 7일 후 정리됨
- [ ] core_extract_insights 도구가 작동함
- [ ] 모든 테스트 통과, 빌드 성공
</acceptance>
