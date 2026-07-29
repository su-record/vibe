# 메이저 의존성 갱신 계획 — 2026-07

> REQ-audit-p2-remediation-011. **이 문서의 산출물은 계획이며, 업그레이드 실행이 아니다.**
> 근거: 2026-07-29 실측(`npm outdated`, 소스 grep) + 공개 릴리스 자료.

## 요약

| 패키지 | 현재 | 최신 | 판정 |
|---|---|---|---|
| `typescript` | 5.9.3 | 7.0.2 | ⛔ **차단** — 컴파일러 API 제거, 코드가 직접 의존 |
| `ts-morph` | 26.0.0 | 28.0.0 | ⛔ **차단** — TypeScript 업그레이드에 종속 |
| `@types/node` | 22.20.0 | 26.1.2 | ⚠️ 조건부 — `engines.node` 정합 확인 후 |
| `better-sqlite3` | 12.11.1 | 13.0.1 | ✅ 진행 가능 — 네이티브 재빌드 검증 필요 |
| `chalk` | 5.6.2 | 6.0.0 | ✅ 진행 가능 — 결합 3파일 |
| `@ast-grep/napi` | 0.40.5 | 0.45.0 | ✅ 진행 가능 — optional dep |
| `@anthropic-ai/claude-agent-sdk` | 0.2.141 | 0.3.220 | ✅ 진행 가능 — optional dep |

**결론: 지금 실행할 것은 없다.** 안전한 4건은 개별 PR 로 처리 가능하지만, 감사가 P2 로 올린
핵심(`typescript` 2 메이저 낙후)은 상류 차단 요인이 해소될 때까지 대기가 맞다.

---

## 1. TypeScript 5.9 → 7.0 — 차단

### 무엇이 깨지는가

TypeScript 7.0 은 컴파일러를 Go 로 포팅한 네이티브 구현(`tsgo`, "Project Corsa")이다.
타입 검사 의미론은 6.0 과 구조적으로 동일하게 유지됐지만, **컴파일러 API 가 존재하지 않는다** —
`import * as ts from 'typescript'` 로 얻던 Strada API 는 tsgo 에 없고, 새 API 는 7.1 대상이다.

또한 5.x → 7.0 은 한 번에 가는 경로가 아니다. 파괴적 변경은 **5.x → 6.0 경계**에 있다:
`strict` 기본값 true, `module` 기본값 esnext, `target` 기본값 최신, AMD/UMD/SystemJS 및
ES5 target 제거. 7.0 은 6.0 에서 deprecated 였던 것을 하드 에러로 바꾼다.

### 이 저장소에서 실제 영향받는 것

| 위치 | 영향 |
|---|---|
| `src/tools/convention/checkCouplingCohesion.ts:29` — `import * as ts from "typescript"` | **직접 차단.** 컴파일러 API 를 직접 쓰는 유일한 지점 |
| `src/infra/lib/ProjectCache.ts`, `analyzeComplexity.ts`, `checkCouplingCohesion.ts` (867 L) | ts-morph 경유 간접 의존 |
| `tsconfig.json` | 이미 `target: ES2022`, `module: ESNext`, `strict: true` — **6.0 기본값 변경의 영향 없음** |
| `moduleResolution: "node"` | 6.0 이 요구하는 값과 어긋날 수 있어 확인 필요 |

측정 근거:
```
$ grep -rn "from 'typescript'\|require('typescript')" src hooks scripts
src/tools/convention/checkCouplingCohesion.ts:29:import * as ts from "typescript";
```

### 왜 지금 하지 않는가

`checkCouplingCohesion.ts` 와 ts-morph 3파일이 컴파일러 API 에 걸려 있고, 대체 API 가 7.1
전까지 없다. 업그레이드하면 `/vibe.analyze --code` 의 복잡도·결합도 분석 기능이 통째로
멈춘다 — 이 저장소의 핵심 판매 포인트 중 하나다.

### 재평가 조건

1. TypeScript 7.1 의 새 컴파일러 API 가 출시되고,
2. `ts-morph` 가 그 API 로 이식된 버전을 내면,

그때 5.9 → 6.0 → 7.x 2단계로 진행한다. 그 전까지는 **6.0 단독 업그레이드**가 중간 목표로
유효하다 — 파괴적 변경이 그 경계에 몰려 있으므로 먼저 흡수해 두면 7.x 전환 비용이 준다.

---

## 2. ts-morph 26 → 28 — TypeScript 에 종속

28.0.0 의 파괴적 변경은 TypeScript 6.0 대응이다. 즉 **TypeScript 를 6.0 으로 올리기 전에는
단독 업그레이드가 의미 없다.** 현재 `ts-morph@26` 은 `@ts-morph/common@~0.27.0` 에 묶여 있다.

