---
status: pending
phase: 1
---

# SPEC: self-evolution — Phase 1: Self-Reflection

## Persona
<role>
Senior TypeScript engineer specializing in AI agent memory systems.
Follow existing vibe patterns: SQLite WAL mode, Zod validation, FTS5 search.
Extend existing hooks and MemoryManager without breaking current interfaces.
</role>

## Context
<context>
### Background
세션 중 발생하는 학습/발견/결정이 세션 종료 시 유실됨.
OpenClaw의 Pre-Compaction Memory Flush에서 영감받아, vibe에 자동 성찰 메커니즘을 추가.

### 기존 시스템
- `src/lib/memory/MemoryStorage.ts`: SQLite memories 테이블
- `src/lib/memory/ObservationStore.ts`: 구조화된 관찰 저장 (decision/bugfix/feature/refactor/discovery)
- `src/lib/memory/SessionRAGStore.ts`: Decision/Constraint/Goal/Evidence 4개 엔티티
- `hooks/scripts/context-save.js`: 컨텍스트 70%/80%/90% 시 자동 저장

### Related Code
- `src/lib/MemoryManager.ts`: Memory facade (singleton per project)
- `src/tools/memory/`: 15+ memory tools
- `hooks/scripts/session-start.js`: 세션 시작 hook

### Research Insights
- GPT: "Reflective loop: observe→evaluate→plan→act→audit"
- Gemini: "Transactional Pre-Compaction Flush — 원자적 트랜잭션으로 플러시"
- Gemini: "Session-Scoped Reflection Metadata — 성공/실패 가중치"
- Kimi: "Observation idempotency — UUIDv7 기반 exactly-once"
</context>

## Task
<task>
### Phase 1-1: Reflection 데이터 모델
1. [ ] `src/lib/memory/MemoryStorage.ts`에 `reflections` 테이블 추가
   - File: `src/lib/memory/MemoryStorage.ts`
   - Schema:
     ```
     reflections {
       id TEXT PRIMARY KEY (UUIDv7),
       sessionId TEXT,
       type TEXT ('minor' | 'major'),
       trigger TEXT ('context_pressure' | 'session_end' | 'manual'),
       insights JSON (배운 것들),
       decisions JSON (확정된 결정들),
       patterns JSON (발견된 패턴들),
       filesContext JSON (관련 파일들),
       score REAL (0-1, 중요도),
       createdAt TEXT (ISO8601)
     }
     ```
   - FTS5 테이블: `reflections_fts` (insights, decisions, patterns 검색)
   - Verify: `vitest run src/lib/memory/__tests__/reflection.test.ts`

2. [ ] `src/lib/memory/ReflectionStore.ts` 생성
   - File: `src/lib/memory/ReflectionStore.ts`
   - Methods:
     - `save(reflection: Reflection): void`
     - `search(query: string, limit?: number): Reflection[]`
     - `getBySession(sessionId: string): Reflection[]`
     - `getRecent(limit: number): Reflection[]`
     - `getHighValue(minScore: number): Reflection[]`
   - Zod schema로 입력 검증

### Phase 1-2: Minor Reflection (컨텍스트 70%+)
3. [ ] `hooks/scripts/context-save.js` 확장
   - File: `hooks/scripts/context-save.js`
   - 70% 도달 시 기존 save + **minor reflection** 트리거
   - Debounce: 동일 세션 내 동일 threshold 레벨에서는 1회만 트리거 (lastReflectionLevel 상태 관리)
   - Silent agent turn 방식: 사용자에게 안보이는 내부 처리
   - 수집 대상:
     - 현재 세션의 활성 Goals
     - 최근 Decisions
     - 중요 Constraints
     - 관련 파일 목록 (현재 세션에서 Write/Edit 도구로 수정된 파일)
   - `ReflectionStore.save({ type: 'minor', trigger: 'context_pressure', ... })`

### Phase 1-3: Major Reflection (세션 종료)
4. [ ] `hooks/scripts/session-reflection.js` 생성
   - File: `hooks/scripts/session-reflection.js`
   - Hook event: 기존 context-save.js의 95% 레벨에서 트리거 (별도 hook 불필요)
   - 전체 세션 성찰:
     - 세션에서 완료한 목표 요약
     - 실패한 시도와 원인
     - 발견한 패턴/안티패턴
     - 다음 세션에 필요한 정보
   - `ReflectionStore.save({ type: 'major', trigger: 'session_end', ... })`
   - 결과를 `memory/YYYY-MM-DD.md` 스타일이 아닌 SQLite에 구조화 저장

