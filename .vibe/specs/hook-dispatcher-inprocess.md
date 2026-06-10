---
status: implemented
currentPhase: 3
totalPhases: 3
createdAt: 2026-06-10T11:30:00+09:00
lastUpdated: 2026-06-10T16:50:00+09:00
---

# SPEC: hook-dispatcher-inprocess

## Persona
<role>
- vibe 훅 시스템을 작성·운영해 온 시니어 개발자
- 기존 스타일 보존 (한국어 WHY 주석, fail-open 철학, 함수 ≤50줄)
- 외부 계약(Claude Code/Antigravity/Codex ↔ 훅)의 1바이트도 바꾸지 않는다
</role>

## Context
<context>
### Background
- 훅 1회 = 디스패처 spawn + 자식 N개 spawn (2단계). Edit 1회당 node 프로세스 10개.
- 자식마다 V8 기동 ~20ms + ESM 로드 + config 읽기 반복. 실측: pre ~23ms, post ~79ms (net).
- daemon/IPC 금지 (CLAUDE.md Gotchas) → in-process 평탄화가 유일 허용 경로.

### Tech Stack
- Node.js ESM (`"type": "module"`), 외부 의존성 없는 plain JS 훅 스크립트
- 테스트: vitest (`hooks/scripts/__tests__/*.test.js`)

### Related Code
- `hooks/scripts/lib/dispatcher.js`: 현행 spawn 디스패처 (dispatch() — stop-dispatcher가 계속 사용)
- `hooks/scripts/pre-tool-dispatcher.js`: steps = sentinel-guard, pre-tool-guard, [scope-guard], [command-log]
- `hooks/scripts/post-edit-dispatcher.js`: steps = auto-format, code-check, auto-test, post-edit
- `hooks/antigravity-hooks.json`: 개별 스크립트 직접 CLI 호출 — **변경 금지, 동작 보존**
- `hooks/scripts/codex-hook-adapter.js:100`: post-edit-dispatcher.js spawn — 디스패처 외부 계약 불변이라 무영향
- `hooks/scripts/__tests__/{sentinel-guard,pre-tool-guard}.test.js`: 스크립트를 CLI로 spawn하는 기존 테스트 — 무수정 통과 필수

### Exit-code 계약 (보존 대상)
| 스크립트 | exit 2 조건 | 출력 채널 |
|----------|------------|----------|
| sentinel-guard | sentinel 경로 Write/Edit/Bash | stdout JSON `{decision:'block',reason}` |
| pre-tool-guard | critical 위험 패턴 | stderr 경고 블록 |
| scope-guard | scope.json mode=block 위반 | stdout 경고 블록 |
| command-log / auto-format / code-check / auto-test / post-edit | 없음 (항상 0) | stdout 정보성 |
</context>

## Task
<task>
### Phase 1: 공용 컨텍스트 + run(ctx) 추출
1. [ ] `hooks/scripts/lib/hook-context.js` 신규
   - `readStdinSync()` (sentinel/pre-tool-guard의 중복 구현 통합)
   - `buildCtx({ payload, argvToolName, env })` → `{ toolName, toolInput, payload }`
     - toolInput: 문자열 정규화 (현행 각 스크립트의 정규화 로직과 동일 우선순위:
       stdin payload.tool_input → argv[3] → env.TOOL_INPUT)
   - `isDirectRun(importMetaUrl)`: `process.argv[1]` 비교로 직접 실행 감지
   - Verify: `npx vitest run hooks/scripts/__tests__` (기존 166개 영향 없음)
2. [ ] 가드 4종 변환 — `sentinel-guard.js`, `pre-tool-guard.js`, `scope-guard.js`, `command-log.js`
   - 톱레벨 실행부 → `export async function run(ctx): Promise<number>`; `process.exit(N)` → `return N`
   - CLI shim: `if (isDirectRun(import.meta.url)) { process.exit(await run(buildCtx(...))) }`
   - scope-guard의 `readScope()` 등 모듈 톱레벨 부작용은 run() 내부로 이동
   - Verify: 기존 CLI 테스트 무수정 통과 + `node hooks/scripts/sentinel-guard.js Edit '{"file_path":"src/infra/lib/autonomy/x.ts"}'` exit 2
3. [ ] post 4종 변환 — `auto-format.js`, `code-check.js`, `auto-test.js`, `post-edit.js`
   - 동일 run(ctx) 패턴. ctx.toolInput에서 file_path 추출 (현행 env.TOOL_INPUT 파싱 대체, CLI shim에서는 env 폴백 유지)
   - **auto-format/auto-test: `execSync` → `promisify(execFile)`** (timeout 5s/60s 유지) — in-process 병렬성 보존
   - post-edit: 전역 uncaughtException 핸들러를 CLI shim 내부로 이동
   - Verify: `npm run build` 영향 없음(JS), 수동 스모크 (아래 Output Format)