- 사용 API 표면은 좁다: `Project`, `SourceFile`, `ScriptKind`, `SyntaxKind`, `CallExpression`
- 전부 lazy `await import('ts-morph')` 로 로드된다 — 시작 시점 결합 없음
- 따라서 TypeScript 6.0 이행 시 함께 올리면 되고, 그 외 독립 작업은 불필요

---

## 3. @types/node 22 → 26 — 조건부

`engines.node` 가 `>=20.12.0` 이다(2026-07-28, REQ-001~004 웨이브에서 정정).
`@types/node@26` 은 Node 26 API 표면을 기술하므로, 타입상 존재하는 API 가 런타임(Node 20)에
없을 수 있다. **타입과 런타임 하한이 어긋나는 방향의 업그레이드**라 이득보다 위험이 크다.

권장: `engines.node` 하한과 같은 메이저 계열을 유지한다. 지금은 `@types/node@22` 유지가 맞고,
하한을 올릴 때 함께 올린다.

---

## 4. 즉시 진행 가능한 4건

순서는 위험도 오름차순.

### 4-1. `@anthropic-ai/claude-agent-sdk` 0.2 → 0.3 (optionalDependency)
- 결합: `src/infra/lib/utils.ts` 의 `getAgentSdkQuery()` 한 곳, dynamic import + try/catch
- 부재 시 `null` 반환으로 이미 degrade 하므로 실패해도 치명적이지 않다
- 검증: SDK 경로를 타는 기능 수동 확인

### 4-2. `@ast-grep/napi` 0.40 → 0.45 (optionalDependency)
- 네이티브 바이너리. 설치 실패가 조용하지 않도록 REQ-002 의 postinstall 보고와 함께 확인
- 검증: `npx vitest run` + ast-grep 경로 사용 기능

### 4-3. `chalk` 5 → 6
- 결합 3파일. ESM 전용 유지 여부만 확인하면 된다
- 검증: CLI 출력 육안 확인 (색상은 자동 테스트 대상이 아님)

### 4-4. `better-sqlite3` 12 → 13 — **가장 주의**
- 결합 **18파일** (memory/embedding/evolution 전반). 이 저장소에서 가장 깊게 박힌 의존성
- 네이티브 모듈이라 Node ABI 와 묶인다. `engines.node >=20.12` 와의 정합을 반드시 확인
- WAL 모드 동기 API 사용(CLAUDE.md Gotchas) — 동작 변경 여부 확인
- 검증: memory/embedding 테스트 전량 + 실제 DB 파일 왕복

---

## 5. 롤백

각 단계는 단일 패키지 단위 커밋으로 분리한다. 롤백은 커밋 되돌리기 + `pnpm install --lockfile-only`
재실행이다. CI 가 `--frozen-lockfile` 로 바뀌었으므로(REQ-003), 락파일이 되돌아가면 CI 도 함께
되돌아간다 — 이전처럼 락파일과 다른 트리로 조용히 통과하지 않는다.

네이티브 모듈(4-2, 4-4)은 `node_modules` 재설치가 필요하다: `rm -rf node_modules && pnpm install --frozen-lockfile`.

---

## 6. 미확인 사항

- TypeScript 6.0 이 `moduleResolution: "node"` 를 계속 받는지 — 6.0 이행 시 최우선 확인 항목
- ts-morph 가 TypeScript 7 새 API 로 이식될 시점 — 상류 로드맵에 달려 있어 이 저장소에서 통제 불가
- `better-sqlite3@13` 의 Node ABI 하한 — 업그레이드 착수 시 `engines` 확인 필요

## 출처

- [TypeScript 7.0: New Features and the Go-Powered Compiler Rewrite — Better Stack](https://betterstack.com/community/guides/scaling-nodejs/typescript-7-go-rewrite/)
- [Preparing for TypeScript 7.0: Breaking Changes and Migration Steps — webhani](https://www.webhani.com/blog/typescript-7-breaking-changes)
- [TypeScript 7 Migration Guide: Upgrade from TS 5.x to Corsa — codingdunia](https://codingdunia.com/blog/typescript-7-migration-guide/)
- [ts-morph breaking-changes.md](https://github.com/dsherret/ts-morph/blob/latest/packages/ts-morph/breaking-changes.md)
- [ts-morph CHANGELOG.md](https://github.com/dsherret/ts-morph/blob/latest/packages/ts-morph/CHANGELOG.md)
- [Releases · dsherret/ts-morph](https://github.com/dsherret/ts-morph/releases)

> 위 출처는 2차 정리 글을 포함한다. 실제 업그레이드 착수 시점에는 TypeScript 공식 릴리스 노트와
> ts-morph 저장소의 1차 자료로 재확인할 것 — 이 문서의 판정은 "지금 하지 않는다" 이므로
> 2차 자료 수준의 확인으로 충분하다고 보았다.