### Phase 1-4: Reflection Recall
5. [ ] `src/tools/memory/reflectionTools.ts` 생성
   - File: `src/tools/memory/reflectionTools.ts`
   - Tools:
     - `core_reflect_now`: 수동 reflection 트리거
     - `core_search_reflections`: reflection 검색 (FTS5 + score 가중)
     - `core_get_session_reflections`: 특정 세션의 reflections
   - `start_session` 호출 시 최근 high-value reflections 자동 주입

6. [ ] `src/lib/MemoryManager.ts`에 ReflectionStore 통합
   - File: `src/lib/MemoryManager.ts`
   - `getReflectionStore()` 메서드 추가
   - `startSession()`에서 최근 reflections 자동 로드
</task>

## Constraints
<constraints>
- 기존 MemoryStorage 인터페이스 변경 없음 (새 테이블만 추가)
- context-save.js의 기존 동작 유지 (reflection은 추가 동작)
- Reflection 저장은 동기 SQLite (async 불필요 — better-sqlite3)
- minor reflection은 최대 2000자(≈500 토큰, 1 token ≈ 4 chars 근사) 이하로 제한, 초과 시 truncate
- major reflection은 최대 8000자(≈2000 토큰) 이하로 제한, 초과 시 truncate
- UUIDv7 대신 `crypto.randomUUID()` + timestamp prefix 사용 가능 (외부 의존성 없이)
- "Silent agent turn 방식"이란 hook 내부 처리로, 사용자 UI에 표시되지 않는 백그라운드 SQLite 쓰기를 의미 (stdout 출력 없음)

### Error Handling

- SQLite 쓰기 실패 시:
  - 복구 가능 에러 (SQLITE_BUSY): 1회 재시도 (100ms 대기) 후 실패 시 silent fail + stderr 로그
  - 복구 불가 에러 (SQLITE_FULL, 권한 오류): 즉시 사용자에게 경고 알림 + degraded mode 플래그 설정
- FTS5 인덱싱 실패 시: reflection 본문은 저장하되 검색 불가 상태로 표시 (degraded mode)
- context-save.js에서 reflection 저장 실패 시: 기존 context save 동작에 영향 없음
- 잘못된 JSON 데이터 (insights/decisions/patterns): Zod 검증 실패 → 해당 필드를 빈 배열로 대체 후 저장

### Performance Targets

- ReflectionStore.save(): < 50ms (단일 INSERT + FTS5 인덱싱)
- ReflectionStore.search(): < 100ms (FTS5 쿼리)
- Minor reflection 전체 처리: < 200ms (수집 + 저장)
- Major reflection 전체 처리: < 500ms (전체 세션 분석 + 저장)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/memory/ReflectionStore.ts`
- `src/lib/memory/__tests__/reflection.test.ts`
- `src/tools/memory/reflectionTools.ts`
- `hooks/scripts/session-reflection.js`

### Files to Modify
- `src/lib/memory/MemoryStorage.ts` (reflections 테이블 추가)
- `src/lib/MemoryManager.ts` (ReflectionStore 통합)
- `hooks/scripts/context-save.js` (minor reflection 트리거)
- `src/tools/memory/index.ts` (reflection tools export)

### Verification Commands
- `vitest run src/lib/memory/__tests__/reflection.test.ts`
- `npx tsc --noEmit`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] reflections 테이블이 기존 memories.db에 생성됨
- [ ] ReflectionStore CRUD + FTS5 검색이 작동함
- [ ] 컨텍스트 70% 시 minor reflection이 자동 저장됨
- [ ] 세션 종료 시 major reflection이 자동 저장됨
- [ ] core_reflect_now 도구로 수동 reflection 가능
- [ ] core_search_reflections로 이전 reflection 검색 가능
- [ ] start_session에서 최근 high-value reflections 자동 주입
- [ ] 모든 테스트 통과
- [ ] 빌드 성공 (tsc)
</acceptance>
