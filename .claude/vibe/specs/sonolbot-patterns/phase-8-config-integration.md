---
status: pending
phase: 8
parent: _index.md
depends: [phase-1-activity-timeout.md, phase-2-file-attachment.md, phase-3-message-batching.md, phase-7-response-style.md]
---

# SPEC: Phase 8 — Config Integration + Constants

## Persona
<role>
설정 통합 전문가. 모든 Phase에서 추가된 상수와 설정을 constants.ts와 config.json에 정리한다.
</role>

## Context
<context>
### Background
Phase 1-7에서 각각 상수와 설정이 추가되었다. 이를 constants.ts에 통합하고, config.json 스키마를 업데이트한다.

### 현재 Vibe 코드
- `src/infra/orchestrator/constants.ts` — CONCURRENCY 객체, TIMEOUTS, DEFAULT_MODELS
- `.claude/vibe/config.json` — language, quality, stacks, references, models, autonomy
</context>

## Task
<task>
### Phase 8-1: constants.ts 최종 정리
1. [ ] 모든 Phase에서 추가된 상수를 CONCURRENCY 객체에 통합:
   - `ACTIVITY_TIMEOUT: 180_000` (Phase 1)
   - `BATCH_WAIT_MS: 2_000` (Phase 3)
   - `MAX_INJECTION_PER_SESSION: 3` (Phase 4)
   - `CONVERSATION_HISTORY_HOURS: 24` (Phase 5)
   - `CONVERSATION_HISTORY_MAX_CHARS: 8_000` (Phase 5)
   - `CONVERSATION_CLEANUP_HOURS: 48` (Phase 5)
2. [ ] 상수 설명 주석 추가
   - File: `src/infra/orchestrator/constants.ts`

### Phase 8-2: config.json 스키마 업데이트
1. [ ] config.json에 새 섹션 추가:
   ```json
   {
     "responseStyle": {
       "format": "text",
       "useEmoji": true,
       "tone": "conversational"
     },
     "messaging": {
       "batchWaitMs": 2000,
       "maxInjectionPerSession": 3,
       "conversationHistoryHours": 24
     }
   }
   ```
2. [ ] config 로딩 코드에서 새 필드 파싱 + 기본값 설정
   - File: config 로딩 관련 파일

### Phase 8-3: 통합 검증
1. [ ] `npx tsc --noEmit` 컴파일 성공
2. [ ] `pnpm test` 실행하여 기존 테스트 깨짐 없음 확인
   - (better-sqlite3 관련 기존 실패 제외)
</task>

## Constraints
<constraints>
- 기존 constants.ts의 값 변경 없음 (추가만)
- config.json 기존 필드 변경 없음 (추가만)
- 하위 호환: 새 필드가 없어도 기본값으로 동작
</constraints>

## Output Format
<output_format>
### Files to Modify
- `src/infra/orchestrator/constants.ts` — 상수 통합
- config 로딩 관련 파일 — 스키마 업데이트

### Verification Commands
- `npx tsc --noEmit`
- `pnpm test`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 모든 새 상수가 constants.ts CONCURRENCY에 존재
- [ ] config.json에 responseStyle, messaging 섹션 추가 가능
- [ ] 새 config 필드 없어도 기본값으로 정상 동작
- [ ] TypeScript 컴파일 성공
- [ ] 기존 테스트 깨짐 없음 (better-sqlite3 제외)
</acceptance>
