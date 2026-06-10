---
feature: hook-dispatcher-inprocess
type: feature
status: complete
date: 2026-06-10
mode: technical-self-interview
---

# Interview: hook-dispatcher-inprocess

> 내부 리팩토링이라 사용자 인터뷰 대신 코드베이스 분석으로 체크리스트를 채움.
> 근거: 본 세션의 성능 점검(훅 실측 pre ~23ms / post ~79ms net)과 8개 스크립트 전수 분석.

## Why (목적)

- 훅 1회마다 디스패처가 자식 스크립트를 `node spawn`하여 **2단계 프로세스 생성** 발생.
  Edit 1회 = node 프로세스 10개 (pre 1+3, post 1+4, step-counter 1).
- 자식마다 V8 기동(~20ms) + ESM 로드 + config 읽기를 반복 지불. 프로세스 경계로 캐시 공유 불가.
- **daemon/IPC는 금지** (CLAUDE.md Gotchas 확정 결정) → 허용된 유일한 경로는 in-process 평탄화.

## Who (사용자)

- Claude Code 사용자 전원 (모든 Bash/Edit/Write 도구 호출 경로).
- Antigravity 하네스는 **개별 스크립트를 직접 CLI 호출** (`antigravity-hooks.json`) — 변경 영향권이지만 동작 보존 대상.

## What (기능 범위)

- 대상: `pre-tool-dispatcher.js`(sentinel-guard, pre-tool-guard, scope-guard, command-log) +
  `post-edit-dispatcher.js`(auto-format, code-check, auto-test, post-edit) — **고빈도 경로만**.
- 제외: `stop-dispatcher.js`(턴당 1회, 저빈도 — spawn 유지), `prompt-dispatcher.js`(이미 패턴 매칭 후
  선별 spawn + llm-orchestrate는 장수명 자식이라 spawn이 옳음), `step-counter.js`(독립 hooks.json 엔트리).

## Confirmed Facts (코드 분석)

| # | 사실 | 함의 |
|---|------|------|
| 1 | 8개 스크립트 전부 **모듈 톱레벨에서 즉시 실행** + `process.exit(N)` | import 시 부작용 → `run(ctx)` 함수로 래핑 필수 |
| 2 | deny 규약 = exit 2 (sentinel-guard:127, pre-tool-guard:259, scope-guard:145) | 반환값으로 변환, 디스패처가 exit 2 전파 |
| 3 | `antigravity-hooks.json` + `__tests__/{sentinel,pre-tool}-guard.test.js`가 스크립트를 **독립 CLI로 spawn** | CLI shim(직접 실행 감지) 반드시 보존 |
| 4 | post 체인 4종은 현재 **병렬 프로세스** (dispatcher.js Promise.all spawn) | in-process에서 execSync(auto-format 5s, auto-test 60s)는 이벤트 루프를 막아 직렬화됨 → 비동기 child로 전환해야 병렬성 유지 |
| 5 | guards는 stdin을 **재차 읽음** (`readStdinSync`, 64KB Buffer) — 디스패처가 이미 읽어 HOOK_INPUT/stdin pipe로 전달 중 | in-process에서는 파싱된 ctx를 인자로 전달, stdin 읽기는 CLI shim 전용 |
| 6 | `post-edit.js`가 톱레벨에서 전역 `uncaughtException` 핸들러 등록 | in-process import 시 디스패처 전역 오염 → CLI shim으로 이동 |
| 7 | 출력 채널 의미: stdout = 컨텍스트 주입, stderr = 사용자 노출 (pre-tool-guard:233 주석) | 같은 프로세스라 console 직접 출력 의미 동일 — 변경 불필요 |
| 8 | config 토글 `config.hooks[name].enabled` (lib/dispatcher.js:43) | 디스패처에 유지 |
| 9 | 자식별 timeoutMs(기본 30s)는 spawn 옵션 | in-process 동기 코드는 강제 중단 불가 — 무거운 작업(execSync)이 전부 자체 timeout 보유로 대체 |

## Non-Goals

- daemon/IPC (금지), stop/prompt 체인 변경, step-counter 통합, 훅 기능(가드 규칙) 변경.

## Open Questions → Resolutions

| 질문 | 결정 |
|------|------|
| 크래시 격리 손실? | step별 try/catch — 실패 step은 exit 1 취급(fail-open), 나머지 계속 |
| 가드 간 실행 순서? | 기존과 동일하게 병렬(Promise.all) — 가드는 독립 검증자 |
| Codex 경로 영향? | `codex-hook-adapter.js`는 post-edit-dispatcher.js를 spawn — 디스패처 외부 계약 불변이라 무영향 |
