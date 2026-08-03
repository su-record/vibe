# SPEC: repo-hygiene-remediation

> 2026-08-02 저장소 리뷰에서 확정된 14개 개선 항목의 일괄 조치.
> 목표: **"완료 판정은 결정론적 게이트가 한다"는 제품 명제를 이 저장소 자신에게 적용한다.**
> 선언만 되어 있고 기계가 강제하지 않던 규칙들을 CI 게이트로 배선하고, 그 부재로 이미 발생한 드리프트를 제거한다.

- status: completed (2026-08-03, branch `claude/explicit-prompt-caching-demo-134pak` — REQ-001~014 전부 구현·게이트 통과)
- result: build 0 · lint 0 · ratchet 0 (435건 baseline) · 가드 4종 0 · 테스트 1714 passed (신규 8) · coverage 37.43/30.58/47.52/37.94 (threshold 통과)
- Stakes: production (npm 배포 패키지 — 신호 없음, 기본 상향)
- source: 2026-08-02 저장소 리뷰 (build/test/validation 스크립트 실측 기반)
- baseline: build exit 0 · 95 test files / 1706 passed · validation 4종 통과 · coverage 37.4% stmts / 30.58% branch / 47.47% funcs / 37.92% lines

## Done의 정의

아래 전부가 동시에 참일 때 완료다.

1. `pnpm build` exit 0
2. `pnpm test` — 1706개 전부 통과 (신규 테스트 추가는 허용, 회귀 0)
3. `pnpm lint` exit 0 — 신규 도입
4. validation 4종 전부 exit 0
5. `pnpm test:coverage` 가 threshold 게이트를 통과
6. CI 워크플로가 위 1~5를 PR에서 전부 실행

---

## P1 — 자기 규칙의 기계화

### REQ-repo-hygiene-001: 결정론적 린터 도입
`oxlint` 을 devDependency 로 추가하고 `.oxlintrc.json` 에 CLAUDE.md 하드룰을 기계 규칙으로 옮긴다.
- 규칙: `no-explicit-any`, `no-console`(허용 경로 예외), `max-lines-per-function`(50), `max-depth`(3), `max-params`(5), `complexity`(10)
- 허용 경로: `src/cli/**`, `hooks/scripts/**` 는 `no-console` 예외 — `.vibe/config.json` 의 `qualityCheck.consoleAllow` 가 이미 선언한 정책과 일치시킨다
- `package.json` 에 `"lint": "oxlint"` 스크립트 추가
- **선정 근거**: 포매터를 겸하는 biome 은 296개 파일을 재포맷해 거대한 diff 를 만든다. 이 SPEC 의 목표는 규칙 강제이지 스타일 통일이 아니므로 린트 전용 도구를 쓴다.
- AC: `pnpm lint` 가 exit 0 이고, `any` 를 넣은 파일을 추가하면 exit 1 이 된다.
- AC: CLAUDE.md 가 "model-judged, not hook-detected" 라고 적은 복잡도 4종이 실제로 기계 판정된다 — 해당 문구를 갱신한다.

### REQ-repo-hygiene-002: 드리프트 가드 4종을 CI 에 연결
`gen:skill-docs:check` · `sync:agent-models:check` · `validate:skill-invocation` · `validate:counts` 는 전부 존재하고 전부 통과하지만 `test.yml` 이 실행하지 않는다.
- `.github/workflows/test.yml` 에 `verify` job 추가 — lint + validation 4종
- AC: PR 에서 SKILL-CATALOG.md 를 손으로 고치면 CI 가 실패한다.

### REQ-repo-hygiene-003: README 드리프트 제거 + 재발 방지
002 의 부재로 이미 발생한 드리프트를 고치고, 같은 종류가 다시 통과하지 못하게 한다.
- `README.md:10` — 영문 리드 문단의 "Cursor" 제거 (`30eb6e7` 에서 지원 삭제됨)
- `README.md:192`, `README.en.md:220` — 지원 하네스 표의 Cursor 행 제거
- `README.md:7`, `README.en.md:7` — Node 배지 `>=18` → `>=20.12` (같은 파일 225·257행 및 `engines` 와 자기모순 상태)
- `scripts/validate-counts.ts` 확장: **하네스 목록**과 **엔진 버전**을 SSOT 대조 항목으로 추가
- AC: README 에 Cursor 를 다시 넣거나 배지 버전을 engines 와 어긋나게 하면 `validate:counts` 가 exit 1 이 된다.

