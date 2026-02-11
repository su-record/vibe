---
status: pending
phase: 4
---

# SPEC: self-evolution — Phase 4: Validation & Lifecycle

## Persona
<role>
Senior TypeScript engineer focused on quality assurance and lifecycle management.
Ensure generated artifacts are safe, effective, and properly maintained.
</role>

## Context
<context>
### Background
Phase 3에서 생성된 skill/agent/rule의 품질을 검증하고, 사용 추적 및 자동 정리.

### Research Insights (Security)
- GPT: "Shadow execution for skill generation: sandboxed runs before promotion"
- GPT: "No rollback strategy for skill regressions" (anti-pattern)
- Gemini: "Blue-green deployment with canary validation"
- Gemini Security: "State corruption — atomic transactions during self-updates"
- Kimi: "Quality gate circuit breaker — failure rate > 5% → read-only mode"
- Kimi: "Time-travel testing — snapshot + revert to arbitrary points"
</context>

## Task
<task>
### Phase 4-1: Usage Tracker
1. [ ] `src/lib/evolution/UsageTracker.ts` 생성
   - File: `src/lib/evolution/UsageTracker.ts`
   - skill-injector.js에서 auto-generated skill이 주입될 때마다 기록
   - Schema (generations 테이블의 usageCount, lastUsedAt 업데이트)
   - 추가 테이블:
     ```
     usage_events {
       id TEXT PRIMARY KEY,
       generationId TEXT REFERENCES generations(id),
       sessionId TEXT,
       matchedPrompt TEXT (매칭된 사용자 프롬프트 요약),
       feedback TEXT ('positive' | 'negative' | 'neutral' | null),
       createdAt TEXT
     }
     ```
   - 사용자 피드백 수집:
     - Explicit feedback: 사용자가 `core_evolution_approve`/`reject` 도구로 명시적 평가
     - Implicit feedback: 세션 종료 시 Goals completed ratio 기반 **보조** 판정 (explicit feedback이 있으면 explicit 우선)
       - Goals 80%+ 완료 → 해당 세션에서 사용된 auto-generated skills에 'positive' 기록
       - Goals 30% 미만 완료 → 'negative' 기록
       - 그 외 또는 Goals 데이터 없음 → 'neutral' 기록 (Goals가 없는 세션에서는 implicit feedback 생략)
     - **참고**: Implicit feedback은 보조 지표로만 사용. Lifecycle 전이 판단 시 explicit feedback 가중치 2배

### Phase 4-2: Lifecycle Manager
2. [ ] `src/lib/evolution/LifecycleManager.ts` 생성
   - File: `src/lib/evolution/LifecycleManager.ts`
   - 상태 전이:
     ```
     draft → testing → active → disabled → deleted
                 ↓                    ↑
              (실패)              (TTL만료/피드백불량)
     ```
   - 자동 전이 규칙:
     - draft → testing: suggest 모드에서 사용자 승인 / auto 모드에서 즉시
     - testing → active: 3회 이상 사용 + weighted negative ratio < 30%
     - active → disabled: 7일간 미사용 (TTL) 또는 weighted negative ratio > 50%
     - disabled → deleted: 추가 7일간 복구 없음 (LifecycleManager.cleanup()에서 체크)
   - **Feedback 비율 계산 공식** (weighted negative ratio):
     ```
     explicitNeg = explicit 'negative' 개수 × 2
     explicitPos = explicit 'positive' 개수 × 2
     implicitNeg = implicit 'negative' 개수 × 1
     implicitPos = implicit 'positive' 개수 × 1
     totalWeighted = explicitNeg + explicitPos + implicitNeg + implicitPos
     weightedNegativeRatio = (explicitNeg + implicitNeg) / totalWeighted
     ```
     - totalWeighted가 0이면 ratio = 0 (피드백 없으면 부정적으로 판단하지 않음)
     - 'neutral' feedback은 비율 계산에서 제외
   - TTL 정리 주기: context-save hook에서 piggyback (별도 cron 불필요)

