# SPEC: audit-p2-remediation

> 2026-07-28 Claude⨯Codex 교차검증 감사에서 확정된 P2 잔여 작업.
> 목표: 배포 계약·게이트 정확성·고위험 모듈 커버리지를 실제 검증 가능한 상태로 만든다.

- status: completed (2026-07-29 — REQ-001~011 전부 구현·검증. AC 2건은 실측 후 정정하고 근거를 본문에 남겼다: REQ-008 커버리지 백분율, REQ-010 홈 쓰기 금지)
- Stakes: **production** — 게시 중인 npm 패키지(`@su-record/vibe@3.2.14`)의 배포 계약과 훅 게이트를 건드린다. demo/prototype 신호 없음.
- source: `.vibe/reports/analysis-2026-07-28-merged.md`
- 선행: P1 3건은 v3.2.14 로 배포 완료 (`7b06aa8`)
- 선례: `.vibe/specs/harness-remediation.md` (2026-06-11 감사 → REQ/AC 전개, 동일 패턴)

## Overview / Goal

감사에서 P2 로 분류된 9건을 처리한다. 다만 SPEC 작성 중 실측으로 **2건의 전제가 뒤집혔고**, 그 결과가 아래 REQ 에 반영돼 있다 (§Context Sources 의 재평가 항목). 각 REQ 는 결정론적 AC 와 회귀 테스트를 동반하며, 웨이브 단위로 독립 배포 가능하다.

## Context Sources

| 출처 | 사용 내용 |
|---|---|
| `.vibe/reports/analysis-2026-07-28-merged.md` | P2 항목 9건의 원문 근거 |
| `npm pack --dry-run --json` (2026-07-28) | 1,596 files / unpacked 6,617,635 B, test 엔트리 283개 |
| `npm view @su-record/vibe@3.2.14 dist.unpackedSize` | 6,617,635 — 게시본에도 동일 |
| `npm view glob@13.0.6 dependencies` | `minimatch: ^10.2.2` |
| `npm view minimatch@10.2.6 dependencies` | `brace-expansion: ^5.0.8` (패치본) |
| `hooks/scripts/code-check.js:116-162` 정독 | `detectAnyType` 은 `stripNonCodeLine` 적용, `detectConsoleLogs` 는 미적용 |
| `post-edit-dispatcher.js` 실행 (5개 파일) | JSDoc·템플릿 리터럴의 `console.log` 가 실제로 P1 으로 주입됨을 확인 |
| `hooks/scripts/pre-tool-dispatcher.js:23-31` | guard 3종이 `denyOnExit2: true` |

### 재평가 — 감사 리포트 대비 정정된 전제 2건

**(7) brace-expansion 취약점은 게시 소비자에게 도달하지 않는다.**
리포트는 "prod 경로 도달"로 적었으나, 실측 결과 `glob@13.0.6` 이 `minimatch@^10.2.2` 를 캐럿 범위로 요구하고 `minimatch@10.2.6` 은 패치본 `brace-expansion@^5.0.8` 을 요구한다. 우리 패키지는 락파일을 게시하지 않으므로 **신규 설치 소비자는 자동으로 패치본을 받는다.** 취약한 것은 우리 로컬 `node_modules` 와 커밋된 `pnpm-lock.yaml` 뿐이다. → 소비자 보안 수정이 아니라 **개발/CI 환경 위생**으로 재분류.

