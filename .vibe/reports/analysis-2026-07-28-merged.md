# 교차 검증 리포트 — Claude ⨯ Codex 독립 분석 대조

- **대상**: `/home/ubuntu/repos/vibe` (@su-record/vibe v3.2.13, main @ `ce4de17`)
- **일자**: 2026-07-28
- **입력 A**: `analysis-2026-07-28.md` (Claude, 네트워크 있음)
- **입력 B**: `codex-analysis-2026-07-28.md` (Codex 0.145.0, tmux `codex-analyze`, bubblewrap 샌드박스, 네트워크 없음, 22분)
- **검증**: 두 리포트의 모든 상충·신규 주장을 이 세션에서 직접 재현

---

## 1. 판정 요약

| # | 주장 | 출처 | 판정 |
|---|---|---|---|
| 1 | `engines.node >=18` 이 실제 의존성과 불일치 | Codex only | ✅ **CONFIRMED — P1** |
| 2 | Stop 훅이 "순차"라고 문서화됐지만 실제 병렬 | Codex only | ✅ **CONFIRMED — P1** |
| 3 | `@vitest/coverage-v8` 미설치로 `--coverage` 자체가 실패 | Codex only | ✅ **CONFIRMED — P1** |
| 4 | `coverage.include` 가 없는 경로(`src/lib/**`)를 가리킴 | Claude only | ✅ **CONFIRMED — P1** |
| 5 | `dist/` 및 npm tarball 에 컴파일된 테스트가 실림 | Codex only | ✅ **CONFIRMED — P2** |
| 6 | `postinstall` 이 모든 실패를 삼킴 | Codex only | ✅ **CONFIRMED — P2** |
| 7 | 훅 디스패처가 guard 크래시 시 fail-open | Codex only | ✅ **CONFIRMED — P2** |
| 8 | Figma 계층 `any` 집중 | 양쪽 일치 | ✅ CONFIRMED — P2 |
| 9 | CI 가 `--frozen-lockfile=false` + `packageManager` 미선언 | 양쪽 일치 | ✅ CONFIRMED — P2 |
| 10 | `getAgentSdkQuery()` 명시적 반환 타입 누락 | Codex only | ✅ CONFIRMED — P3 |
| 11 | **테스트 스위트가 수렴하지 않음 / 훅 테스트 행** | Codex P1-3 | ❌ **REFUTED — 샌드박스 아티팩트** |
| 12 | **`IMemoryStorage` ↔ `MemoryStorage` 순환 의존** | Codex P2-4 | ⚠️ **DOWNGRADED — 타입 전용, 런타임 순환 아님** |
| 13 | 취약점 5건(high 3), 낙후 7개 | Claude only | ✅ 유효 (Codex 는 DNS 차단으로 미검증) |

---

## 2. Codex 가 단독으로 잡은 진짜 결함 (내 분석의 누락)

### P1-A. `engines.node: ">=18.0.0"` 은 거짓 (`package.json:68-70`)

`dependencies` 의 실제 엔진 요구:

| 패키지 | 설치 버전 | engines.node |
|---|---|---|
| `better-sqlite3` | 12.11.1 | `20.x \|\| 22.x \|\| 23.x \|\| 24.x \|\| 25.x \|\| 26.x` |
| `@clack/prompts` | 1.7.0 | `>= 20.12.0` |
| `glob` | 13.0.6 | `18 \|\| 20 \|\| >=22` |

둘 다 `optionalDependencies` 가 아니라 **`dependencies`**. Node 18 사용자는 "지원됨"이라고 안내받고 네이티브 빌드 실패나 런타임 오류를 만난다.
→ **`engines.node` 를 `>=20.12.0` 으로 올리고 최소 버전 CI 매트릭스 추가.**

### P1-B. Stop 훅: 문서화된 순차 실행이 실제로는 병렬 (`hooks/scripts/stop-dispatcher.js:3-17` ↔ `hooks/scripts/lib/dispatcher.js:99-109`)

`stop-dispatcher.js` 헤더는 이렇게 적혀 있다:

> 기존: Stop 배열에 4개 병렬 spawn … → auto-commit의 git cascade와 겹쳐 프로세스 폭주 유발 가능.
> **현재: 단일 디스패처에서 순차 실행.**
> 실행 순서: 1. codex-review-gate → 2. stop-notify → 3. auto-commit → 4. devlog-gen

그런데 그 `dispatch()` 는:

```js
const results = await Promise.all(
  enabledSteps.map(step => runScript(...))
);
```

**즉 고쳤다고 기록된 병렬 spawn 문제가 그대로 남아 있다.** 파일이 스스로 막겠다고 선언한 실패 모드(auto-commit ↔ git cascade 레이스)가 실재하며, devlog-gen 이 커밋 이전 상태를 관측하거나 stop-notify 가 완료 전에 울릴 수 있다. 게다가 `dispatch()` 호출부는 `catch { /* noise suppression */ }` 로 감싸여 있어 **실패해도 조용하다**.
→ 이건 "설계 취향" 이 아니라 **주석과 구현의 계약 위반**이다. 순차 dispatch 경로를 별도로 만들거나 `dispatch(steps, {sequential: true})` 옵션을 추가하고, 순서 회귀 테스트를 붙여야 한다.

