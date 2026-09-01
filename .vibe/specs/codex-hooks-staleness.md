# SPEC: codex-hooks-staleness

- **Stakes**: production — 배포된 CLI 의 훅 복구 경로이며 모든 Codex 사용자에게 영향
- **Created**: 2026-08-29
- **Status**: VERIFIED (2026-08-29 · run-ledger verifyPassed=true)
- **Class**: bug-fix

## Overview / Goal

`vibe upgrade` 의 `repairProjectHooks()` 가 `.claude` 는 내용 불일치(stale)까지 복구하는데
`.codex` 는 파일 부재만 본다. 그래서 훅 정의가 바뀌어도 이미 `.codex/hooks.json` 이 설치된
사용자에게는 새 정의가 **영영 도달하지 않는다**. 두 하네스를 같은 판정 모양으로 맞춘다.

## Context Sources

| 출처 | 근거 등급 | 내용 |
|---|---|---|
| `src/cli/commands/upgrade.ts:109-143` | 확인 | `repairProjectHooks()` — `.claude` 는 `!hasClaudeHooks(root) \|\| projectHooksStale(root,'.claude')`, `.codex` 는 `usesCodex && !existsSync('.codex/hooks.json')` |
| `src/cli/commands/upgrade.ts:81-90` | 확인 | `hasClaudeHooks()` — 파일 파싱 후 `hooks` 키 존재까지 확인. Codex 쪽에는 등가물이 없다 |
| `src/cli/setup/ProjectSetup.ts:542-564` | 확인 | `projectHooksStale()` 참조 구현 — 템플릿 치환 후 `JSON.stringify` 비교. 부재≠stale, 판독 불가≠stale |
| `src/cli/setup/CodexHooks.ts:39-52` | 확인 | `buildCodexHooksConfig(coreDir)` — 7개 이벤트를 코드로 생성. `installProjectCodexHooks` 가 쓰는 동일 출처 |
| `src/cli/setup/CodexHooks.ts:65-79` | 확인 | `installProjectCodexHooks()` — 기존 파일의 다른 키는 보존하고 `hooks` 키만 통째 교체 (idempotent) |
| `src/cli/setup.ts:14-32` | 확인 | 배럴 export — `projectHooksStale` 은 노출됨, Codex 등가물 없음 |
| `src/cli/commands/upgrade.test.ts:26-91` | 확인 | 기존 `describe('repairProjectHooks')` — 5 케이스, `tempProject()` 헬퍼 |
| 실측 (2026-08-29, v3.2.59) | 확인 | `PostCompact` 추가 후 upgrade 해도 설치본은 `PreCompact` 까지만. `rm .codex/hooks.json && vibe upgrade` 해야 7개 전부 복구 |
| grep `codexHooksStale` | 확인 | 무결과 — 판정 함수는 존재하지 않는다 |

## Requirements

| ID | 요구사항 | Done Criteria |
|---|---|---|
| REQ-codex-hooks-staleness-001 | `codexHooksStale(projectRoot, coreDir?)` 를 `CodexHooks.ts` 에 추가한다. `buildCodexHooksConfig(coreDir).hooks` 와 설치본의 `hooks` 를 `JSON.stringify` 비교하고, 부재≠stale·판독 불가≠stale 안전 규약을 지킨다 | DC-1, DC-2 |
| REQ-codex-hooks-staleness-002 | `repairProjectHooks()` 의 Codex 분기를 `.claude` 와 같은 모양(`!hasCodexHooks \|\| stale`)으로 맞추고, `hooks` 키 부재도 미설치로 판정하는 `hasCodexHooks()` 를 `hasClaudeHooks()` 대칭으로 둔다 | DC-3, DC-4 |
| REQ-codex-hooks-staleness-003 | 복구 사유를 `.claude` 와 동일하게 `.codex/hooks.json (stale)` 접미로 구분해 보고한다 | DC-3 |
| REQ-codex-hooks-staleness-004 | `codexHooksStale` 을 `src/cli/setup.ts` 배럴에서 export 한다 (`projectHooksStale` 과 동일 노출) | DC-5 |
| REQ-codex-hooks-staleness-005 | 회귀 테스트를 `upgrade.test.ts` 의 기존 `repairProjectHooks` describe 에 추가한다 | DC-4 |
| REQ-codex-hooks-staleness-006 | 릴리즈 게이트 전부 통과 — `plugins/vibe/` 생성물 재빌드 반영 포함 | DC-6, DC-7 |

## Done Criteria

전부 명령·관찰로 판정한다. 모델 자기 보고는 판정 근거가 아니다.