**(10) "console.log 9건"은 대부분 오탐이었고, 진짜 결함은 탐지기 쪽에 있다.**
9건을 정독한 결과 7건이 코드가 아니다 — JSDoc 예시 3건(`ReviewRace.ts:21`, `tools/index.ts:5`, `askUser.ts:565`), 사용자에게 출력할 마크다운 템플릿 리터럴 4건(`SkillRepository.ts:443,449,485,499`). 실제 호출 2건은 모두 정당하다: `utils.ts:67` 은 `VIBE_DEBUG` 로 게이트된 `debugLog()` 내부, `codex-proxy.ts:1093` 은 프록시 기동 배너.
그런데 `code-check` 를 실제로 돌려보니 **7건 전부를 P1 으로 주입한다.** 원인은 `detectConsoleLogs` 가 원본 라인을 그대로 정규식 검사하고 확장자 게이트만 두는 반면(`code-check.js:148-162`), 같은 파일의 `detectAnyType` 은 `stripNonCodeLine` 으로 주석·문자열·템플릿을 제거한다는 것(`:116-134`). `detectAnyType` 의 독스트링은 그 이유까지 적어두고 `detectConsoleLogs` 를 참조하는데, 정작 적용이 안 됐다.
→ 원 항목(코드 정리)은 **할 일 없음**으로 닫고, **탐지기 오탐 수정**으로 대체한다. 커밋 `4670841`(마크다운 오탐)이 고친 것과 같은 결함군의 잔여분이다.

## Constraints

- 기존 게이트를 깨지 않는다: `npx tsc --noEmit` exit 0, `npx vitest run` 전량 통과, `validate:counts`·`validate:skill-invocation`·`gen:skill-docs:check`·`sync:agent-models:check` 전부 PASS, `npm run build` exit 0.
- 훅은 프로젝트 로컬 아티팩트다 — 훅 동작 변경은 `hooks/` 소스에만 하고 설치본(`~/.claude/`, `.claude/settings.local.json`)은 건드리지 않는다.
- 게시 패키지의 런타임 자산(`vibe/`, `skills/`, `agents/`, `hooks/`, `languages/`)은 tarball 에서 빠지면 안 된다.
- ESM 전용 — import 는 `.js` 확장자 유지.
- 웨이브 간 순서 의존 없음. 각 웨이브 단독으로 머지·배포 가능해야 한다.

## Requirements

### Wave A — 배포 위생 (독립 배포 가능)

#### REQ-audit-p2-remediation-001: tarball 에서 컴파일된 테스트 제외
`tsconfig.json` 이 `src/**/*` 전체를 include 하고 테스트를 제외하지 않아 `dist` 에 `*.test.js` 60개, `dist/__tests__/*.js` 25개가 생성되고 그대로 게시된다.

- 파일: `tsconfig.json` (또는 신규 `tsconfig.build.json`), `package.json`
- 주의: 테스트는 `dist` 를 동적으로 검사하는 것이 있으므로(`wiring-integrity` 등) 타입체크 대상에서까지 빼면 안 된다 — **빌드 산출물에서만** 제외한다.

| Done Criteria | Evidence Required |
|---|---|
| `find dist -name '*.test.js' \| wc -l` 이 `0` | 명령 출력 |
| `find dist -path '*__tests__*' -name '*.js' \| wc -l` 이 `0` | 명령 출력 |
| `npm pack --dry-run --json` 의 test 엔트리 수가 `agents/tester.md`·`agents/e2e-tester.md` 2건 이하 | JSON 출력 |
| unpackedSize 가 6,617,635 B 대비 감소 | pack 전후 수치 |
| `npx tsc --noEmit` exit 0 (테스트 타입체크 유지) | 명령 exit code |
| `npx vitest run` 전량 통과 | 테스트 요약 |
| 런타임 자산 5종이 tarball 에 그대로 존재 | pack 파일 목록에서 `vibe/`·`skills/`·`agents/`·`hooks/`·`languages/` 확인 |

#### REQ-audit-p2-remediation-002: postinstall 실패 표면화
`package.json:35` 의 `.catch(()=>{})` 가 에셋·훅 설치 실패를 전부 삼켜 npm 이 성공으로 보고한다.

- 파일: `package.json`
- 제약: postinstall 실패가 `npm install` 자체를 **실패시키지는 않는다** (선택적 자산이므로). 가시성만 확보한다.

| Done Criteria | Evidence Required |
|---|---|
| 설치 스크립트가 실패 시 stderr 에 원인 1줄 이상 출력 | 실패 주입 재현 로그 |
| 실패해도 `npm install` 종료 코드는 0 유지 | 재현 시 exit code |
| 정상 경로에서 stderr 노이즈 없음 | 정상 설치 로그 |
| 회귀 테스트가 위 3가지를 검증 | 테스트 파일 경로 + 통과 출력 |

