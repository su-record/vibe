---
status: pending
phase: 3
createdAt: 2026-02-06T10:49:09+09:00
---

# SPEC: Phase 3 - Policy Engine

## Persona

<role>
Senior backend engineer specializing in:
- Rule engine design
- Authorization systems
- Risk assessment
- TypeScript strict mode
</role>

## Context

<context>

### Background
모든 Job은 실행 전에 **Policy Engine**의 평가를 거쳐야 한다.
Policy Engine은 "가능한지"가 아니라 **"해도 되는지"**를 판단한다.

### Why
- AI에게 자유를 주기 전에 책임 구조 확립
- 사용자 설정에 따른 실행 제한
- 위험한 작업 사전 차단

### Tech Stack
- Rule Engine: 직접 구현 (JSON 기반 규칙)
- Storage: SQLite + JSON 파일 (규칙 정의)
- Evaluation: 동기 평가 (빠른 응답)

### Related Code
- `src/orchestrator/SmartRouter.ts`: 라우팅 로직 참고
- `src/lib/SkillQualityGate.ts`: 품질 게이트 패턴
- `hooks/scripts/pre-tool-guard.js`: 사전 검증 패턴

### Design Reference
- OPA (Open Policy Agent): 정책 평가 패턴
- AWS IAM: 권한 정책 구조

</context>

## Task

<task>

### Phase 3.1: Policy Model
1. [ ] `src/policy/types.ts` 생성
   - Policy 인터페이스
   - Rule 인터페이스
   - EvaluationResult 인터페이스
   - RiskLevel enum (none, low, medium, high, critical)
   - Verify: 타입 체크 통과

2. [ ] `src/policy/PolicyStore.ts` 생성
   - 기본 정책 (built-in)
   - 사용자 정책 (`~/.vibe/policies/`)
   - 프로젝트 정책 (`.vibe/policies/`)
   - 정책 우선순위: project > user > built-in
   - Verify: 정책 로드 테스트

### Phase 3.2: Built-in Policies
3. [ ] 기본 정책 정의 (`src/policy/builtin/`)
   - `file-safety.json`: 위험 파일 작업 제한
     - `/etc/`, `/usr/`, `~/.ssh/` 등 시스템 경로 차단
     - `.env`, `credentials.json` 등 민감 파일 경고
     - **경로 정규화:** realpath()로 심링크/상대경로 해석 후 매칭 (../etc/hosts 우회 방지)
   - `command-safety.json`: 위험 명령어 제한
     - `rm -rf`, `sudo`, `chmod 777` 등 차단
     - `git push --force` 경고
     - **명령어 정규화:** shell 토큰화 후 매칭 (공백/탭 정규화, alias 무시)
   - `resource-limit.json`: 리소스 제한
     - 동시 파일 수정 10개 제한
     - 큰 파일 (>10MB) 경고
   - Verify: 정책 파일 유효성

4. [ ] Risk Calculator
   - ActionPlan 분석
   - 규칙 매칭
   - 종합 리스크 점수 계산
   - Verify: 리스크 계산 테스트

### Phase 3.3: Policy Evaluation
5. [ ] `src/policy/PolicyEngine.ts` 생성
   - 정책 로드 및 캐싱
   - ActionPlan 평가
   - 결과: approve / warn / reject
   - **Policy Engine이 최종 리스크/승인 결정의 단일 소스 (ActionPlan의 risk_level은 입력값, PolicyEngine 결과가 최종)**
   - Verify: 평가 로직 테스트, ActionPlan risk와 Policy 결과 불일치 시 Policy 우선 테스트

```typescript
// 평가 결과 예시
{
  decision: 'warn',
  riskLevel: 'medium',
  reasons: [
    { rule: 'file-safety', message: 'Modifying config file', severity: 'warn' },
    { rule: 'command-safety', message: 'Running npm install', severity: 'info' }
  ],
  requiresApproval: true,
  suggestions: ['Review the changes before proceeding']
}
```

6. [ ] 정책 우선순위 처리
   - **평가 순서 (2단계):**
     1. **Safety policies (Built-in)**: 먼저 평가, reject면 즉시 차단 (Deny-Override, 무시 불가)
     2. **Configuration policies**: project > user > built-in 순서로 병합
   - **충돌 해결 규칙:**
     - Safety policy의 reject는 절대 override 불가
     - Configuration policy는 상위 레벨이 하위 레벨 설정 덮어씀
     - warn을 ignore로 변경은 configuration에서만 허용
   - 명시적 allow: 동일 레벨 + configuration policy에서만 효력
   - Verify: 우선순위 테스트, 안전 정책 override 시도 차단 테스트

