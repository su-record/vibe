---
status: pending
phase: 2
---

# SPEC: agent-autonomy — Phase 2: Security Sentinel

## Persona
<role>
Senior TypeScript security engineer specializing in AI agent governance systems.
Implement defense-in-depth security layer with policy-based access control.
Follow existing vibe patterns while ensuring immutability from self-evolution.
</role>

## Context
<context>
### Background
보안 전문가 에이전트(Security Sentinel)가 vibe의 모든 자율 행위를 실시간 감시.
코드 보안뿐 아니라 vibe 자체의 자율성도 감시하여, 위험한 행위를 사전에 차단.
Sentinel은 self-evolution 대상에서 제외되어 불변성 보장.

### 기존 시스템
- `hooks/scripts/pre-tool-guard.js`: PreToolUse에서 위험 명령어 차단
- `src/lib/evolution/CircuitBreaker.ts`: 실패율 기반 서킷 브레이커
- Phase 1 EventBus/AuditStore: 이벤트 인프라

### Research Insights
- GPT: "Implement ABAC/RBAC in governance layer with centralized policy engine"
- GPT: "Use allowlists for external calls; block network by default"
- Gemini: "Sentinel Interceptor Middleware — intercepts all agent tool calls"
- Gemini: "Circuit Breaker for Hallucinations — suspend on loops/high error rates"
- Gemini: "Race condition in HITL — atomic state machine in SQLite transaction"
- Kimi: "Branded Type Boundaries — enforce risk score validation at compile time"
- Kimi: "Defense in Depth — input sanitization → SQL parameterization → business rules → audit"
- Kimi: "Plugin Architecture — Strategy pattern with dynamic imports for security rules"
</context>

## Task
<task>
### Phase 2-1: RiskClassifier 구현
1. [ ] `src/lib/autonomy/RiskClassifier.ts` 생성
   - File: `src/lib/autonomy/RiskClassifier.ts`
   - 위험도 분류 규칙:
     | ActionType | 기본 위험도 | 조건부 상승 |
     |------------|------------|------------|
     | file_write (src/) | LOW | 보안 파일 수정 시 HIGH (보안 파일 패턴: `**/auth/*`, `**/security/*`, `**/.env*`, `**/secrets*`). **단, `src/lib/autonomy/**`는 BLOCKED (확인 불가, 즉시 거부)** |
     | file_delete | MEDIUM | 5개 이상 동시 삭제 시 HIGH (AuditStore에서 최근 60초 내 동일 agentId의 file_delete 카운트 조회) |
     | bash_exec | MEDIUM | 위험 명령어 정규식 매칭 시 HIGH: `/\b(rm\s+-rf|kill\s+-9|drop\s+table|truncate|shutdown|reboot|mkfs|dd\s+if=)\b/i` |
     | git_push | HIGH | force push 시 HIGH |
     | skill_generate | LOW | rule 생성 시 MEDIUM |
     | config_modify | MEDIUM | sentinel 설정 변경 시 HIGH |
     | dependency_install | MEDIUM | 항상 MEDIUM |
     | external_api_call | LOW | 인증 정보 포함 시 HIGH (params/headers에서 정규식 매칭: `/\b(api[_-]?key|secret|token|password|auth|bearer)\b/i`) |
   - `classify(action: AgentActionEvent): RiskAssessment`
   - RiskAssessment: `{ riskLevel, score (0-100), factors: string[], reasoning: string }`
   - score 범위: LOW (0-33), MEDIUM (34-66), HIGH (67-100)
   - 커스텀 규칙 오버라이드: config.json `sentinel.rules[]` (커스텀 규칙이 기본 규칙보다 우선 적용, 미매칭 시 기본 규칙 fallback)
   - 입력 sanitization: 모든 문자열 파라미터는 Zod 스키마로 검증, 제어 문자(U+0000-U+001F) 제거
   - ReDoS 방지: 모든 정규식은 `re2` npm 패키지 사용 (linear time guarantee). re2 미사용 시 100ms 타임아웃으로 Worker thread 내 실행
   - Verify: 각 ActionType + 조건부 상승 + 엣지케이스(benign 문자열 false positive) + ReDoS 공격 패턴 테스트

### Phase 2-2: PolicyEngine 구현
2. [ ] `src/lib/autonomy/PolicyEngine.ts` 생성
   - File: `src/lib/autonomy/PolicyEngine.ts`
   - `policies` 테이블:
     ```sql
     policies {
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       description TEXT,
       rules JSON NOT NULL,
       priority INTEGER DEFAULT 0,
       enabled INTEGER DEFAULT 1,
       version INTEGER DEFAULT 1,
       createdAt TEXT NOT NULL,
       updatedAt TEXT NOT NULL
     }
     ```
   - 기본 정책 5개:
     1. `deny-force-push`: git push --force 차단
     2. `deny-sentinel-modify`: sentinel 코드/설정 수정 차단
     3. `deny-mass-delete`: 5개 이상 파일 동시 삭제 차단
     4. `require-approval-high-risk`: HIGH 위험 행위 오너 확인 필수
     5. `audit-all-actions`: 모든 행위 감사 로그 기록
   - `evaluate(action, riskAssessment): PolicyDecision`
   - PolicyDecision: `{ allowed: boolean, reason: string, requiredAction?: 'confirm' | 'block', matchedPolicies: string[] }`
   - 정책 우선순위: deny > require-approval > allow (높은 priority 먼저, 동일 priority 시 createdAt 오름차순)
   - Verify: 정책 평가 + 우선순위 테스트