| ID | 판정 |
|---|---|
| DC-1 | `codexHooksStale` 이 `src/cli/setup/CodexHooks.ts` 에 존재하고 명시적 반환 타입 `boolean` 을 갖는다 — `grep -n "export function codexHooksStale" src/cli/setup/CodexHooks.ts` 가 1건 매칭 |
| DC-2 | `npm run build` exit 0 (tsc — `any`/암묵 반환타입 없음) |
| DC-3 | `.codex/hooks.json` 이 현재 정의와 어긋난 상태에서 `repairProjectHooks(root)` 가 `.codex/hooks.json (stale)` 을 반환하고, 재설치 후 파일의 `hooks` 키가 `buildCodexHooksConfig().hooks` 와 정확히 일치한다 — 신규 테스트로 판정 |
| DC-4 | `npx vitest run src/cli/commands/upgrade.test.ts src/cli/setup/CodexHooks.test.ts` exit 0, 신규 케이스 최소 3건(stale 복구 · `hooks` 키 부재 복구 · idempotent) 포함 |
| DC-5 | `grep -n "codexHooksStale" src/cli/setup.ts` 가 매칭 |
| DC-6 | 릴리즈 게이트 8종 각각 exit 0: `build`, `gen:skill-docs:check`, `validate:counts`, `validate:skill-invocation`, `sync:agent-models:check`, `gen:plugin-hooks:check`, `validate:mermaid`, `validate:plugin-tree` |
| DC-7 | 전체 `npx vitest run` 결과가 베이스라인(pristine `origin/main` 기준 로컬 23 failed / 2103 passed) 대비 **신규 실패 0건** |

## Evidence Required

| DC | 증거 |
|---|---|
| DC-1 / DC-5 | grep 출력 (파일:라인) |
| DC-2 / DC-6 | 각 npm 스크립트의 종료 코드와 마지막 출력 줄 |
| DC-3 / DC-4 | vitest 리포터 출력 (테스트 이름 + passed 수) |
| DC-7 | 전체 vitest 요약 라인 (`N failed | M passed`) 과 베이스라인 대비 diff |

## Scenarios

- **S1 → DC-3**: Given `.codex/hooks.json` 이 `PostCompact` 없이 설치돼 있다. When `repairProjectHooks(root)` 를 호출한다. Then `.codex/hooks.json (stale)` 을 반환하고 파일에 7개 이벤트가 전부 존재한다.
- **S2 → DC-3, DC-4**: Given `.codex/hooks.json` 이 현재 정의와 정확히 일치한다. When `repairProjectHooks(root)` 를 호출한다. Then 반환값에 `.codex` 항목이 없다 (idempotent).
- **S3 → DC-4**: Given `.codex/hooks.json` 이 존재하지만 `hooks` 키가 없고 사용자 키만 있다. When `repairProjectHooks(root)` 를 호출한다. Then `.codex/hooks.json` 을 복구하고 기존 사용자 키를 보존한다.
- **S4 → DC-4**: Given `.codex/hooks.json` 이 깨진 JSON 이다. When `repairProjectHooks(root)` 를 호출한다. Then 판독 불가를 stale 로 보지 않으므로 미설치 경로로 복구되고 예외가 밖으로 새지 않는다.
- **S5 → DC-3**: Given `.claude` 설치본이 템플릿과 어긋나 있다. When `repairProjectHooks(root)` 를 호출한다. Then 기존 `(stale)` 보고 동작이 그대로 유지된다 (회귀 없음).

## Out of Scope

1. `vibe status` 에 Codex 훅 staleness 를 보고하는 기능 — 이번 범위는 복구 경로다
2. `vibe update` 경로 — 무조건 재설치하므로 이미 최신이며 변경하지 않는다
3. `.claude` 쪽 판정 로직 변경 — 참조 구현이며 그대로 둔다
4. npm 배포·태그·릴리즈 실행 — 별도 지시 사항
5. Codex 훅 정의(`buildCodexHooksConfig`) 자체의 내용 변경
6. 로컬 Windows 베이스라인 23건 실패(EPERM symlink·CRLF·gitignore 아티팩트) 수정

## Assumptions

3-a 커버리지 스윕에서 나온 결정 지점 중 사용자에게 묻지 않고 기본값을 채택한 항목 전부:

