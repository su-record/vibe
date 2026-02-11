---
status: pending
phase: 3
parent: _index.md
---

# SPEC: openclaw-integration — Phase 3: Orchestrator Enhancement

## Persona
<role>
Senior TypeScript 개발자. 분산 시스템과 LLM 라우팅 아키텍처에 경험이 있으며, Vibe의 SmartRouter와 LLMCluster의 내부 동작을 이해한다.
</role>

## Context
<context>
### Background
Phase 2에서 추가된 Kimi를 SmartRouter와 LLMCluster에 통합하여 4-LLM 라우팅을 완성한다. 또한 Auth Profile Rotation으로 Rate Limit 대응력을 강화한다.

### Tech Stack
- TypeScript (ESM, strict)
- 기존 모듈: `src/orchestrator/SmartRouter.ts`, `src/orchestrator/LLMCluster.ts`

### Related Code
- `src/orchestrator/types.ts`: `LLMProvider` 타입, `TaskType`, `TASK_LLM_PRIORITY`
- `src/orchestrator/SmartRouter.ts` (321 lines): `callLlm()` switch, availability cache
- `src/orchestrator/LLMCluster.ts` (144 lines): `multiQuery()`, `gptOrchestrate()`, `geminiOrchestrate()`
- `src/orchestrator/orchestrator.ts`: CoreOrchestrator facade
- `src/orchestrator/BackgroundManager.ts`: `extractProvider()`, concurrency limits
- `src/lib/constants.ts`: `CONCURRENCY.PROVIDER_LIMITS`, `CONCURRENCY.MODEL_LIMITS`
- `src/orchestrator/index.ts`: public API exports

### Design Reference
- OpenClaw `src/agents/model-auth.ts`: Auth Profile 순환 패턴
- OpenClaw `src/orchestrator/SmartRouter.ts`: 다중 프로바이더 fallback
</context>

## Task
<task>
### Phase 3-A: SmartRouter 4-LLM Extension

1. [ ] `src/orchestrator/types.ts` 수정 (+20 lines)
   - `LLMProvider` 확장: `'gpt' | 'gemini' | 'claude' | 'kimi'`
   - `TaskType` 확장: `'code-review' | 'reasoning'` 추가
   - `TASK_LLM_PRIORITY` 업데이트:
     ```
     architecture: [gpt, kimi, gemini, claude]
     debugging: [gpt, kimi, gemini, claude]
     uiux: [gemini, gpt, claude]
     code-analysis: [kimi, gemini, gpt, claude]
     code-gen: [claude]
     web-search: [gemini, gpt, claude]  (Kimi는 웹검색 미지원)
     general: [claude]
     code-review: [kimi, gpt, gemini, claude]  (NEW)
     reasoning: [kimi, gpt, gemini, claude]    (NEW)
     ```

2. [ ] `src/orchestrator/SmartRouter.ts` 수정 (+20 lines)
   - `callLlm()` switch에 kimi case 추가
   - `kimi`: `kimiApi.coreKimiOrchestrate(prompt, systemPrompt, { jsonMode })`
   - Availability cache 초기화에 kimi 추가
   - Import: `src/lib/kimi-api.js`

3. [ ] `src/orchestrator/LLMCluster.ts` 수정 (+30 lines)
   - `kimiOrchestrate(prompt, systemPrompt, options)` 메서드 추가
   - `multiQuery()` 확장: `useKimi?: boolean` 옵션 추가
   - `MultiLlmQueryResult` 확장: `kimi?: string` 필드
   - `checkStatus()` 확장: kimi ping 추가

4. [ ] `src/lib/constants.ts` 수정 (+3 lines)
   - `CONCURRENCY.PROVIDER_LIMITS`에 kimi(5) 추가

5. [ ] `src/orchestrator/BackgroundManager.ts` 수정 (+4 lines)
   - `extractProvider()` 확장: kimi 모델 prefix 감지 (kimi-* → 'kimi')

6. [ ] `src/orchestrator/index.ts` 수정 (+10 lines)
   - 편의 함수 export: `kimi()`
   - 스마트 라우팅 함수: `smartCodeReview()`, `smartReasoning()`

### Phase 3-B: Auth Profile Rotation

7. [ ] `src/lib/llm/auth/AuthProfileManager.ts` 생성 (~200 lines)
   - `AuthProfile` 인터페이스:
     ```typescript
     interface AuthProfile {
       id: string;
       provider: LLMProvider;
       type: 'oauth' | 'apikey';
       identifier: string;       // email 또는 key prefix
       priority: number;          // 낮을수록 우선
       cooldownUntil: number;     // timestamp, 0 = 사용 가능
       errorCount: number;
       lastUsedAt: number;
       lastSuccessAt: number;
     }
     ```
   - 저장: `~/.config/vibe/auth-profiles.json` (파일 권한: 0o600)
   - identifier: API key의 last 4자리만 저장 (원문 prefix 저장 금지)
   - errorMsg 저장 시 민감정보 패턴(토큰/키) 자동 마스킹
   - `getActiveProfile(provider)`: cooldown 아닌 최우선 프로필 선택
   - `markSuccess(profileId)`: errorCount 리셋, lastSuccessAt 갱신
   - `markFailure(profileId, errorMsg)`: errorCount++, 3회 이상 시 cooldown 설정
   - Cooldown 계산: `5분 × 2^(errorCount - 3)` (5분, 10분, 20분, ...) / MAX_COOLDOWN: 4시간
   - `rotateToNext(provider)`: 현재 건너뛰고 다음 사용 가능 프로필
   - `listProfiles(provider?)`, `addProfile()`, `removeProfile()`, `clearCooldowns()`