### Phase 2: 디스패처 전환
1. [ ] `lib/dispatcher.js`에 `dispatchInProcess(steps, { readStdin })` 추가
   - stdin 1회 읽기 → ctx 구성 → config.hooks[name].enabled 필터 → `Promise.all(steps.map(s => s.run(ctx)))`
   - step별 try/catch: throw → 1 취급 (fail-open). `denyOnExit2 && code === 2` → `process.exit(2)`
   - 기존 `dispatch()`(spawn)는 그대로 유지 (stop-dispatcher 사용)
2. [ ] `pre-tool-dispatcher.js`: 스크립트명 배열 → `import { run as ... }` 배열로 전환 (Bash/Edit/Write 조건 분기 유지)
3. [ ] `post-edit-dispatcher.js`: 동일 전환
   - Verify: `echo '<payload>' | node hooks/scripts/pre-tool-dispatcher.js Bash; echo $?`

### Phase 3: Testing and Verification
1. [ ] 신규 `hooks/scripts/__tests__/dispatcher-inprocess.test.js` — 디스패처를 CLI로 spawn하여 외부 계약 검증:
   - deny 보존: 위험 Bash(`rm -rf /`) → exit 2 / sentinel 경로 Edit → exit 2 / 안전 입력 → exit 0
   - scope-guard: scope.json 없으면 no-op (exit 0)
   - 격리: 손상된 stdin(비JSON) → post-edit-dispatcher exit 0
   - stdout 주입: sentinel block 시 stdout에 `{"decision":"block"...}` 포함
2. [ ] 기존 전체 테스트: `npm run build && npx vitest run` (1,125개+) 통과
3. [ ] 프로세스 수/레이턴시 실측: post-edit-dispatcher net 레이턴시 기록 (전: ~79ms)
</task>

## Constraints
<constraints>
- daemon/IPC 금지 (CLAUDE.md Gotchas 결정)
- 외부 계약 불변: hooks.json 명령줄, exit 2 = deny, stdout/stderr 채널 의미, antigravity-hooks.json의 개별 CLI 호출
- 기존 테스트 파일 수정 금지 (CLI shim으로 호환)
- stop-dispatcher / prompt-dispatcher / step-counter 변경 금지
- 가드 로직(패턴, 규칙) 변경 금지 — 순수 실행 모델 리팩토링
- 함수 ≤50줄, 한국어 WHY 주석 스타일 유지
</constraints>

## Output Format
<output_format>
### Files to Create
- `hooks/scripts/lib/hook-context.js`
- `hooks/scripts/__tests__/dispatcher-inprocess.test.js`

### Files to Modify
- `hooks/scripts/lib/dispatcher.js`
- `hooks/scripts/{sentinel-guard,pre-tool-guard,scope-guard,command-log}.js`
- `hooks/scripts/{auto-format,code-check,auto-test,post-edit}.js`
- `hooks/scripts/{pre-tool-dispatcher,post-edit-dispatcher}.js`

### Verification Commands
- `npm run build && npx vitest run`
- `echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | node hooks/scripts/pre-tool-dispatcher.js Bash; echo $?` → 2
- `echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | node hooks/scripts/pre-tool-dispatcher.js Bash; echo $?` → 0
- `echo 'not-json' | node hooks/scripts/post-edit-dispatcher.js; echo $?` → 0
</output_format>

## Acceptance Criteria
<acceptance>
- [x] AC-1: 위험 Bash 명령(`rm -rf /`) stdin 페이로드 → pre-tool-dispatcher exit 2 (dispatcher-inprocess.test.js)
- [x] AC-2: sentinel 경로(`src/infra/lib/autonomy/*`) Edit 페이로드 → exit 2 + stdout에 block JSON
- [x] AC-3: 안전 입력 → exit 0, deny 아님
- [x] AC-4: 디스패처 실행 중 step 1개가 throw해도 exit 0 (fail-open) + 다른 step 실행 완료
- [x] AC-5: 기존 테스트 전체 무수정 통과 (1,133개 — 신규 8개 포함)
- [x] AC-6: CLI shim 보존 — 기존 가드 CLI 테스트 54개 무수정 통과 (antigravity 경로)
- [x] AC-7: Edit 1회 훅 경로 node 프로세스 10 → 3 (디스패처가 node 자식을 spawn하지 않음)
- [x] AC-8: 빌드 성공

### 실측 (2026-06-10)
| 경로 | 전 (net) | 후 (net) |
|------|---------|---------|
| pre-tool (Bash/Edit) | ~23ms | **~8ms** (-65%) |
| post-edit | ~79ms | ~74ms (실작업 — prettier·모듈 로드 — 가 지배적, 프로세스 5→1로 CPU 절감) |
</acceptance>