### P1-C. 커버리지는 경로가 틀린 게 아니라 **애초에 실행 불가** (`vitest.config.ts:23-27`, `package.json:85-92`)

내 리포트는 `coverage.include` 가 존재하지 않는 `src/lib/**` 를 가리킨다는 점만 잡았다. Codex 는 한 겹 더 갔다:

```
$ npx vitest run --coverage
 MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'
$ ls node_modules/@vitest/
expect  mocker  pretty-format  runner  snapshot  spy  utils
```

`provider: 'v8'` 로 선언해 놓고 프로바이더가 devDependencies 에 없다. **두 결함이 겹쳐 있다** — 설령 프로바이더를 깔아도 `src/infra` 는 여전히 측정에서 빠진다. CI 에도 커버리지 잡·임계값이 없다.
→ `@vitest/coverage-v8` 추가 + `include` 를 `src/infra/lib/**`, `src/tools/**`, `src/cli/**` 로 수정 + CI 임계값.

### P2-A. npm tarball 에 컴파일된 테스트가 실린다 (`tsconfig.json:16-17`, `package.json:93-103`)

```
dist/ 안의 *.test.js : 60개
dist/__tests__/*.js  : 25개
npm pack --dry-run   : 1,707,441 B / unpacked 6,616,318 B / 1,589 entries
  그중 test 관련 엔트리 283개
```

원인은 `tsconfig.json` 이 `src/**/*` 전체를 include 하고 테스트를 exclude 하지 않는 것. 소비자가 내부 테스트·소스맵·d.ts.map 을 받는다.
→ `tsconfig.build.json` 으로 테스트 제외, 또는 `files` 대신 `.npmignore` 로 `dist/**/*.test.*`, `dist/__tests__/` 배제.

### P2-B. `postinstall` 이 실패를 전부 삼킨다 (`package.json:35`)

```json
"postinstall": "node -e \"import('./dist/cli/postinstall/main.js').then(m=>m.main()).catch(()=>{})\""
```

에셋·훅 설치가 실패해도 npm 은 성공으로 보고한다. CLAUDE.md 가 "훅은 프로젝트 로컬 아티팩트라 누락되기 쉽다"고 경고하는 바로 그 지점인데, 설치 실패가 조용하다.
→ 최소한 stderr 경고는 남겨야 한다 (`.catch(e => console.error(...))`). 최근 커밋 `80ef65e`/`f9e9b3c` 가 "postinstall 보고가 안 보이던 문제"를 다룬 것과 같은 계열의 잔여 구멍.

### P2-C. 훅 디스패처는 guard 크래시 시 fail-open (`hooks/scripts/lib/dispatcher.js:28-47, 137-147`)

- 설정 파싱 실패 → `catch { return {} }` → `isEnabled()` 가 **전부 true** 를 반환해 모든 훅이 켜진다.
- step 이 throw → `code: 1` 로 취급 → deny 판정은 `code === 2` 만 보므로 **크래시한 guard 는 작업을 허용한다**.

크래시 격리 자체는 의도된 설계지만, `pre-tool-guard` 같은 **차단용** 훅에는 fail-open 이 잘못된 기본값이다.
→ `denyOnExit2` step 은 크래시 시 2(=deny)로 승격하는 편이 안전하다.

---

## 3. Codex 주장 중 기각/하향

### ❌ P1-3 "테스트 스위트가 수렴하지 않는다" — 샌드박스 아티팩트

Codex 는 `npx vitest run` 이 4분 넘게 훅 테스트 타임아웃으로 수렴하지 않았고 `pre-tool-guard.test.js` 단독 실행도 행했다고 보고했다. 이 세션에서 재현 실패:

```
$ npx vitest run
 Test Files  83 passed (83)
      Tests  1557 passed (1557)
   Duration  17.15s

$ npx vitest run hooks/scripts/__tests__/pre-tool-guard.test.js
 Test Files  1 passed (1)
      Tests  46 passed (46)
   Duration  2.22s
```

원인은 Codex 실행 환경이다 — 기동 시 `warning: Codex could not find bubblewrap on PATH … Codex will use the bundled bubblewrap` 경고가 떴고, 훅 테스트는 자식 프로세스를 spawn 해 **stdin 으로 payload 를 주입**한다(`hooks/scripts/lib/hook-context.js:38-82`). 번들 bubblewrap 샌드박스 안에서 그 stdin 파이프가 닫히지 않아 동기 read 가 블록된 것으로 보인다. **저장소 결함 아님.**

다만 부산물로 알게 된 사실은 남길 가치가 있다: **훅 테스트는 샌드박스된 실행기 안에서 행이 걸린다.** Codex/CI 컨테이너에서 vibe 자체 테스트를 돌릴 계획이라면 이건 실제 이식성 이슈다.

