---
status: pending
phase: 2
parent: _index.md
---

# SPEC: openclaw-integration — Phase 2: New Provider (Kimi)

## Persona
<role>
Senior TypeScript 개발자. OpenAI-compatible API 통합에 경험이 있으며, Vibe의 LLM 프로바이더 아키텍처를 따른다.
</role>

## Context
<context>
### Background
Vibe를 3-LLM(Claude+GPT+Gemini)에서 4-LLM(+Kimi)으로 확장한다.
- **Kimi (Moonshot)**: API Key 인증, OpenAI-compatible, 무료, 256K 컨텍스트

### Tech Stack
- TypeScript (ESM, strict)
- 기존 패턴: `src/lib/gpt/` (7-layer 구조)

### Related Code
- `src/lib/gpt/chat.ts`: GPT chat 구현 — Kimi에서 재사용할 패턴
- `src/lib/gpt/auth.ts`: OAuth-first, API Key fallback 패턴
- `src/lib/gpt-storage.ts`: 토큰 저장 패턴
- `src/cli/llm/gpt-commands.ts`: CLI 명령어 패턴
- `src/cli/llm/config.ts`: EXTERNAL_LLMS 레지스트리
- `src/cli/index.ts`: CLI 라우팅

### Design Reference
- OpenClaw `docs/providers/moonshot.md`: Kimi 모델 정의
</context>

## Task
<task>
### Phase 2-A: Kimi/Moonshot Provider (API Key Only)

1. [ ] `src/lib/kimi-constants.ts` 생성 (~20 lines)
   - `KIMI_BASE_URL`: `https://api.moonshot.ai/v1` (기본값, Global)
   - `KIMI_CN_URL`: `https://api.moonshot.cn/v1` (CN 대안, 환경변수 `KIMI_BASE_URL`로 오버라이드)
   - `KIMI_MODELS`: kimi-k2.5, kimi-k2-thinking, kimi-k2-thinking-turbo
   - `KIMI_DEFAULT_MODEL`: `kimi-k2.5`
   - 모델 메타데이터: contextWindow(256000), maxTokens(8192), cost(0)

2. [ ] `src/lib/kimi-storage.ts` 생성 (~80 lines)
   - `gpt-storage.ts` 패턴 단순화 (OAuth 없이 API Key만)
   - 저장 경로: `~/.config/vibe/kimi-apikey.json`
   - Functions: `loadApiKey()`, `saveApiKey()`, `removeApiKey()`, `hasApiKey()`
   - 파일 권한: `mode: 0o600`

3. [ ] `src/lib/kimi/types.ts` 생성 (~45 lines)
   - `AuthInfo { type: 'apikey'; apiKey: string }`
   - `KimiModelInfo`, `ChatMessage`, `ChatOptions`, `ChatResponse`
   - GPT types 패턴 따르되 OAuth 관련 타입 제외

4. [ ] `src/lib/kimi/auth.ts` 생성 (~30 lines)
   - `getAuthInfo()`: API Key only (OAuth 없음)
   - 환경변수 fallback: `MOONSHOT_API_KEY` → `KIMI_API_KEY`
   - `getApiKeyFromConfig()`: `~/.config/vibe/kimi-apikey.json` 읽기

5. [ ] `src/lib/kimi/chat.ts` 생성 (~140 lines)
   - `chatWithApiKey()`: GPT의 `chatWithApiKey()` 패턴 재사용
   - Endpoint: `{KIMI_BASE_URL}/chat/completions`
   - Request body: OpenAI Chat Completions 포맷 그대로
   - Headers: `Authorization: Bearer {apiKey}`
   - Retry: 3회, exponential backoff (2^n seconds)
   - Rate limit (429) 감지 및 처리
   - Export: `chat()`, `ask()`, `quickAsk()`, `getAvailableModels()`

6. [ ] `src/lib/kimi/orchestration.ts` 생성 (~40 lines)
   - `coreKimiOrchestrate(prompt, systemPrompt, options)` export
   - `temperature: 0`, 선택적 `jsonMode`

7. [ ] `src/lib/kimi/index.ts` 생성 (~6 lines) — barrel export
8. [ ] `src/lib/kimi-api.ts` 생성 (~3 lines) — backward compat re-export

9. [ ] `src/cli/llm/kimi-commands.ts` 생성 (~100 lines)
   - `kimiStatus()`: API Key 존재 여부, 사용 가능 모델 표시
   - `kimiLogout()`: API Key 삭제, 설정 비활성화

10. [ ] `src/cli/llm/config.ts` 수정 (+8 lines)
    - `EXTERNAL_LLMS`에 kimi 추가: `{ name: 'core-kimi', role: 'code-review', envKey: 'MOONSHOT_API_KEY' }`

11. [ ] `src/cli/index.ts` 수정 (+20 lines)
    - `case 'kimi':` 블록 추가 (key, status, logout, remove)

12. [ ] `src/cli/llm/help.ts` 수정 (+5 lines)
    - Kimi 도움말 섹션 추가
</task>

## Constraints
<constraints>
- Kimi chat는 GPT `chatWithApiKey()` 패턴을 최대한 재사용 (중복 최소화)
- 모든 저장 파일은 `mode: 0o600`
- Kimi는 기존 GPT/Gemini 인증에 영향 없음
- 환경변수가 설정되어 있으면 파일 저장 없이 바로 사용
- API call timeout: 30초
- API key는 로그에 절대 출력하지 않음 (마스킹: `sk-***last4`)
- 테스트: Vitest에서 Kimi API를 msw 또는 vi.mock으로 모킹하여 CI 환경에서 실행 가능하도록 함
- HTTP 클라이언트: global fetch + AbortController (Node 18+), retryable: 429/5xx, non-retryable: 4xx
</constraints>

## Output Format
<output_format>
### Files to Create
**Kimi (9 files):**
- `src/lib/kimi-constants.ts`, `src/lib/kimi-storage.ts`, `src/lib/kimi-api.ts`
- `src/lib/kimi/types.ts`, `src/lib/kimi/auth.ts`, `src/lib/kimi/chat.ts`
- `src/lib/kimi/orchestration.ts`, `src/lib/kimi/index.ts`
- `src/cli/llm/kimi-commands.ts`

### Files to Modify
- `src/cli/llm/config.ts` (+8 lines)
- `src/cli/index.ts` (+20 lines)
- `src/cli/llm/help.ts` (+5 lines)
- `src/cli/llm/index.ts` (+1 line)
- `package.json` (exports)

### Verification Commands
- `npx tsc --noEmit`
- `npm run build`
- `node -e "import('./dist/lib/kimi-api.js').then(m => console.log(Object.keys(m)))"`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] `vibe kimi key sk-xxx` 실행 시 API Key가 `~/.config/vibe/kimi-apikey.json`에 저장됨
- [ ] `vibe kimi status` 실행 시 키 존재 여부와 사용 가능 모델이 표시됨
- [ ] `vibe kimi logout` 실행 시 키가 삭제됨
- [ ] `coreKimiOrchestrate("Hello")` 호출 시 올바른 요청이 `api.moonshot.ai/v1/chat/completions`로 전송됨 (기본값: Global)
- [ ] Kimi API 429 응답 시 exponential backoff 후 재시도
- [ ] `npm run build` 성공
- [ ] TypeScript strict 모드 에러 없음
- [ ] API key가 로그/콘솔에 노출되지 않음 (마스킹 확인)
- [ ] Kimi API call이 30초 timeout 내 응답 없으면 에러 반환
</acceptance>