#### REQ-audit-p2-remediation-003: 패키지 매니저 정합
`packageManager` 필드가 없고 CI 3곳이 `--frozen-lockfile=false` 라, 커밋된 락파일과 다른 트리로 빌드·게시될 수 있다.

- 파일: `package.json`, `.github/workflows/test.yml`, `.github/workflows/release.yml`
- 전제: 이번 세션에서 `pnpm-lock.yaml` 을 `--lockfile-only` 로 이미 정합화함.

| Done Criteria | Evidence Required |
|---|---|
| `package.json` 에 `packageManager: "pnpm@<설치 CI 버전>"` 존재 | 파일 diff |
| CI 3곳이 frozen lockfile 로 설치 | 워크플로 diff |
| 실제 CI 런이 frozen 설치로 green | Actions 런 URL + conclusion |

#### REQ-audit-p2-remediation-004: 취약 의존성 로컬/CI 트리 정리
소비자 도달은 없으나(§재평가) 커밋된 락파일이 취약본을 고정하고 있어 CI 가 취약 트리로 돈다.

- 파일: `pnpm-lock.yaml`
- 범위 제외: 소비자 대상 완화 조치(`overrides` 강제 등) — 도달하지 않으므로 하지 않는다.

| Done Criteria | Evidence Required |
|---|---|
| `npm audit --omit=dev` 에 high 0건 | 명령 출력 |
| 락파일의 `brace-expansion` 이 5.0.8 이상 | 락파일 grep |
| 재평가 결론이 감사 리포트에 정정 반영 | 리포트 diff |

### Wave B — 게이트 정확성·타입 (독립 배포 가능)

#### REQ-audit-p2-remediation-005: guard 크래시 시 fail-open 처리
`dispatchInProcess` 는 step throw 를 code 1 로 흡수하고, deny 판정은 `code === 2` 만 본다(`lib/dispatcher.js:150-161`). 따라서 **크래시한 guard 는 작업을 허용한다.** guard 3종(`sentinel-guard`·`pre-tool-guard`·`scope-guard`)이 모두 `denyOnExit2: true` 다.

**채택 설계 (사용자 결정, 2026-07-29)**: `denyOnExit2: true` 인 **모든 guard** 는 크래시 시 deny(2) 로 승격한다. 크래시는 stderr 에 guard 이름 + 원인을 출력한다. `VIBE_HOOK_FAILCLOSED=0` 탈출구를 제공한다.

설계 논의 기록 — 초안은 `sentinel-guard` 만 승격하는 안이었다. 전 guard fail-closed 는 guard 하나의 무관한 예외로 Edit·Bash 가 전면 차단되어 **guard 소스를 고칠 수단까지 막히는 교착**을 만들 수 있기 때문이다. 사용자는 안전 우선으로 전면 승격을 선택했고, 그 결정에서는 탈출구가 선택 사항이 아니라 **복구 유일 수단**이 된다. 따라서 `VIBE_HOOK_FAILCLOSED=0` 은 필수 AC 이며, 차단 메시지에 그 사용법이 반드시 포함돼야 한다 (교착 상황의 사용자는 문서를 찾아볼 수 없다).

- 파일: `hooks/scripts/lib/dispatcher.js`, `hooks/scripts/pre-tool-dispatcher.js`

| Done Criteria | Evidence Required |
|---|---|
| `denyOnExit2` guard 가 throw 하면 디스패처가 exit 2 (guard 3종 각각) | 회귀 테스트 통과 출력 |
| `denyOnExit2` 가 아닌 step(`command-log`) 크래시는 exit 0 유지 | 회귀 테스트 |
| 모든 guard 크래시가 stderr 에 guard 이름 + 원인 1줄 출력 | 회귀 테스트 |
| 차단 메시지에 `VIBE_HOOK_FAILCLOSED=0` 탈출 방법이 포함 | 회귀 테스트(문자열 검증) |
| `VIBE_HOOK_FAILCLOSED=0` 이면 guard 크래시에도 exit 0 | 회귀 테스트 |
| 정상 경로 회귀 없음 — 기존 `dispatcher-inprocess.test.js` 전량 통과 | 테스트 출력 |