1. 판정 함수 위치 → `src/cli/setup/CodexHooks.ts` (`buildCodexHooksConfig` 바로 옆, 기대값 생성기와 동일 파일)
2. 함수 이름 → `codexHooksStale` (요구사항 명시)
3. 비교 방식 → `JSON.stringify` 정확 일치. `projectHooksStale` 과 동일하며 키 순서가 코드 생성이라 결정적이다
4. `coreDir` 파라미터 → `getCoreConfigDir()` 기본값 + 주입 가능 (`buildCodexHooksConfig` 시그니처와 동일)
5. `projectHooksStale` 의 "템플릿 부재 시 판정 안 함" 가드 → Codex 에는 등가물 불필요. 기대값이 파일이 아니라 코드 생성이라 부재할 수 없다
6. 부재 판정 → `existsSync` 대신 `hasCodexHooks()` 로 승격해 `hooks` 키 부재도 미설치로 본다 (`hasClaudeHooks` 대칭 — "두 하네스 대칭이 본질" 제약의 직접 귀결)
7. 보고 문자열 → `.codex/hooks.json (stale)` (`.claude` 와 동일 접미)
8. 배럴 노출 → `src/cli/setup.ts` 에서 export (`projectHooksStale` 과 동일 취급)
9. 테스트 배치 → `upgrade.test.ts` 의 기존 describe. `codexHooksStale` 단위 테스트를 따로 두지 않는 이유는 실제 회귀가 통합 경로(`repairProjectHooks`)에서 났기 때문
10. 테스트 stale 픽스처 → 정상 설치 후 이벤트 하나를 지우는 방식. 하드코딩된 옛 정의를 붙여넣으면 정의가 또 바뀔 때 테스트가 먼저 썩는다
11. 기존 사용자 키 보존 → `installProjectCodexHooks` 가 이미 `hooks` 키만 교체하므로 추가 조치 없음
12. 주석·문서 언어 → 한국어 (두 파일의 기존 관례)
13. 하위 호환 → 공개 API 변경 없음. 추가 export 뿐이고 시그니처 변경 0건

## Constraints

- 이 저장소 파일만 수정. `~/.claude`, `~/.codex`, `~/.vibe` 설치본은 건드리지 않는다
- 두 하네스 대칭이 이 수정의 본질 — 한쪽만 고치는 형태로 끝내지 않는다
- TypeScript 하드룰: `any`/`as any`/`@ts-ignore` 금지, 모든 함수에 명시적 반환 타입
- 복잡도: 함수 ≤50줄 · 중첩 ≤3 · 파라미터 ≤5 · 순환복잡도 ≤10. `repairProjectHooks` 가 이미 길므로 증가분을 최소로 둔다
- `plugins/vibe/` 는 커밋되는 생성물 — `validate:plugin-tree` 반영 필수
- 판정 기준은 절대 통과가 아니라 **베이스라인 대비 신규 실패 0건** (로컬 Windows 환경 제약)

## Rejected Alternatives (Traps)

1. **`.codex/hooks.json` 을 매 upgrade 마다 무조건 재설치** — 판정 없이 항상 쓰면 파일 mtime 이 매번 바뀌어 사용자의 편집 여부를 구분할 수 없고, `repaired` 보고가 항상 비어 있지 않아 "무엇이 실제로 고쳐졌나" 신호가 죽는다.
2. **`.codex/hooks.json` 을 템플릿 파일로 빼서 `projectHooksStale` 재사용** — `buildCodexHooksConfig` 는 `coreDir` 을 커맨드 문자열에 삽입해 생성한다. 템플릿화하면 placeholder 치환 규약이 하나 더 늘고, 기대값 출처가 설치 경로와 갈라져 지금 고치려는 드리프트를 다른 층에 재생산한다.
3. **파일 mtime·버전 스탬프 비교** — 설치본에 버전을 적어두고 비교하는 방식은 정의가 그대로인데 버전만 오른 경우에도 stale 로 오판하고, 반대로 사용자가 손으로 고친 내용 불일치는 못 잡는다. 내용 비교가 정확히 알고 싶은 것을 본다.
4. **`vibe status` 경고로만 알리고 복구는 사용자에게 맡김** — `.codex/hooks.json` 은 gitignore 된 로컬 아티팩트라 사용자가 드리프트를 인지할 경로가 없다. 설치가 idempotent 한 이상 경고보다 복구가 옳다 (`.claude` 가 이미 그 판단을 내렸다).

## Anchors

이 SPEC 이 안착한 경로. 경로가 사라지면 `npm run validate:spec-lifecycle` 이 막는다.

- `src/cli/commands/upgrade.ts:109-143`
- `src/cli/commands/upgrade.ts:81-90`
- `src/cli/setup/ProjectSetup.ts:542-564`
- `src/cli/setup/CodexHooks.ts:39-52`
- `src/cli/setup/CodexHooks.ts:65-79`
- `src/cli/setup.ts:14-32`
- `src/cli/commands/upgrade.test.ts:26-91`
- `src/cli/setup.ts`
