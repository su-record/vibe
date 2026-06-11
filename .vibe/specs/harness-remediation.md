# SPEC: harness-remediation

> 2026-06-11 하네스 3중 평가(Claude 심층 / Codex 리포트 / Codex 재검증)에서 확정된 보완 작업.
> 목표: 선언된 품질 약속을 실제 결정론적 게이트로 배선한다.

- status: completed (2026-06-11, branch feat/harness-remediation — P0·P1 전체 + 후속 8개 영역 구현·검증 완료. 잔여: Codex background-agent allowedTools의 런타임 샌드박스 연결은 별도 작업)
- source: `.vibe/reports/harness-2026-06-11.md` + Codex 재검증 (session 019eb3f4-e3e4-7b03-a7ad-9b6bfc10854d)

## P0 — 정합성 게이트 복구

### REQ-harness-remediation-001: RTM 기본 경로 수정
`generateTraceabilityMatrix()` 기본 경로를 `.claude/specs|features` → `.vibe/specs|features`로 변경한다. 레거시(`.claude/vibe/`, `.claude/`) 폴백을 유지한다.
- 파일: `src/tools/spec/traceabilityMatrix.ts`
- AC: 옵션 없이 호출 시 `.vibe/specs/<feature>.md`를 읽는다.

### REQ-harness-remediation-002: RTM 빈 결과 성공 처리 금지
요구사항이 0개면 매트릭스에 `status: 'empty'`와 경고를 명시하고, 커버리지 게이트로 사용할 수 없음을 출력에 드러낸다.
- AC: REQ-ID 없는 SPEC 입력 시 결과가 정상 커버리지로 위장되지 않는다.

### REQ-harness-remediation-003: 문서의 .then() 호출 수정
`skills/vibe.run/SKILL.md`, `skills/vibe.trace/SKILL.md`의 `generateTraceabilityMatrix(...).then()` 예시를 동기 호출로 수정한다.
- AC: 문서 예시를 그대로 실행해도 TypeError가 발생하지 않는다.

### REQ-harness-remediation-004: vibe.spec의 REQ-ID 강제
`skills/vibe.spec/SKILL.md` SPEC 템플릿이 모든 기능 요구사항에 RTM 추출 정규식과 일치하는 `REQ-<feature>-NNN` ID를 의무 부여하도록 한다.
- AC: 템플릿 지침대로 생성한 SPEC에서 RTM이 요구사항을 추출한다.

### REQ-harness-remediation-005: run-ledger 도입 (verify-skip 감지)
`.vibe/metrics/run-ledger.json`에 `runStarted/runFeature/verifyPassed/verifyAt`를 기록한다. prompt-dispatcher가 `/vibe.run`·`$vibe.run` 감지 시 runStarted를 기록하고 verifyPassed를 리셋한다.
- 파일: `hooks/scripts/lib/run-ledger.js`(신규), `hooks/scripts/prompt-dispatcher.js`

### REQ-harness-remediation-006: verify 결과의 결정론적 기록
`hooks/scripts/verify-ledger.js pass|fail` CLI를 추가하고, `skills/vibe.verify/SKILL.md`가 검증 종료 시 이를 실행하도록 의무화한다.

### REQ-harness-remediation-007: auto-commit verify 게이트
`hooks/scripts/auto-commit.js`는 `verifyPassed === true`이고 `verifyAt > runStarted`일 때만 커밋한다. 불충족 시 사유를 로그에 남기고 skip한다.

### REQ-harness-remediation-008: Stop 훅 verify-skip 경고
`stop-dispatcher` 경로에서 `runStarted && !verifyPassed`이면 경고한다. `verifyGate.mode === 'block'`(config) 시 1회에 한해 Stop을 차단한다(루프 방지 플래그 필수).

### REQ-harness-remediation-009: scope-guard 조건부 기본 활성화
`scope-from-spec.js`의 동기화를 `scopeGuard.enabled !== false`(기본 ON)로 변경한다. scope-guard 기본 모드는 warn을 유지하고 config로 block 승격을 지원한다.
- **"항상 ON"이 아니라 "산출 가능할 때만 ON"** (과거 노이즈 회귀의 재발 방지):
  - 활성 SPEC이 없으면 scope 미생성 (`skipped-no-specs`)
  - 활성 SPEC이 있어도 검증된 파생 경로가 0개면 미생성 (`skipped-no-paths`) — defaultAllow만 남은 scope는 모든 소스 편집에 경고를 띄우므로 금지
  - status frontmatter 없는 SPEC은 최근 14일 내 수정분만 활성 간주 (stale SPEC의 영구 활성 방지)
  - scope 부재 시 scope-guard는 완전 no-op (편집당 경고 없음), session-start 1줄 알림만

### REQ-harness-remediation-010: scope 부재 알림
session-start가 scope 동기화 후에도 `.vibe/scope.json`이 없으면 1줄 알림을 컨텍스트에 추가한다.

## P1 — soft 훅의 게이트 전환 (퀵윈)

### REQ-harness-remediation-011: 리뷰어 출력 절단 제거
`src/infra/orchestrator/index.ts`의 `slice(0, 500)` 절단을 제거하고 전체 결과를 보존한다.

### REQ-harness-remediation-012: 훅 stdin 64KB 한계 제거
`hooks/scripts/lib/hook-context.js`가 stdin을 EOF까지 읽는다. 파싱 실패 시 silent no-op 대신 truncation 여부를 구분한다.

### REQ-harness-remediation-013: gh pr create 테스트 게이트
Bash `gh pr create` 명령도 pr-test-gate와 동일한 테스트 게이트를 통과해야 한다.
- 파일: `hooks/scripts/pre-tool-guard.js`, `hooks/scripts/pr-test-gate.js`

## 후속 (이 SPEC 범위 외, 별도 추진)
PostToolUse additionalContext 전환 · 품질 탐지 AST 정밀화 · auto-test debounce · auto-format 부작용 제어 · step-counter 축소 · dead machinery 처분 · Codex parity · 문서 정직성 일괄.

### 설계 원칙: PostToolUse 에스컬레이션은 "차단"이 아니다
PreToolUse exit 2는 실행 차단이 확실하지만, PostToolUse는 이미 편집이 끝난 시점이므로 exit 2 "차단" 의미론은 하네스별로 다르고 부정확하다. P1급 발견의 에스컬레이션은 다음으로 구현한다:
1. **추가 컨텍스트 주입** — 모델이 확실히 보는 JSON `additionalContext` 형식 (Codex 어댑터는 기존 구현 재사용)
2. **verify-required 상태 기록** — run-ledger에 기록하여 auto-commit/Stop 게이트가 소비
3. **다음 단계 진행 금지** — 차단은 상태를 소비하는 후속 게이트(auto-commit, Stop, pr-test-gate)에서 수행
PostToolUse exit 2를 직접 쓰기 전에 각 하네스의 의미론을 확인하고, 불명확하면 위 3단 구조를 기본으로 한다.