#### REQ-audit-p2-remediation-006: code-check `console.log` 오탐 제거
`detectConsoleLogs`(`code-check.js:148-162`)가 원본 라인을 검사해 JSDoc·템플릿 리터럴 안의 `console.log` 를 P1 으로 주입한다. 같은 파일 `detectAnyType`(`:116-134`)은 `stripNonCodeLine` 을 적용한다.

- 파일: `hooks/scripts/code-check.js`
- 부수 결정: `codex-proxy.ts:1093`(기동 배너)과 `utils.ts:67`(env 게이트 `debugLog` 내부)은 정당한 호출이므로, 오탐 제거 후에도 남으면 `qualityCheck.consoleAllow` 로 처리한다.

| Done Criteria | Evidence Required |
|---|---|
| `ReviewRace.ts`·`tools/index.ts`·`askUser.ts`·`SkillRepository.ts` 편집 시 console 관련 P1 0건 | `post-edit-dispatcher.js` 실행 출력 |
| 진짜 `console.log(` 호출은 여전히 P1 으로 탐지 | 회귀 테스트(양성 케이스) |
| 여러 줄 템플릿 리터럴·블록 주석을 가로지르는 케이스 처리 | 회귀 테스트 |
| 기존 `code-check-*.test.js` 전량 통과 | 테스트 출력 |

#### REQ-audit-p2-remediation-007: Figma 원본 입력 타입 도입
`extract.ts` 13건 + `audit.ts` 2건의 `any` 는 Figma REST 응답 노드에 대한 입력 타입이 없기 때문이다. `types.ts:34` 의 `FigmaNode` 는 **출력** 타입이다.

- 파일: `src/infra/lib/figma/types.ts`, `extract.ts`, `audit.ts`
- 제약: Figma API 전체를 모델링하지 않는다 — 코드가 실제로 읽는 필드만 담은 부분 타입으로 충분하다. 미지 필드는 `unknown` + 타입 가드.

| Done Criteria | Evidence Required |
|---|---|
| `src/infra/lib/figma/` 의 프로덕션 `any`/`as any`/`@ts-ignore` 0건 | grep 출력 |
| `npx tsc --noEmit` exit 0 | exit code |
| 기존 figma 테스트 전량 통과 | 테스트 출력 |
| 실제 Figma 응답 형태 fixture 로 타입 가드 동작 검증 | 회귀 테스트 |

### Wave C — 고위험 모듈 커버리지

#### REQ-audit-p2-remediation-008: `codex-proxy.ts` 테스트
1,139 L 의 Anthropic↔OpenAI 프로토콜 번역 + SSE 스트리밍. 직접 테스트 0건.

- 파일: `src/infra/lib/codex-proxy.ts` (테스트 신규)
- 범위: 순수 변환 함수 우선(`buildOMessages`, `translateTools`, `buildAResponse`, `mapFinishReason`, `processChunk`/`processToolDelta` 의 상태 전이). 실제 네트워크 호출은 테스트하지 않는다.

| Done Criteria | Evidence Required |
|---|---|
| 변환 함수별 happy path + 경계 케이스 테스트 존재 | 테스트 파일 |
| SSE 스트림 상태 전이(시작→delta→tool_call→종료) 검증 | 테스트 |
| **두 번역 계층 모두** 커버 — Anthropic↔OpenAI(Chat Completions)와 Anthropic↔Codex Responses | 테스트 파일의 describe 블록 |
| 네트워크·포트 바인딩 없이 통과 | 테스트 실행 로그 |
| 파일 statements 커버리지를 측정해 기록 | 커버리지 리포트 |

