---
status: pending
phase: 4
---

# SPEC: agent-autonomy — Phase 4: Proactive Intelligence

## Persona
<role>
Senior TypeScript engineer specializing in proactive monitoring and suggestion systems.
Implement background analysis engine that identifies improvement opportunities.
Follow existing vibe patterns: hooks, memory, evolution integration.
</role>

## Context
<context>
### Background
사용자가 요청하기 전에 vibe가 먼저 개선점을 발견하고 제안하는 프로액티브 지능 시스템.
파일 변경 감시, 빌드 상태 모니터링, 의존성 업데이트 감지 등을 수행.
Self-evolution의 InsightExtractor와 연계하여 패턴 기반 제안도 생성.

### 기존 시스템
- `src/lib/evolution/InsightExtractor.ts`: 패턴 추출 엔진
- `src/lib/evolution/SkillGapDetector.ts`: 스킬 갭 탐지
- `hooks/scripts/post-edit.js`: 파일 편집 후 hook
- `hooks/scripts/code-check.js`: 코드 품질 체크
- Phase 1-3: EventBus, AuditStore, SecuritySentinel, ConfirmationManager

### Research Insights
- GPT: "Continuous monitoring with anomaly detection on action frequency"
- Gemini: "Circuit Breaker for Hallucinations — suspend on repetitive loops"
- Kimi: "Async Rule Evaluation — defer non-critical to background workers"
- Kimi: "Stream Processing — debouncing for high-frequency agent actions"
</context>

## Task
<task>
### Phase 4-1: SuggestionStore 구현
1. [ ] `src/lib/autonomy/SuggestionStore.ts` 생성
   - File: `src/lib/autonomy/SuggestionStore.ts`
   - `suggestions` 테이블:
     ```sql
     suggestions {
       id TEXT PRIMARY KEY (UUIDv7),
       type TEXT NOT NULL ('security' | 'performance' | 'quality' | 'dependency' | 'pattern'),
       title TEXT NOT NULL,
       description TEXT NOT NULL,
       priority INTEGER NOT NULL (1-5, 1=highest),
       evidence JSON NOT NULL,
       suggestedAction TEXT,
       status TEXT DEFAULT 'pending' ('pending' | 'accepted' | 'dismissed' | 'auto_applied'),
       riskLevel TEXT DEFAULT 'LOW',
       sourceModule TEXT NOT NULL,
       createdAt TEXT NOT NULL,
       resolvedAt TEXT
     }
     ```
   - FTS5: `suggestions_fts` (title, description 검색)
   - 인덱스: `(status, priority)`, `(type, createdAt)`
   - `create(suggestion)`: 새 제안 생성 + 중복 검사 (title 대소문자 무시 + 공백 정규화 후 exact match AND type 동일 AND 생성 후 24시간 이내)
   - `resolve(id, status)`: 제안 해결
   - `getPending(limit?)`: 우선순위순 미처리 제안
   - `getStats()`: 타입별/상태별 통계
   - Verify: CRUD + 중복 검사 + 통계 테스트

### Phase 4-2: ProactiveAnalyzer 구현
2. [ ] `src/lib/autonomy/ProactiveAnalyzer.ts` 생성
   - File: `src/lib/autonomy/ProactiveAnalyzer.ts`
   - 분석 모듈 4개:
     | 모듈 | 감지 대상 | 제안 타입 |
     |------|----------|----------|
     | SecurityScanner | OWASP Top 10 중 3개 (v1.0 스코프: hardcoded secrets 정규식 매칭, 동적 SQL 구성 패턴, innerHTML/dangerouslySetInnerHTML XSS 패턴) | security |
     | PerformanceDetector | N+1 쿼리, 미사용 import, 큰 번들 | performance |
     | QualityChecker | 복잡도 초과, 테스트 누락, TODO 방치 | quality |
     | DependencyMonitor | 취약 패키지, major 업데이트, deprecated | dependency |
   - 각 모듈은 `AnalysisModule` 인터페이스 구현:
     ```typescript
     interface AnalysisModule {
       name: string;
       analyze(context: AnalysisContext): Promise<Suggestion[]>;
       shouldRun(trigger: AnalysisTrigger): boolean;
     }
     ```
   - AnalysisTrigger: `file_changed` | `session_start` | `build_complete` | `scheduled` | `manual`
   - 분석 결과 → SuggestionStore에 저장 + EventBus에 suggestion_created 이벤트
   - 디바운싱: 파일 경로 단위로 500ms 내 중복 분석 방지 (동일 파일 경로 기준, 다른 파일은 독립 디바운싱)
   - Verify: 각 모듈 분석 + 디바운싱 테스트