### ⚠️ P2-4 "순환 의존 1건" — 타입 전용이므로 런타임 순환 아님

```ts
// src/infra/lib/memory/IMemoryStorage.ts:7
import type { MemoryItem } from './MemoryStorage.js';
// src/infra/lib/memory/MemoryStorage.ts:4
import type { IMemoryStorage } from './IMemoryStorage.js';
```

**양방향 모두 `import type`** → 컴파일 시 소거되어 ESM 런타임 사이클이 생기지 않는다. 내 스캔이 0 을 보고한 건 type-only 를 제외했기 때문이고, 그게 맞다.

단, Codex 의 **설계 지적은 유효**하다: 추상화(`IMemoryStorage`)가 구현(`MemoryStorage`)의 타입에 의존한다. `MemoryItem` 을 `types.ts` 로 올리면 해소된다. → **P2 아님, P3.**

### 📊 수치 차이 (둘 다 맞음, 측정 단위가 다름)

| 항목 | Claude | Codex | 비고 |
|---|---|---|---|
| 50줄 초과 함수 | 111 | 141 | Codex 가 AST 기반이라 더 정확. hooks JS 포함 여부 차이 |
| 순환 복잡도 >10 | 미측정 | 175 (평균 3.58) | Codex 수치 채택 |
| `console.log` | 파일 36개 / lib 9건 | 호출 378건 | 파일 수 vs 호출 수 |
| 취약점 | 5건 (high 3), prod 도달 1건 | 미검증 (DNS 차단) | Claude 수치 채택 |

---

## 4. 통합 최종 우선순위

### P1 — 즉시
1. **`engines.node` → `>=20.12.0`** (`package.json:68`). 현재 선언은 거짓이며 Node 18 사용자가 설치 실패한다.
2. **Stop 훅 순차 실행 복구** (`stop-dispatcher.js` ↔ `lib/dispatcher.js:99-109`). 주석이 약속한 계약이 구현되지 않았다. 순서 회귀 테스트 동반.
3. **커버리지 복구** — `@vitest/coverage-v8` 추가 **그리고** `vitest.config.ts:24` 의 `src/lib/**` → `src/infra/lib/**`. 지금은 실행도 안 되고, 실행돼도 `src/infra` 전체를 놓친다.

### P2 — 릴리스 전
4. `dist`/tarball 에서 컴파일된 테스트 60개 제외 (`tsconfig.build.json`).
5. `postinstall` 의 무조건 `catch(()=>{})` 제거 — 최소 stderr 경고.
6. `denyOnExit2` guard 는 크래시 시 deny 로 승격 (`lib/dispatcher.js:137-147`).
7. `npm audit fix` — `brace-expansion` high 취약점이 `glob → minimatch` 로 프로덕션 경로에 도달.
8. Figma 원본 입력 타입(`FigmaApiNode`) 도입 → `extract.ts`/`audit.ts` 의 `any` 15건 제거.
9. 패키지 매니저 단일화: `packageManager` 필드 선언 + CI 를 frozen lockfile 로.
10. `src/infra`·`src/tools` 의 `console.log` 9건 정리 또는 `qualityCheck.consoleAllow` 등록.
11. 무테스트 고위험 모듈: `codex-proxy.ts`(1124L), `hooks/scripts/clone-extract.js`(1291L), `init.ts:216`(311L).
12. `typescript`(2메이저)·`@types/node`(4메이저)·`ts-morph`(2메이저) 갱신 계획.

### P3
13. `MemoryItem` 을 `types.ts` 로 분리해 추상화→구현 타입 의존 제거.
14. `CodexProxyConfig`/`GlobalVibeConfig` 를 `src/infra/types/` 로 이동.
15. `getAgentSdkQuery()` 명시적 반환 타입 (`src/infra/lib/utils.ts:50`).
16. `suggestImprovements`(263L)/`checkCouplingCohesion`(247L)/`previewUiAscii`(236L)/`extractCSS`(189L) 분해.
17. `hooks/hooks.json:2` 및 `stop-dispatcher.js:3-14` 의 "순차" 주석을 구현과 일치시킬 것 (P1-2 수정 시 함께).
18. `skills/` 빈 디렉터리 4개 로컬 정리.

---

## 5. 메타: 이번 교차 검증이 준 것

- 내 단독 분석은 **정적 구조**(레이어, 사이클, SSOT 게이트)에 강했고 **패키징·배포 계약**(engines, tarball, postinstall)을 통째로 놓쳤다.
- Codex 단독 분석은 배포 계약과 주석↔구현 드리프트를 잘 잡았지만, **자기 실행 환경의 아티팩트를 저장소 P1 결함으로 오판**했다(P1-3). 샌드박스에서 도구를 돌릴 때 표준적인 오류 모드다.
- 실제 신규 P1 3건 중 **3건 모두 Codex 단독 발견**, 기각 1건도 Codex. 서로 다른 실행 환경에서 독립 분석을 돌린 것 자체가 이번 산출의 핵심이었다.