> **AC 정정 (2026-07-29, 실측 후)** — 초안의 "statements 60% 이상" 은 측정 없이 잡은 수치였고, 실측 결과 도달 불가능한 기준이었다. 파일 1,143 L 중 번역 계층은 약 500 L 이고 나머지 ~640 L 은 HTTP 서버 기동·요청 라우팅·OAuth 토큰 갱신·async 네트워크 핸들러(`handleStream`, `handleCodexStream`, `collectCodexResponse`, `startProxy`, 셸 함수 생성)로, 이 REQ 가 **명시적으로 범위에서 제외한** 부분이다. 번역 계층을 100% 덮어도 파일 기준으로는 60% 에 닿지 않는다.
> 측정값: statements **43.19%**, functions **59.42%** (테스트 42개). 26.26% → 43.19% 로 올린 차이는 초안 구현이 놓쳤던 Codex Responses 번역 계층(527-917 L, ~390 L)을 덮은 것이다 — 서버 코드로 오인했던 구간이다.
> 파일 전체 수치를 게이트로 삼으면 번역 로직이 아니라 서버 부팅 코드를 테스트하도록 유도된다. 그래서 게이트를 "두 번역 계층 모두 커버" 로 바꾸고, 백분율은 측정·기록 대상으로만 남긴다.

#### REQ-audit-p2-remediation-009: `clone-extract.js` 테스트
1,291 L, 훅 계층 최대 스크립트. 직접 테스트 0건.

| Done Criteria | Evidence Required |
|---|---|
| 순수 파싱/변환 경로에 대한 테스트 존재 | 테스트 파일 |
| 헤드리스 브라우저 없이 통과 | 테스트 실행 로그 |
| 기존 `clone-*.test.js` 와 충돌 없음 | 전량 통과 출력 |

#### REQ-audit-p2-remediation-010: `init.ts` 워크플로 테스트
`src/cli/commands/init.ts:216` 의 311 L 초기화 워크플로. 파일 쓰기·설정 생성을 수행하는데 직접 테스트가 없다.

| Done Criteria | Evidence Required |
|---|---|
| 임시 디렉터리 대상 초기화 결과 검증 테스트 존재 | 테스트 파일 |
| 홈 쓰기가 **문서화된 하네스 디렉터리로 한정**됨을 검증 | 테스트 |
| 기존 폴더 덮어쓰기 거절 검증 | 테스트 |
| 재실행 멱등성 — 사용자가 고친 config·SPEC 이 보존됨 | 테스트 |