### Phase 4-3: Rollback Manager
3. [ ] `src/lib/evolution/RollbackManager.ts` 생성
   - File: `src/lib/evolution/RollbackManager.ts`
   - Methods:
     - `disable(generationId: string): void` — 즉시 비활성화 (파일 이름 변경: `.disabled` + DB 동기화)
     - `rollback(generationId: string): void` — 이전 버전 복원 (parentId 추적)
     - `emergencyDisableAll(): void` — 모든 auto-generated 비활성화 (안전 모드)
   - **DB-파일 동기화 원칙**: 모든 상태 변경은 단일 트랜잭션 내에서 DB 업데이트 + 파일 rename을 수행
     - `disable()`: `generations.status = 'disabled'`, `generations.updatedAt = now()` → 파일 rename `.md` → `.md.disabled`
     - `rollback()`: 현재 버전 disable + parentId 버전 `status = 'active'` → 파일 복원
     - `emergencyDisableAll()`: 모든 `status IN ('draft','testing','active')` → `'disabled'` + 파일 일괄 rename
     - DB 업데이트 성공 후 파일 rename 실패 시: DB ROLLBACK + 에러 로그
   - 비활성화 시 skill-injector가 `.disabled` 확장자를 무시하도록 처리
   - `vibe evolution rollback <id>` CLI 명령어

### Phase 4-4: Evolution Dashboard Tool
4. [ ] `src/tools/evolution/dashboardTools.ts` 생성
   - File: `src/tools/evolution/dashboardTools.ts`
   - Tools:
     - `core_evolution_status`: 전체 현황 (생성/활성/비활성 개수, 사용률)
     - `core_evolution_approve`: suggest 모드에서 draft → testing 승인
     - `core_evolution_reject`: draft 거부 + 삭제
     - `core_evolution_disable`: 특정 생성물 비활성화
     - `core_evolution_rollback`: 이전 버전 복원

### Phase 4-5: Circuit Breaker
5. [ ] `src/lib/evolution/CircuitBreaker.ts` 생성
   - File: `src/lib/evolution/CircuitBreaker.ts`
   - 생성 파이프라인 보호:
     - 최근 10개 생성 중 실패율 > 50% → 생성 중지 (open state)
     - 30분 후 → half-open (1개만 시도)
     - 성공 시 → closed (정상 운영)
   - 상태를 config.json이 아닌 메모리(runtime) 관리
</task>

## Constraints
<constraints>
- 파일 삭제 대신 `.disabled` 확장자 변경으로 비활성화 (복구 가능)
- emergency disable은 `~/.claude/vibe/skills/auto/`, `~/.claude/agents/auto/`, `~/.claude/vibe/rules/auto/` 전체 대상
- Usage tracking은 비동기 아닌 동기 SQLite (better-sqlite3)
- Feedback은 explicit (사용자 명시) + implicit (세션 성공/실패) 둘 다
- Circuit breaker state는 프로세스 메모리에만 유지 (재시작 시 closed로 리셋)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/evolution/UsageTracker.ts`
- `src/lib/evolution/LifecycleManager.ts`
- `src/lib/evolution/RollbackManager.ts`
- `src/lib/evolution/CircuitBreaker.ts`
- `src/tools/evolution/dashboardTools.ts`
- `src/lib/evolution/__tests__/lifecycle.test.ts`

### Files to Modify
- `src/lib/memory/MemoryStorage.ts` (usage_events 테이블 추가)
- `hooks/scripts/skill-injector.js` (auto-generated 사용 추적, .disabled 무시)

### Verification Commands
- `vitest run src/lib/evolution/__tests__/lifecycle.test.ts`
- `npx tsc --noEmit`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] auto-generated skill 사용 시 usage_events에 기록됨
- [ ] TTL 만료된 skill이 자동 비활성화됨
- [ ] 3회+ 사용 + 긍정 피드백 시 testing → active 승격됨
- [ ] rollback으로 이전 버전 복원 가능
- [ ] emergencyDisableAll로 모든 auto-generated 즉시 비활성화됨
- [ ] Circuit breaker가 실패율 50%+ 시 생성 중지함
- [ ] core_evolution_status로 전체 현황 확인 가능
- [ ] .disabled 파일이 skill-injector에서 무시됨
- [ ] 모든 테스트 통과, 빌드 성공
</acceptance>