### Phase 3.4: Evidence & Audit
7. [ ] `src/policy/Evidence.ts` 생성
   - 평가 결과 기록
   - Decision 로그
   - SQLite 저장 (`policy_evaluations` 테이블)
   - Verify: Evidence 저장 테스트

8. [ ] Audit Trail
   - 평가 이력 조회
   - 정책 변경 이력
   - Verify: 이력 조회 테스트

### Phase 3.4b: Error Handling
7b. [ ] 정책 파일 로드 오류 처리
   - 손상된 JSON 파일 감지 및 스킵 (기본 정책 유지)
   - JSON Schema 검증 실패 시 경고 로그 + 해당 정책 비활성화
   - 파일 권한 오류 시 에러 로그 + 계속 동작
   - Verify: 손상된 정책 파일 로드 시 기본 정책만 동작 테스트

### Phase 3.5: User Configuration
9. [ ] 사용자 정책 설정 CLI
   - `vibe policy list` - 정책 목록
   - `vibe policy enable/disable <policy>` - 정책 활성화
   - `vibe policy set <key> <value>` - 설정 변경
   - Verify: CLI 동작 테스트

10. [ ] 정책 파일 형식
```json
// ~/.vibe/policies/custom.json
{
  "name": "custom",
  "version": "1.0.0",
  "rules": [
    {
      "id": "no-production-deploy",
      "description": "Block production deployments",
      "condition": {
        "action.type": "deploy",
        "action.target": { "contains": "production" }
      },
      "effect": "reject",
      "message": "Production deployment requires manual approval"
    }
  ]
}
```

</task>

## Constraints

<constraints>
- 정책 평가는 async (I/O 허용, p95 < 100ms)
- 기본 정책은 비활성화 불가 (경고만 무시 가능)
- 모든 평가 결과는 Evidence로 기록
- 정책 파일은 JSON Schema로 검증
- **Policy 조건 연산자:** equals, contains, regex, in, gt, lt, not (명시적 정의)
- **Policy effect 값:** approve, warn, reject, ignore (4가지만 허용)
- **missing field 처리 (클래스별):**
  - Safety policy: missing field → reject (보수적, fail-closed)
  - Config policy: missing field → 해당 규칙 스킵 (fail-open)
- **조건 구조:** 필드 간 implicit AND, 명시적 `$or`/`$not` 지원, 배열은 any-match
- **regex 안전성:** safe-regex 검증 + 패턴 길이 100자 제한 + 10ms 타임아웃
- critical 리스크는 항상 사용자 승인 필요
- **Evidence 통합 모델:** Job 생성, 상태 전이, Policy 평가, 사용자 승인, 실행 결과 등 모든 이벤트를 Evidence로 기록 (job_id FK 연결)
- **Evidence 스키마:** `evidence` 테이블 (id INTEGER PK, job_id TEXT FK, event_type TEXT, decision TEXT, payload TEXT JSON, actor TEXT, source TEXT, created_at TEXT ISO-8601 UTC), 인덱스: job_id, event_type, created_at
- **Evidence 보안:** payload에서 API 키/토큰 자동 마스킹 (정규식 기반 redaction)
</constraints>

## Output Format

<output_format>

### Files to Create
- `src/policy/types.ts` - 타입 정의
- `src/policy/PolicyStore.ts` - 정책 저장소
- `src/policy/PolicyEngine.ts` - 정책 엔진
- `src/policy/Evidence.ts` - 증거 기록
- `src/policy/RiskCalculator.ts` - 리스크 계산
- `src/policy/builtin/file-safety.json`
- `src/policy/builtin/command-safety.json`
- `src/policy/builtin/resource-limit.json`
- `src/policy/index.ts` - 모듈 export
- `src/cli/commands/policy.ts` - CLI 명령어

### Files to Modify
- `src/job/JobManager.ts` - Policy 평가 단계 추가
- `src/daemon/VibeDaemon.ts` - Policy RPC 메서드
- `src/cli/index.ts` - policy 명령어 등록

### Verification Commands
- `npm run build`
- `npm test`
- `vibe policy list`

</output_format>

## Acceptance Criteria

<acceptance>
- [ ] ActionPlan이 Policy 평가를 거침
- [ ] 기본 정책 3종 동작 (file, command, resource)
- [ ] 리스크 레벨 계산 동작
- [ ] approve/warn/reject 결정 동작
- [ ] Evidence 기록 동작
- [ ] `vibe policy list/enable/disable/set` CLI 동작
- [ ] 사용자 정책 로드 동작
- [ ] 빌드 성공
- [ ] 테스트 통과
</acceptance>