> **AC 정정 (2026-07-29, 실측 후)** — 초안의 "사용자 홈·전역 경로에 쓰지 않음" 은 실제 설계와 반대였다. `init.ts:460` 이 명시하듯 init 은 **의도적으로** 홈에 전역 규약을 주입한다 (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md` + cursor 에셋). 감사 리포트의 일반론을 확인 없이 AC 로 옮긴 것이 원인이다.
> 지킬 값어치가 있는 불변식은 "홈에 쓰지 않는다" 가 아니라 **"문서화된 하네스 디렉터리 밖으로 새지 않는다"** 이므로 그렇게 바꿨다. 이 형태는 `~/Documents` 나 `~/.ssh` 같은 곳으로 쓰기가 번지는 회귀를 실제로 잡는다.
> 테스트는 `HOME` 을 임시 디렉터리로 돌려 홈 쓰기를 관측 가능하게 만든다. `process.env.CI` 는 init 에 이미 있는 비대화형 게이트를 그대로 쓴 것이다(코드 변경 없음).

### Wave D — 조사 산출물

#### REQ-audit-p2-remediation-011: 메이저 갱신 계획 문서
`typescript` 5.9.3→7.0.2, `@types/node` 22.20→26.1.2, `ts-morph` 26→28. **이 REQ 의 산출물은 업그레이드 실행이 아니라 계획 문서다.**

- 산출물: `.vibe/reports/major-upgrade-plan-2026-07.md`

| Done Criteria | Evidence Required |
|---|---|
| 3개 패키지별 breaking change 목록과 출처 링크 | 문서 |
| 이 저장소에서 실제 영향받는 파일/API 목록 (근거 명령 포함) | 문서 + 명령 출력 |
| 권장 순서와 각 단계 롤백 방법 | 문서 |
| `engines.node` 와의 상호작용 명시 | 문서 |

## Scenarios

Gherkin: `.vibe/features/audit-p2-remediation.feature`

## Out of Scope

- `typescript`/`@types/node`/`ts-morph` 메이저 업그레이드 **실행** (REQ-011 은 계획 문서까지)
- 소비자 대상 취약점 완화 조치 — §재평가에서 도달하지 않음이 확인됨
- `src/cli` 의 `console.log` 30개 파일 — CLI 사용자 출력으로 정당
- 커버리지 임계값을 CI 게이트로 승격 (현재 31.78% 기준 임의 수치가 되므로 별도 판단 필요)
- P3 항목 전체 (`MemoryItem` 분리, 대형 함수 분해, 빈 skills 디렉터리 등)
- 함수 길이/복잡도 리팩터링 (감사 P2-3 — 141개 함수, 별도 SPEC 필요)

## Assumptions

- `packageManager` 는 CI 가 현재 쓰는 pnpm 9 계열로 고정한다 (`.github/workflows/*.yml` 의 `pnpm/action-setup` 버전과 일치).
- REQ-008 의 커버리지 목표 60% 는 순수 변환 함수 중심으로 도달 가능한 현실적 수치로 잡은 값이다. 서버 기동 경로는 제외한다.
- REQ-002 의 "실패 주입"은 설치 스크립트가 참조하는 경로를 일시적으로 못 읽게 만드는 방식으로 재현한다.
- 웨이브별로 커밋을 나누고, Wave A 완료 시점에 배포 가능 여부를 재판단한다 (자동 배포하지 않음).

## Rejected Alternatives (Traps)

| 기각한 접근 | 기각 사유 |
|---|---|
| `sentinel-guard` 만 fail-closed, 나머지 fail-open (REQ-005 초안) | 사용자가 안전 우선으로 전면 fail-closed 를 선택했다. 교착 위험은 `VIBE_HOOK_FAILCLOSED=0` 탈출구와 차단 메시지 내 사용법 노출로 완화한다 |
| 크래시 가시화만 하고 승격 없음 (REQ-005) | sentinel 이 침묵 통과하는 문제가 그대로 남는다 — 자기수정 경로 보호가 무력화된 채 경고만 늘어난다 |
| `console.log` 9건을 코드에서 제거 (구 항목 10) | 7건은 JSDoc·템플릿 리터럴이라 제거 대상이 아니고, 나머지 2건은 env 게이트된 `debugLog` 와 기동 배너로 정당하다. 지울 코드가 없다 |
| `qualityCheck.consoleAllow` 에 6개 파일 등록으로 해결 (구 항목 10) | 탐지기 버그를 설정으로 덮는 것이라, 같은 오탐이 다른 파일에서 계속 재생산된다. 파일 목록도 무한히 늘어난다 |
| `overrides`/`resolutions` 로 `brace-expansion` 강제 (REQ-004) | 게시 패키지의 `overrides` 는 소비자 설치에 적용되지 않고, 소비자는 이미 패치본을 자동 수신한다. 효과 없는 필드만 남는다 |
| `.npmignore` 로 `dist/**/*.test.*` 제외 (REQ-001) | `files` 필드와 `.npmignore` 를 함께 쓰면 우선순위가 헷갈리고, 무엇보다 `dist` 에 테스트가 **생성되는 것 자체**는 그대로라 빌드 산출물이 계속 오염된다. 빌드 단계에서 막는 편이 근본적이다 |
| `tsconfig.json` 의 `include` 에서 테스트 제외 (REQ-001) | 테스트가 타입체크 대상에서 빠져 `tsc --noEmit` 이 테스트의 타입 오류를 못 잡는다. 빌드 전용 설정 분리가 맞다 |

## Human Taste (Non-Blocking)

- stderr 경고 문구(REQ-002, REQ-005)의 톤과 길이 — 하네스 출력에 섞였을 때 읽히는지는 사람이 판단한다.
- 메이저 갱신 계획(REQ-011)의 권장 순서가 실제 릴리스 일정과 맞는지.