### Phase 2-3: SecuritySentinel 구현
3. [ ] `src/lib/autonomy/SecuritySentinel.ts` 생성
   - File: `src/lib/autonomy/SecuritySentinel.ts`
   - Singleton 패턴 (프로젝트당 1개)
   - `intercept(action: AgentActionEvent): InterceptResult`
     1. RiskClassifier.classify(action)
     2. PolicyEngine.evaluate(action, risk)
     3. EventBus에 policy_check 이벤트 발행
     4. AuditStore에 기록
     5. InterceptResult 반환: `{ allowed, riskLevel, policyDecision, auditId }`
   - `isImmutable()`: true 반환 (self-evolution 대상 제외 확인용)
   - `getSentinelFiles()`: Sentinel 관련 파일 경로 목록 반환
   - 전체 처리 시간: intercept() 메서드 시작~종료 10ms 이내 (EventBus 동기 발행 포함, 비동기 outbox 제외)
   - Verify: intercept 흐름 + 이벤트 발행 + 감사 기록 테스트

4. [ ] Sentinel 불변성 보호
   - File: `src/lib/autonomy/SecuritySentinel.ts`
   - SENTINEL_PROTECTED_PATHS: `src/lib/autonomy/` 하위 모든 파일
   - **경로 정규화 필수**: 모든 대상 경로를 `path.resolve()` + `fs.realpathSync()` (symlink 해소) 후 프로젝트 루트 기준 상대 경로로 변환. `../` traversal 및 symlink 우회 차단
   - 정규화된 경로가 프로젝트 루트 외부인 경우 BLOCKED
   - self-evolution의 EvolutionOrchestrator가 sentinel 파일 생성 시도 시 거부
   - config.json `sentinel.*` 키 변경은 CLI만 허용 (프로그래밍 방식 차단)
   - Verify: 보호 경로 수정 시도 + path traversal(`../`) + symlink 우회 차단 테스트

### Phase 2-4: Hook 통합
5. [ ] `hooks/scripts/sentinel-guard.js` 생성
   - File: `hooks/scripts/sentinel-guard.js`
   - PreToolUse 이벤트 핸들러
   - Write/Edit 도구 호출 시: 대상 파일 경로 추출 → SecuritySentinel.intercept()
   - Bash 도구 호출 시: 명령어 파싱 → SecuritySentinel.intercept()
   - 차단 시: `{ "decision": "block", "reason": "..." }` 반환
   - 확인 필요 시: `{ "decision": "block", "reason": "Owner confirmation required..." }` 반환 + 확인 요청 이벤트 발행
   - 허용 시: `undefined` 반환 (기존 동작 유지)
   - 기존 pre-tool-guard.js와 공존 (sentinel-guard가 먼저 실행)
   - Verify: hook 동작 + 차단/허용/확인 흐름 테스트

### Phase 2-5: 테스트
6. [ ] 단위 + 통합 테스트
   - File: `src/lib/autonomy/__tests__/sentinel.test.ts`
   - RiskClassifier: 8개 ActionType x 조건부 상승 = 16+ 케이스
   - PolicyEngine: 5개 기본 정책 + 우선순위 + 커스텀 규칙
   - SecuritySentinel: intercept 흐름 (allow/block/confirm)
   - 불변성: sentinel 파일 보호 테스트
   - 성능: intercept 10ms 이내 완료
   - Verify: `vitest run src/lib/autonomy/__tests__/sentinel.test.ts`
</task>

## Constraints
<constraints>
- Sentinel은 동기 처리 (PreToolUse hook은 동기 응답 필요)
- intercept() 전체 처리: 10ms 이내
- 기존 pre-tool-guard.js 동작에 영향 없음
- PolicyEngine 규칙은 JSON 기반 (코드 실행 없음, 안전)
- 정책 규칙 JSON 스키마:
  ```typescript
  interface PolicyRule {
    field: 'actionType' | 'target' | 'riskLevel' | 'agentId' | 'params';
    operator: 'eq' | 'neq' | 'contains' | 'matches' | 'in' | 'gt' | 'lt';
    value: string | string[] | number;
  }
  // rules는 PolicyRule[] — 모든 rule이 AND 조건으로 평가
  // 허용되지 않은 field/operator 조합은 Zod 검증에서 거부
  ```
- Sentinel 파일은 self-evolution auto/ 디렉토리에 생성 불가
- config.json sentinel.* 키는 CLI `vibe sentinel` 명령으로만 변경
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/autonomy/RiskClassifier.ts`
- `src/lib/autonomy/PolicyEngine.ts`
- `src/lib/autonomy/SecuritySentinel.ts`
- `hooks/scripts/sentinel-guard.js`
- `src/lib/autonomy/__tests__/sentinel.test.ts`

### Files to Modify
- `src/lib/memory/MemoryStorage.ts` (policies 테이블 추가)
- `src/lib/autonomy/index.ts` (Phase 2 exports 추가)

### Verification Commands
- `vitest run src/lib/autonomy/__tests__/sentinel.test.ts`
- `npx tsc --noEmit`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: RiskClassifier가 8개 ActionType에 대해 LOW/MEDIUM/HIGH를 정확히 분류
- [ ] AC-2: 조건부 위험도 상승이 정확히 동작 (예: force push → HIGH)
- [ ] AC-3: PolicyEngine이 5개 기본 정책을 평가하고 우선순위대로 적용
- [ ] AC-4: SecuritySentinel.intercept()가 10ms 이내에 완료
- [ ] AC-5: Sentinel 파일(src/lib/autonomy/) 수정 시도가 차단됨
- [ ] AC-6: sentinel-guard.js hook이 PreToolUse에서 정상 동작
- [ ] AC-7: 차단 시 적절한 reason 메시지 반환
- [ ] AC-8: 모든 행위가 AuditStore에 기록됨
- [ ] AC-9: 모든 테스트 통과 + TypeScript 빌드 성공
</acceptance>