8. [ ] `src/lib/llm/auth/ProfileFileLock.ts` 생성 (~60 lines)
   - `ProfileFileLock` 클래스
   - Lock 경로: `~/.config/vibe/.auth-profiles.lock`
   - `acquire(timeout?)`: mkdir atomic 패턴 (wx flag)
   - `release()`: rmdir
   - `isLocked()`: 존재 확인
   - Stale lock: 30초 이상이면 자동 해제

9. [ ] `src/lib/gpt/auth.ts` 수정 (+15 lines)
   - `getAuthInfo()` 성공 시 `profileManager.markSuccess()` 호출
   - 에러(429, 401) 시 `profileManager.markFailure()` + `rotateToNext()` 호출

10. [ ] `src/lib/gemini/auth.ts` 수정 (+15 lines)
    - 동일 패턴 적용

11. [ ] `src/lib/kimi/auth.ts` 수정 (+10 lines)
    - Profile rotation 통합

12. [ ] `src/lib/llm/auth/index.ts` 수정 (+3 lines)
    - `AuthProfileManager`, `ProfileFileLock` re-export
</task>

## Constraints
<constraints>
- SmartRouter의 기존 GPT/Gemini 라우팅 동작 변경 없음
- Kimi는 web-search 태스크에 포함하지 않음 (웹검색 미지원)
- Auth Profile은 optional — 프로필이 없으면 기존 단일 인증 방식으로 fallback
- Cooldown은 프로세스 재시작 시에도 유지 (파일 저장)
- Profile 파일 변경 시 file lock 사용 (병렬 에이전트 안전)
- Auth Profile은 모든 프로바이더에 대해 동작해야 함 (gpt, gemini, kimi)
- 프로바이더당 최대 10개 프로필 (초과 시 가장 오래된 lastUsedAt 프로필 삭제)
- SmartRouter fallback timeout: 프로바이더당 30초 (AbortController로 retry 포함 전체 budget 관리, 초과 시 다음 프로바이더로 전환)
- SmartRouter 에러 분류: 429/5xx → provider rotation, 401 → AuthProfile markFailure, 400 → 즉시 실패 (fallback 안 함)
- 모든 프로바이더 실패 시: 마지막 에러 메시지와 함께 `AllProvidersFailedError` throw
- API key는 로그에 절대 출력하지 않음 (마스킹 처리)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/llm/auth/AuthProfileManager.ts` (~200 lines)
- `src/lib/llm/auth/ProfileFileLock.ts` (~60 lines)
- `src/lib/llm/auth/AuthProfileManager.test.ts` (~120 lines)

### Files to Modify
- `src/orchestrator/types.ts` (+25 lines)
- `src/orchestrator/SmartRouter.ts` (+35 lines)
- `src/orchestrator/LLMCluster.ts` (+50 lines)
- `src/orchestrator/BackgroundManager.ts` (+6 lines)
- `src/orchestrator/index.ts` (+15 lines)
- `src/lib/constants.ts` (+6 lines)
- `src/lib/gpt/auth.ts` (+15 lines)
- `src/lib/gemini/auth.ts` (+15 lines)
- `src/lib/kimi/auth.ts` (+10 lines)
- `src/lib/llm/auth/index.ts` (+3 lines)

### Verification Commands
- `npx vitest run src/lib/llm/auth/AuthProfileManager.test.ts`
- `npx tsc --noEmit`
- `npm run build`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] `SmartRouter.route('code-review', prompt)` 호출 시 Kimi가 1순위로 시도됨
- [ ] Kimi 실패 시 GPT → Gemini → Claude 순으로 fallback
- [ ] `LLMCluster.multiQuery(prompt, { useKimi: true })` 호출 시 kimi 결과 포함
- [ ] `LLMCluster.checkStatus()` 호출 시 4개 프로바이더 상태 반환
- [ ] AuthProfileManager에 프로필 추가 후 `getActiveProfile()` 이 우선순위 순으로 반환
- [ ] Rate limit(429) 3회 발생 시 해당 프로필에 5분 cooldown 설정
- [ ] Cooldown 중인 프로필은 `getActiveProfile()`에서 건너뜀
- [ ] 모든 프로필이 cooldown 상태면 가장 빨리 해제되는 프로필 반환
- [ ] Profile 파일 동시 접근 시 file lock이 정상 동작
- [ ] 모든 프로바이더 실패 시 `AllProvidersFailedError`가 throw됨
- [ ] SmartRouter fallback이 프로바이더당 30초 timeout을 준수
- [ ] `npm run build` 성공
</acceptance>