### Phase 4-3: BackgroundMonitor 구현
3. [ ] `src/lib/autonomy/BackgroundMonitor.ts` 생성
   - File: `src/lib/autonomy/BackgroundMonitor.ts`
   - 모니터링 스케줄:
     | 모니터 | 트리거 | 주기 |
     |--------|--------|------|
     | SecurityScanner | file_changed (*.ts, *.js) | 파일 변경 시 (디바운스 500ms) |
     | PerformanceDetector | session_start | 세션 시작 시 1회 |
     | QualityChecker | file_changed + build_complete | 파일 변경 + 빌드 후 |
     | DependencyMonitor | scheduled | 24시간마다 1회 |
   - `start()`: 모니터링 시작 (EventBus 구독)
   - `stop()`: 모니터링 중지
   - `runAll()`: 모든 모듈 수동 실행
   - `getStatus()`: 각 모듈 상태 + 마지막 실행 시간
   - 리소스 제한: 동시 분석 최대 2개, 분석당 최대 5초
   - Verify: 시작/중지 + 스케줄 + 리소스 제한 테스트

### Phase 4-4: Evolution 연계
4. [ ] Self-Evolution InsightExtractor 연계
   - File: `src/lib/autonomy/ProactiveAnalyzer.ts` (수정)
   - PatternModule: InsightExtractor 결과를 Suggestion으로 변환
     - `type='anti_pattern'` insight → quality suggestion
     - `type='skill_gap'` insight → pattern suggestion
     - `type='optimization'` insight → performance suggestion
   - 변환 시 evidence에 insight ID 포함
   - Verify: insight → suggestion 변환 테스트

### Phase 4-5: 세션 통합
5. [ ] 세션 시작 시 제안 표시
   - File: `hooks/scripts/session-start.js` (수정)
   - 세션 시작 시 pending 제안 요약:
     ```
     💡 Proactive Suggestions: 3 pending
       🔴 [Security] Hardcoded API key in config.ts
       🟡 [Quality] Function complexity exceeds limit in parser.ts
       🔵 [Dependency] 2 packages have available updates
     ```
   - priority 1-2만 세션 시작 시 표시 (나머지는 `vibe suggestions` CLI로 확인)
   - Verify: 세션 시작 출력 테스트

### Phase 4-6: MCP 도구 + 테스트
6. [ ] `core_proactive_suggestions` 도구
   - File: `src/tools/autonomy/proactiveSuggestions.ts`
   - 입력: `{ action?: 'list' | 'accept' | 'dismiss' | 'run', id?: string }`
   - list: 미처리 제안 목록
   - accept: 제안 수락 (auto_applied 처리 가능 시 자동 적용)
   - dismiss: 제안 무시
   - run: 수동 분석 실행
   - Verify: 도구 호출 테스트

7. [ ] 테스트
   - File: `src/lib/autonomy/__tests__/proactive.test.ts`
   - SuggestionStore: CRUD + 중복 + 통계
   - ProactiveAnalyzer: 4개 모듈 분석 + 디바운싱
   - BackgroundMonitor: 시작/중지 + 스케줄
   - Evolution 연계: insight → suggestion 변환
   - Verify: `vitest run src/lib/autonomy/__tests__/proactive.test.ts`
</task>

## Constraints
<constraints>
- 백그라운드 분석은 세션 성능에 영향 없어야 함 (Node.js `perf_hooks`로 측정, 메인 스레드 블로킹 5ms 이하)
- 동시 분석 최대 2개 (메인 스레드 CPU 50% 이하 유지 목표)
- 분석당 최대 5초 타임아웃 (초과 시 AbortController로 중단)
- 디바운싱: 파일 경로 단위로 500ms 이내 중복 트리거 무시
- 제안 최대 저장: 1000개 (초과 시 삭제 우선순위: dismissed → auto_applied → accepted, oldest 기준)
- dependency 모니터는 네트워크 실패 시 graceful skip + 실패 카운트 기록, 다음 스케줄(24시간 후)에서 자동 재시도
- config.json `autonomy.proactive.enabled`로 비활성화 가능
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/autonomy/SuggestionStore.ts`
- `src/lib/autonomy/ProactiveAnalyzer.ts`
- `src/lib/autonomy/BackgroundMonitor.ts`
- `src/tools/autonomy/proactiveSuggestions.ts`
- `src/lib/autonomy/__tests__/proactive.test.ts`

### Files to Modify
- `src/lib/memory/MemoryStorage.ts` (suggestions 테이블 추가)
- `src/lib/autonomy/index.ts` (Phase 4 exports 추가)
- `hooks/scripts/session-start.js` (제안 요약 표시)
- `src/tools/index.ts` (proactiveSuggestions 도구 export)

### Verification Commands
- `vitest run src/lib/autonomy/__tests__/proactive.test.ts`
- `npx tsc --noEmit`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: SuggestionStore가 5개 타입의 제안을 CRUD하고 중복 검사
- [ ] AC-2: ProactiveAnalyzer 4개 모듈(Security/Performance/Quality/Dependency)이 정상 분석
- [ ] AC-3: BackgroundMonitor가 스케줄에 따라 자동 분석 실행
- [ ] AC-4: 디바운싱(500ms)으로 중복 분석 방지
- [ ] AC-5: 세션 시작 시 priority 1-2 제안이 요약 표시됨
- [ ] AC-6: self-evolution insight가 suggestion으로 변환됨
- [ ] AC-7: core_proactive_suggestions 도구가 list/accept/dismiss/run 동작
- [ ] AC-8: 동시 분석 2개 제한 + 5초 타임아웃 준수
- [ ] AC-9: 모든 테스트 통과 + TypeScript 빌드 성공
</acceptance>