---

## P2 — 재현성과 배포 안전

### REQ-repo-hygiene-004: `tsx` 를 devDependency 로 고정
4개 스크립트가 `npx tsx` 로 실행돼 매번 네트워크에서 미고정 버전을 받아온다 (실측: `tsx@4.23.4` 설치 발생). `pnpm-lock` 의 재현성 보장이 이 지점에서 끊긴다.
- devDependencies 에 `tsx` 추가, 4개 스크립트에서 `npx ` 제거
- AC: 네트워크 없이 `pnpm run validate:counts` 가 동작한다.

### REQ-repo-hygiene-005: postinstall self-install 가드
저장소에서 `pnpm install` 하면 postinstall 이 실행돼 개발자의 **전역 홈**을 덮어쓴다 (실측: `~/.claude` 에 에이전트 7개 설치, `~/.vibe` 생성, 전역 settings 수정).
- `src/cli/postinstall/main.ts` 에 self-install 감지 — `INIT_CWD` 가 이 패키지 저장소 루트면 skip
- skip 시 1줄 안내 출력 후 exit 0 (`vibe upgrade` 로 명시 설치 유도)
- AC: 저장소에서 `pnpm install` 해도 `~/.claude`·`~/.vibe` 가 변경되지 않는다.

### REQ-repo-hygiene-006: 커버리지 threshold 게이트
커버리지가 측정만 되고 하한선이 없다.
- `vitest.config.ts` 에 현재 실측치를 바닥으로 하는 `thresholds` 추가 (라쳇: 회귀 방지용이지 목표치가 아님)
- CI 에 coverage job 추가
- AC: 커버리지가 baseline 아래로 떨어지면 CI 가 실패한다.

### REQ-repo-hygiene-007: CI Node 매트릭스
`test.yml` 은 Node 20 단일, `release.yml` 은 Node 24 에서 publish — **배포 산출물이 CI 에서 한 번도 검증되지 않은 런타임에서 나온다.** `better-sqlite3` 네이티브 바인딩 때문에 실제 위험이 있다.
- build·test job 을 `[20, 22, 24]` 매트릭스로 확장
- AC: 세 런타임 전부에서 build + test 가 통과한다.

### REQ-repo-hygiene-008: `moduleResolution` 이행
`node`(node10)는 TS 6 에서 이미 `TS5107` 에러이고 TS 7 에서 동작 중단이다. 더 중요한 건 소비자 쪽 — `exports` 서브패스 맵(`./tools`, `./memory` 등)의 타입이 `bundler`/`node16` 소비자에서 해석되지 않을 수 있다.
- `tsconfig.json` 을 `nodenext` 계열로 이행 (실패 시 `bundler` 로 폴백, 선택 근거를 커밋 메시지에 기록)
- AC: `pnpm build` exit 0, `pnpm test` 회귀 0
- AC: 서브패스 export 의 `.d.ts` 가 `node16` 해석 소비자에서 잡힌다 (테스트로 고정)

---

## P3 — 관측성과 위생

### REQ-repo-hygiene-009: 테스트 출력 정숙화
1706개가 통과하는 동안 CLI 배너·`[?25l` 커서 제어 시퀀스·스피너·가드 경고가 stdout 으로 쏟아져 실제 실패 신호가 묻힌다.
- vitest `silent: 'passed-only'` 적용 — 통과 테스트의 출력은 감추고 실패 시에는 보존
- `@clack/prompts` 의 raw `process.stdout.write` 가 남으면 setup 파일에서 추가 차단
- AC: 전체 통과 시 출력이 요약 위주이고, 의도적으로 실패시킨 테스트의 출력은 그대로 보인다.

