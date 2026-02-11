---
status: pending
phase: 5
parent: _index.md
depends: [phase-1-progress-reporting.md, phase-2-mid-task-injection.md, phase-3-activity-heartbeat.md, phase-4-response-style.md]
---

# SPEC: Phase 5 — Config Integration + Cleanup

## Persona
<role>
설정 통합 전문가. Phase 1-4에서 추가된 상수/설정을 통합하고, 레거시 코드를 정리한다.
</role>

## Context
<context>
### Background
Phase 1-4에서 하드코딩된 상수들을 constants.ts와 config.json으로 통합.
telegram-bridge.ts는 레거시 파일 (현재 아키텍처와 무관).

### Related Code
- `src/infra/lib/constants.ts` — CONCURRENCY 객체
- `src/router/types.ts` — RouterConfig
- `src/bridge/telegram-bridge.ts` — 레거시 (Claude CLI 직접 래퍼)
</context>

## Task
<task>
### Phase 5-1: constants.ts 통합
1. [ ] Phase 1-4 상수 통합:
   - `PROGRESS_MIN_INTERVAL_MS: 3_000`
   - `MAX_PENDING_MESSAGES: 10`
   - `PENDING_MESSAGE_TTL_MS: 300_000`
   - `MAX_INJECTION_PER_PROCESS: 3`
   - `ACTIVITY_TIMEOUT_MS: 600_000`
   - `STALE_CHECK_INTERVAL_MS: 60_000`
   - `LOCK_WAIT_TIMEOUT_MS: 30_000`
   - `DEFAULT_EXTERNAL_FORMAT: 'text'`
   - `MAX_INJECTION_CHARS: 4_000` (C2: token overflow 방지)
   - `ACK_DEBOUNCE_MS: 5_000` (새 요청 확인 알림 debounce)
   - `MAX_STALE_RETRY: 1` (C5: poison pill 방지)
   - File: `src/infra/lib/constants.ts`

### Phase 5-2: config.json 스키마
1. [ ] RouterConfig 확장 (optional, 기본값 fallback):
   ```json
   {
     "responseStyle": { "format": "text", "useEmoji": true, "allowMarkdownForCode": true },
     "messaging": { "progressMinIntervalMs": 3000, "activityTimeoutMs": 600000 }
   }
   ```
2. [ ] Phase 1-4 하드코딩 값을 config/constants 참조로 교체
   - File: `src/router/types.ts`, config 로딩 관련 파일

### Phase 5-3: 레거시 정리
1. [ ] `src/bridge/telegram-bridge.ts` 삭제 전 확인:
   - `package.json` exports 필드에 참조 없는지 확인
   - `dist/` 빌드 출력에서 참조 없는지 확인
   - 프로젝트 전체 import 스캔 (`grep -r "telegram-bridge"`)
2. [ ] 확인 후 삭제 + import 참조 제거
   - File: `src/bridge/telegram-bridge.ts`, `src/cli/index.ts`

### Phase 5-4: 통합 검증
1. [ ] `npx tsc --noEmit` + `npm run build` + `pnpm test`
</task>

## Constraints
<constraints>
- 기존 constants.ts 값 변경 없음 (추가만)
- config.json 기존 필드 변경 없음 (추가만)
- 새 config 없어도 기본값으로 동작 (하위 호환)
- telegram-bridge.ts 삭제 전 참조 확인 필수
</constraints>

## Output Format
<output_format>
### Files to Modify
- `src/infra/lib/constants.ts`
- `src/router/types.ts`

### Files to Delete
- `src/bridge/telegram-bridge.ts`

### Verification Commands
- `npx tsc --noEmit`
- `npm run build`
- `pnpm test`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] Phase 1-4 상수가 constants.ts에 통합
- [ ] config.json responseStyle + messaging 동작
- [ ] 새 config 없이 기본값 정상 동작
- [ ] telegram-bridge.ts 삭제 + 참조 없음
- [ ] TypeScript 컴파일 성공
- [ ] npm run build 성공
- [ ] 기존 테스트 깨짐 없음
</acceptance>
