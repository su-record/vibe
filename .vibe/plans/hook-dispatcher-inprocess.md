---
feature: hook-dispatcher-inprocess
type: feature
track: logic-only
date: 2026-06-10
source: .vibe/interviews/hook-dispatcher-inprocess.md
---

# Plan: 훅 디스패처 in-process 평탄화

## 1. 개요

PreToolUse/PostToolUse 디스패처가 자식 스크립트 8종을 `node spawn`하는 대신 `import`하여
같은 프로세스에서 함수로 실행한다. 외부 계약(Claude Code ↔ 디스패처: stdin JSON, exit 2 = deny,
stdout = 컨텍스트 주입)은 그대로, 내부 1단계(디스패처 ↔ 스크립트)만 프로세스 경계를 제거한다.

```
현행: CC → dispatcher(spawn) → node × N        (Edit 1회 = 10 프로세스)
변경: CC → dispatcher(import 실행)              (Edit 1회 = 3 프로세스: pre/post/step-counter)
```

## 2. 설계 결정

| 결정 | 내용 | 근거 |
|------|------|------|
| D1 | 각 스크립트를 `export async function run(ctx): Promise<number>`로 변환. `process.exit(N)` → `return N` | exit 시맨틱의 함수화 |
| D2 | 파일 말미에 CLI shim: 직접 실행 감지 시 stdin/argv/env로 ctx 구성 → `process.exit(await run(ctx))` | antigravity-hooks.json + 기존 CLI 테스트 보존 |
| D3 | ctx = `{ toolName, toolInput, payload }` — 디스패처가 stdin을 1회 파싱해 전달 | guards의 stdin 재읽기(64KB Buffer) 제거 |
| D4 | `auto-format`/`auto-test`의 `execSync` → `execFile` 비동기화 (자체 timeout 유지) | in-process 병렬성 보존 — execSync는 이벤트 루프를 막아 post 체인을 직렬화시킴 |
| D5 | `lib/dispatcher.js`에 `dispatchInProcess(steps, ctx)` 추가. 기존 `dispatch()`(spawn)는 stop-dispatcher용으로 유지 | 저빈도 stop 체인은 변경 위험 > 이득 |
| D6 | step별 try/catch — throw는 exit 1 취급 (fail-open), denyOnExit2 step이 2 반환 시 즉시 `process.exit(2)` | 크래시 격리 대체 |
| D7 | `post-edit.js`의 전역 uncaughtException 핸들러를 CLI shim 안으로 이동 | import 시 디스패처 전역 오염 방지 |
| D8 | console 출력은 변경하지 않음 | 같은 프로세스 stdout/stderr = 채널 의미 동일 |

## 3. 변경 파일

| 파일 | 변경 |
|------|------|
| `hooks/scripts/lib/hook-context.js` | 신규 — `readStdinSync`/`buildCtx`/`isDirectRun` 공용 헬퍼 |
| `hooks/scripts/lib/dispatcher.js` | `dispatchInProcess()` 추가 |
| `hooks/scripts/{sentinel-guard,pre-tool-guard,scope-guard,command-log}.js` | run(ctx) 추출 + CLI shim |
| `hooks/scripts/{auto-format,code-check,auto-test,post-edit}.js` | run(ctx) 추출 + CLI shim (+D4 비동기화) |
| `hooks/scripts/pre-tool-dispatcher.js` | spawn steps → import 실행 |
| `hooks/scripts/post-edit-dispatcher.js` | spawn steps → import 실행 |
| `hooks/scripts/__tests__/dispatcher-inprocess.test.js` | 신규 — deny 시맨틱 보존 + 격리 테스트 |

## 4. 수용 기준 (요약 — SPEC에서 상세화)

1. deny 시맨틱: 위험 명령/sentinel 경로/scope 위반 시 디스패처 exit 2 (현행과 동일)
2. 기존 CLI 테스트(sentinel-guard, pre-tool-guard 등 166개) 무수정 통과
3. Edit 1회 프로세스 수 10 → 3
4. post-edit 디스패처 실측 레이턴시 개선 (자식 VM 기동 4회 제거)
5. step 하나의 throw가 다른 step과 디스패처 exit 0을 막지 않음