### REQ-repo-hygiene-010: CLI 출력 일원화
`src/cli/utils.ts:26` 의 `log()` 래퍼가 있는데 296개 호출이 우회한다 (225개가 `src/cli/commands`, 13개 파일). 출력 모드(`--quiet`/`--json`)를 나중에 붙일 수 없는 상태다.
- `log()` 를 quiet 플래그를 존중하도록 확장하고 `src/cli/commands/**` 의 `console.log` 를 이관
- 대화형 TUI(`@clack/prompts`) 경로는 대상 외 — 별개 출력 채널이다
- AC: `console.log` 직접 호출이 `src/cli/commands` 에서 0건이고, 기존 출력 문자열은 바이트 단위로 동일하다 (테스트 1건이 console 을 spy 한다 — `info.test.ts`)

### REQ-repo-hygiene-011: SessionStart 휘발 블록 후치
`session-start.js:99` 가 현재 시각을 필두로 24h 액션 카운트·pending 개수·버전 체크 결과를 세션 컨텍스트 **앞단**에 주입한다. CLAUDE.md 는 "`/new` 가 KV prefix cache 를 전량 폐기하므로 캐시 재사용을 늘린다"고 명시하는데, 앞단 블록이 매 세션 달라지면 세션 간 프리픽스 재사용이 구조적으로 불가능하다.
- 안정 블록(메모리 인덱스·recipes·anti-patterns)을 먼저, 휘발 블록(시각·카운터·버전·autonomy)을 뒤로 재배치
- **측정되지 않은 부분은 주장하지 않는다** — 하네스가 SessionStart 출력을 프롬프트 어디에 합성하는지는 미확정이므로, 이 변경의 근거는 "휘발 데이터를 뒤로 보내는 것이 어떤 합성 방식에서도 나쁘지 않다"까지만이다. 캐시 적중 개선 수치는 주장하지 않는다.
- AC: 출력 내용은 동일하고 순서만 바뀐다 (기존 테스트 회귀 0)

### REQ-repo-hygiene-012: 훅 예외를 stderr 로
`session-start.js` 의 `console.log('[Session] Error:', e.message)` 는 훅 실패를 **모델에게 주입되는 컨텍스트 문자열**로 바꾼다. `30eb6e7` 커밋이 스스로 강조한 "가드의 생사가 관측 가능해야 한다"와 어긋난다.
- `console.error` 로 전환. 동일 패턴을 다른 훅 스크립트에서도 점검
- AC: 훅 예외가 stdout 컨텍스트를 오염시키지 않는다.

### REQ-repo-hygiene-013: star-gate 워크플로 조정
`.github/workflows/star-gate.yml` 이 스타를 누르지 않은 작성자의 이슈/PR 에 봇 댓글을 단다. **유지보수자의 정책 결정 사항** — 승인 시점에 선택을 확정한다.

### REQ-repo-hygiene-014: 대형 파일 — 측정 후 판단
`codex-proxy.ts`(1143줄), `clone-extract.js`(1306줄).
- **줄 수만으로 쪼개지 않는다.** CLAUDE.md 의 최적화 규칙("측정 없이 최적화하지 않는다")과 "요청 범위만 수정" 하드룰에 따라, REQ-001 이 도입한 복잡도 규칙(함수 50줄·중첩 3·파라미터 5·복잡도 10)의 **실제 위반만** 수정한다.
- 위반이 0건이면 파일 크기는 결함이 아니라고 기록하고 넘어간다.
- AC: 린터가 보고한 위반 건수와 조치 결과가 명시된다.

---

## 범위 밖 (명시적 제외)

- 스타일 재포맷 (biome/prettier 도입) — 규칙 강제와 무관한 거대 diff
- `src/cli/commands` 외의 `console.log` 71건 — 대화형 TUI·postinstall 진행 출력은 별개 채널
- 대형 파일의 구조적 분해 — REQ-014 참조 (측정 기반으로만 판단)
