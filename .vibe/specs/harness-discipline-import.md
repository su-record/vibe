# SPEC: harness-discipline-import — dsh 규율 3종 이식

- **Created**: 2026-09-02
- **Status**: VERIFIED (2026-09-02 — verify-ledger verifyPassed=true, runId c65cabee)
- **Class**: process
- **Stakes**: production — 배포되는 저장소의 규약·CI 게이트·CLAUDE.md SSOT 를 바꾼다
- **Tech Stack**: TypeScript (ESM), Vitest, oxlint, GitHub Actions, Markdown

---

## 1. Overview / Goal

deepseek-harness(dsh) 분석에서 도출한 규율 3종을 vibe 저장소에 **우리 규모로** 이식한다:
(1) SPEC 이 VERIFIED 이후 썩는 것을 막는 lifecycle 헤더 규율 + 결정론적 게이트,
(2) 프리픽스 캐시에 실제로 실리는 자산을 한 문서에 고정하고 양방향 드리프트를 막는 게이트,
(3) CLAUDE.md ↔ AGENTS.md 를 결정론적으로 생성해 `--check` 로 고정하는 게이트.

세 항목의 공통 목표는 하나다 — **선언된 규약을 사람이 지키는 것에서 명령이 판정하는 것으로 옮긴다.**

### Context Sources

| 등급 | 뜻 |
|---|---|
| `[확인]` | 코드·문서에서 직접 읽었다 |
| `[해석]` | 읽은 것에서 추론했다 |
| `[모름]` | 확인하지 못했다 |

- [확인] `.vibe/specs/**/*.md` 29개 중 **20개에 Status 줄이 아예 없다.** 남은 9개의 값은 5가지 형태로 갈라져 있다: `APPROVED`(4, 그중 2개는 후행 공백), `COMPLETE`(1), `VERIFIED`(1), 소문자 `verified`(1), `APPROVED (…) · Implemented …`(2). `vibe/templates/spec-template.md` 는 `DRAFT | APPROVED` 만 선언한다 — 선언과 실물이 이미 어긋나 있다
- [확인] `src/tools/spec/validateSpecDocument.ts:37-38` — `STAKES_LINE` 정규식과 `VALID_STAKES` 배열로 Stakes 만 닫힌 집합 검사를 한다. Status 검사는 없다
- [확인] `src/tools/spec/validateSpecDocument.ts` 는 `vibe.spec` 의 SPEC Code Guard 에서 **단일 파일**로만 호출된다 — `.vibe/specs/` 전수를 도는 진입점이 저장소에 없다
- [확인] `scripts/` 13개 · `.github/workflows/test.yml` 4 job(build / test / verify / coverage). test job 이 드리프트 가드 7종을 돌린다. `AGENTS.md` 를 읽거나 검증하는 스크립트는 `scripts/`·`src/` 어디에도 없다 (`grep -rln "AGENTS.md"` 0건)
- [확인] `hooks/hooks.json` 의 프리픽스 영향 이벤트는 둘뿐이다 — `SessionStart`: `session-start.js` 1개, `UserPromptSubmit`: `prompt-dispatcher.js` 1개. 나머지(PreToolUse 4 · PostToolUse 2 · Notification 3 · Stop 1)는 턴 중간 이벤트다
- [확인] 상시 로드 자산 수: `skills/` 52 (frontmatter description 만 상시) · `agents/` 9 (frontmatter description 만 상시) · 루트 `CLAUDE.md` 212줄 / `AGENTS.md` 209줄 (전문 상시)
- [확인] **AGENTS.md 드리프트 2건 실재**: L34 가 `$vibe lint:ratchet` 인데 CLAUDE.md L38 은 `pnpm lint:ratchet` 이다 — 셸 명령을 슬래시 명령으로 과잉 번역했다. L103 은 `/vibe` 디스패처로 남아 있다 — 번역 규칙상 `$vibe` 여야 하는데 미번역이다. 한 파일 안에 과잉·미번역이 공존한다
- [확인] **단순 치환 생성은 성립하지 않는다** — CLAUDE.md 에 `references/agent.md` 의 치환 4종 + `/vibe.*` → `$vibe.*` 를 그대로 적용해 실제 AGENTS.md 와 대조한 결과 오탐이 대량 발생한다: `@su-record/vibe`, `plugins/vibe/`, `.claude/vibe/`, `claude plugin marketplace add su-record/vibe` 가 전부 파괴된다. 또한 AGENTS.md 가 **의도적으로 보존**하는 `Claude Code` 언급이 6곳 있고(플러그인 매니페스트·마켓플레이스·Workflow 도구·`agents/*.md` 평면 스캔 — 3자 사실이지 "현재 하네스"가 아니다), `.claude/settings.local.json`·`${CLAUDE_PLUGIN_ROOT}`·Quality SSOT 표의 `CLAUDE.md` 도 보존 대상이다
- [확인] `skills/vibe.docs/references/agent.md` Step 4 의 치환 목록에 `/vibe.*` → `$vibe.*` 규칙이 **빠져 있다** — CLAUDE.md 서문은 그 규칙을 선언한다. 번역 규칙 자체가 두 집에 갈라져 있고 서로 다르다
- [확인] resume 감지는 `collectDispatchSignals()` 가 `.vibe/specs/<feature>.md` **평면 경로**를 본다 — 경로 구조를 바꾸면 이 함수와 스킬 본문의 모든 참조가 함께 깨진다
- [확인] 저장소는 이미 라쳇 관용구를 쓴다 — `.oxlint-baseline.json` + `pnpm lint:ratchet`(부채 상한, 줄이는 방향으로만 갱신)
- [확인] dsh 원본: Agent Note 1,702개, 닫힌 클래스 6종(feature/bug-fix/simplification/architecture/process/testing), 검증 스크립트 3종, 헤더 3줄 고정. 게이트 없는 코드블록 하나(루트 AGENTS.md 레이아웃 트리)만 무너져 존재하지 않는 그룹 2개를 나열하고 실제 50개 중 17개를 누락했다 — 같은 사실의 다른 집인 `packages/README.md` 는 게이트가 걸려 있어 50개 전부 정확했다
- [해석] 우리 규모(SPEC 29개)에서 dsh 의 `{lifecycle}/{class}/` **경로 인코딩**은 비용만 남는다 — 1,702개를 훑을 때는 경로가 인덱스 역할을 하지만, 29개는 헤더 필드로 충분하고 경로 변경은 위 resume 감지를 건드린다
- [모름] `session-start.js`·`prompt-dispatcher.js` 가 실제로 stdout 에 주입하는 바이트 수 — 스크립트가 조건부로 출력하므로 정적으로 계측할 수 없다. 문서에는 "무엇을 주입하는가"를 적고 크기는 적지 않는다

### Assumptions

3-a 커버리지 스윕에서 열거한 결정 지점 중 기본값을 채택한 항목 전부:

1. **(1) 의 적용면** → `.vibe/specs/` 평면 경로를 **유지**하고 lifecycle 을 헤더 필드로 표현한다. `.vibe/decisions/` 신설도 경로 이전도 하지 않는다 (되돌림: 싸다)
2. **닫힌 Status 집합** → `DRAFT | APPROVED | VERIFIED | SUPERSEDED | REJECTED` 5종. dsh 의 proposed/implemented/rejected 를 vibe 어휘로 사상하고, 승인 게이트가 있는 우리 흐름에 맞춰 APPROVED 를 분리했다. 기존 `COMPLETE`·소문자 `verified` 는 백필로 정규화한다
3. **닫힌 Class 집합** → dsh 의 6종을 그대로 채택: `feature | bug-fix | simplification | architecture | process | testing`
4. **Class 의 소비자** → 장식 필드로 두지 않는다. `Anchors` 필수 여부를 Class 로 판정한다 (아래 5)
5. **Anchors 요구 범위** → `Status: VERIFIED` **이고** `Class ∈ {feature, bug-fix, architecture}` 인 SPEC 에만 `## Anchors` 절을 요구한다. 게이트는 나열된 경로가 실제로 존재하는지 검사한다 — 이것이 "VERIFIED 이후 썩음"을 잡는 실제 기구다. process/testing/simplification 은 코드 경로에 고정되지 않는 경우가 많아 면제한다
6. **분할 SPEC** → `_index.md` 만 헤더를 요구하고 `phase-N-*.md` 는 면제한다 (헤더가 폴더당 한 벌인 현행 구조 유지)
7. **레거시 백필 방식** → 베이스라인/라쳇 파일을 만들지 않고 **29개 전부를 지금 백필한다.** 규모가 작아 예외 목록 유지비가 백필비보다 크다
8. **(2) 의 적용 단위** → 스킬 52개 본문에 섹션을 강제하지 않는다. **프리픽스에 실제로 실리는 표면만** `vibe/rules/prefix-cache-surface.md` 한 문서에 모은다. 상시 로드되는 것은 스킬 *본문*이 아니라 frontmatter description 이므로, 본문에 섹션을 넣는 것은 캐시 회귀와 무관하고 파일 52개를 부풀리기만 한다
9. **(2) 게이트의 판정 방식** → 파일시스템에서 표면을 열거해 문서와 **양방향** 대조한다 (문서에 없는 실물 = 실패, 실물 없는 문서 항목 = 실패). dsh 가 무너진 지점이 정확히 단방향이었다
10. **(3) 의 판정 방식** → **결정론적 생성 + `--check`**. 느슨한 헤딩 비교는 위 드리프트 2건(같은 문단 안 토큰 차이)을 원리적으로 못 잡는다
11. **(3) 의 규칙 위치** → 치환·보호·예외 규칙을 `scripts/agents-md-rules.json` 한 곳에 둔다. CLAUDE.md 본문에 마커 주석을 심지 않는다 — CLAUDE.md 는 상시 로드 자산이라 주석이 그대로 프리픽스 비용이다 (항목 8 과 같은 논거)
12. **(3) 의 규칙 부패 방지** → `overrides` 의 각 항목은 정확히 1회 매치해야 한다. 0회 또는 2회 이상이면 게이트 실패 — 규칙이 대상을 잃고도 조용히 남아 있는 상태를 금지한다
13. **AGENTS.md 는 생성물이 된다** → 손편집 금지. 현행 AGENTS.md 와 의미가 다른 줄은 규칙(overrides)으로 흡수하고, 드리프트 2건은 해소한다
14. **`references/agent.md` 처리** → 치환 목록을 본문에 다시 적지 않고 `scripts/agents-md-rules.json` 을 SSOT 로 가리킨다. 규칙이 두 집에 갈라진 현 상태를 그대로 두지 않는다
15. **GEMINI.md** → 저장소에 존재하지 않으므로 게이트 대상에서 제외한다. 규칙 파일 구조는 하네스를 늘릴 수 있게 두되 이번에 추가하지 않는다
16. **게이트 배선 위치** → 세 게이트 모두 CI `test` job 의 드리프트 가드 블록에 추가한다. `gen:agents-md:check` 와 `validate:cache-surface` 는 `verify:all` 에도 넣어 로컬에서 한 번에 돌게 한다
17. **스크립트 구현 형태** → 기존 `scripts/*.ts` 관용구를 따른다 (ESM, `.js` 확장자 import, `--check` 플래그, exit code 로 판정)
18. **커밋 강제 훅** → PreCommit/PreToolUse 훅으로 강제하지 않는다. 훅은 프로젝트 로컬 아티팩트라 설치 여부로 판정이 갈리고, 판정은 CI 가 SSOT 여야 한다
19. **수치 파라미터** → 새 임계값을 도입하지 않는다. 게이트는 전부 이진 판정(존재/일치/닫힌 집합)이다
20. **하위 호환** → 기존 명령·경로·공개 API 를 바꾸지 않는다. 추가되는 것은 헤더 필드 3종과 npm script 4종뿐이다
21. **테스트 위치** → 판정 로직의 단위 테스트는 기존 관용구대로 `src/` 의 대응 모듈 테스트에 둔다. 게이트의 음성 검증(고의 위반 → 실패)은 픽스처 문자열로 한다 — 저장소 실파일을 훼손하지 않는다
22. **실패 시 사용자에게 보이는 것** → 세 게이트 모두 "무엇이 어긋났는가 + 어느 파일 + 고치는 명령" 3요소를 낸다. 기존 드리프트 가드의 출력 형태를 따른다
23. **부하가 늘면 먼저 깨지는 곳** → `validate:cache-surface` 의 양방향 대조는 자산이 늘수록 문서 갱신을 요구한다. 스킬이 52→100 이 되어도 문서가 커지지 않도록 개별 스킬을 열거하지 않고 **클래스와 집합 규칙만** 고정한다

### Constraints

- `.vibe/specs/` 의 **평면 경로 구조를 바꾸지 않는다** — `collectDispatchSignals()` 의 resume 감지와 스킬 본문의 모든 `.vibe/specs/<feature>.md` 참조가 이 경로에 묶여 있다
- 상시 로드 자산(`CLAUDE.md`/`AGENTS.md`/frontmatter)에 **순증 토큰을 최소화한다** — 이 SPEC 의 항목 (2) 가 지키려는 것이 바로 그 표면이다
- 닫힌 집합의 정의는 **코드 한 곳**에만 산다 (`src/tools/spec/validateSpecDocument.ts`). CI 스크립트는 그것을 import 한다 — 상수를 복사하면 그 순간 두 벌이 된다
- 신규 스크립트는 `pnpm lint` + `pnpm lint:ratchet` 를 통과해야 한다 — 복잡도 부채를 늘리지 않는다
- 세 게이트는 전부 **결정론적**이어야 한다: 같은 입력 → 같은 exit code. 네트워크·시각·모델 호출 금지

### Rejected Alternatives (Traps)

- **`.vibe/specs/` 를 `{lifecycle}/{class}/yyyy-mm-dd-topic.md` 로 이전** — `collectDispatchSignals()` 가 `.vibe/specs/<feature>.md` 평면 경로를 직접 조합해 존재 검사를 한다. 경로가 바뀌면 resume 감지가 조용히 `none` 을 반환하고 사용자는 진행 중인 작업을 잃은 채 처음부터 다시 시작한다. 설치본 스킬 본문의 참조까지 동시에 갈아야 해서 원자적 이전이 불가능하다
- **`.vibe/decisions/` 병렬 신설** — 같은 사실(무엇을 왜 정했는가)의 집이 `.vibe/specs/` 와 둘이 된다. 이 SPEC 의 항목 (3) 이 금지하려는 바로 그 형태이고, 어느 쪽이 최신인지 판정할 기계적 수단이 없다
- **52개 스킬 본문에 `Model Experience`/`KV Cache effect` 섹션 강제** — 스킬 본문은 상시 로드되지 않는다(frontmatter description 만 로드). 캐시 회귀와 무관한 파일 52개에 섹션을 넣으면 통과 의식이 되고, 정작 프리픽스에 실리는 훅 stdout 은 여전히 문서화되지 않는다
- **헤딩·구조만 비교하는 느슨한 AGENTS.md 게이트** — 실재하는 드리프트 2건은 둘 다 *같은 문단 안의 토큰 하나* 차이다. 헤딩 비교는 이 클래스를 원리적으로 통과시킨다
- **CLAUDE.md 에 마커 주석을 심어 AGENTS.md 대응 블록을 인라인 보관** — SSOT 로는 깔끔하지만 CLAUDE.md 는 매 세션 프리픽스에 통째로 실린다. 주석 블록 6개가 영구 토큰 비용이 되며, 이 SPEC 이 항목 (2) 로 지키려는 표면을 스스로 늘린다
- **`AGENTS.md` 를 보호 토큰 없이 단순 치환으로 생성** — 실측 대조 결과 `@su-record/vibe`·`plugins/vibe/`·`.claude/vibe/`·마켓플레이스 명령이 전부 파괴되고, 보존해야 할 `Claude Code` 3자 언급 6곳이 오역된다
- **베이스라인/라쳇으로 레거시 SPEC 29개를 면제** — 예외 목록 자체가 유지 대상이 되고 "언젠가 갚는다"가 영구 면제가 된다. 라쳇은 `.oxlint-baseline.json` 처럼 지금 갚을 수 없는 규모일 때만 정당하다
- **훅으로 커밋 시점에 강제** — 훅은 프로젝트 로컬 아티팩트라 설치 여부로 판정이 갈린다. 같은 저장소가 사람에 따라 다르게 판정되면 그건 게이트가 아니다

---

## 2. Requirements

| ID | Requirement | Done Criteria |
|----|-------------|---------------|
| REQ-harness-discipline-import-001 | SPEC 헤더에 닫힌 집합 `Status`·`Class` 를 요구하고, VERIFIED + 코드성 Class 인 SPEC 에는 실존하는 `## Anchors` 경로를 요구한다. 판정은 `validateSpecDocument` 가 소유하고 CI 스크립트가 `.vibe/specs/**` 전수를 돈다 | D1, D2, D3, D9 |
| REQ-harness-discipline-import-002 | 기존 `.vibe/specs/**/*.md` 29개를 새 헤더 규약으로 백필한다 (Status 20건 신규·9건 정규화, Class 29건 신규) | D2 |
| REQ-harness-discipline-import-003 | 프리픽스 캐시에 실리는 표면을 `vibe/rules/prefix-cache-surface.md` 한 문서에 클래스 단위로 고정하고, 각 항목에 `Model Experience`·`KV Cache effect` 를 기록한다 | D4, D9 |
| REQ-harness-discipline-import-004 | `scripts/validate-cache-surface.ts` 가 파일시스템 실물과 문서를 **양방향** 대조해 어느 쪽의 누락도 실패로 만든다 | D4, D9 |
| REQ-harness-discipline-import-005 | `scripts/gen-agents-md.ts` 가 CLAUDE.md 에서 AGENTS.md 를 결정론적으로 생성하고 `--check` 로 드리프트를 막는다. 규칙(보호 토큰·치환·예외 블록)은 `scripts/agents-md-rules.json` 한 곳에 산다 | D5, D6, D9 |
| REQ-harness-discipline-import-006 | 규칙 자체의 부패를 막는다 — `overrides` 항목이 정확히 1회 매치하지 않으면 게이트가 실패한다 | D5 |
| REQ-harness-discipline-import-007 | 세 게이트를 CI(`test.yml`)와 `verify:all` 에 배선하고, CLAUDE.md 의 Release Gates 표·`spec-template.md`·`references/agent.md` 를 새 규약에 맞춘다 | D7, D8 |

---

## 3. Done Criteria (deterministic gates)

| # | Criterion | Verified by |
|---|-----------|-------------|
| D1 | 빌드와 전체 테스트가 통과한다 | `npm run build && npx vitest run` exit 0 |
| D2 | `.vibe/specs/**/*.md` 29개(분할 `_index.md` 포함, `phase-N-*` 면제)가 새 헤더 규약을 통과한다 | `npm run validate:spec-lifecycle` exit 0 |
| D3 | lifecycle 게이트가 위반을 실제로 잡는다 — 닫힌 집합 밖 Status, 누락 Class, 존재하지 않는 Anchors 경로 각각에서 실패한다 | 픽스처 단위 테스트 3건 통과 (`npx vitest run src/tools/spec/validateSpecDocument.test.ts`) |
| D4 | 캐시 표면 게이트가 통과하고 양방향 대조가 동작한다 — 문서에서 항목 1개를 지우면 실패, 실물 없는 항목을 넣어도 실패 | `npm run validate:cache-surface` exit 0 + 픽스처 단위 테스트 2건 통과 |
| D5 | `npm run gen:agents-md:check` 가 exit 0 이고, CLAUDE.md 한 줄을 바꾸면 exit 1 이며, `overrides` 항목이 0회/2회 매치하면 exit 1 이다 | `npm run gen:agents-md:check` exit 0 + 픽스처 단위 테스트 3건 통과 |
| D6 | 드리프트 2건이 해소된다 — AGENTS.md 에 셸 명령 `pnpm lint:ratchet` 가 살아 있고 과잉 번역형 `$vibe lint:ratchet` 는 0건이며, Dual-Harness Doctrine 절이 `$vibe` 디스패처를 쓴다 | `grep -c 'pnpm lint:ratchet' AGENTS.md` ≥ 1 (실측 2 — 제목 줄 + `--update` 줄) · `grep -c '\$vibe lint:ratchet' AGENTS.md` = 0 · ``grep -c '추론은 `$vibe` 디스패처가 앞단에서' AGENTS.md`` = 1 |
| D7 | 세 게이트가 CI 에 배선됐다 | `.github/workflows/test.yml` 의 test job 에서 `validate:spec-lifecycle`·`validate:cache-surface`·`gen:agents-md:check` 3줄 존재 (`grep -c` 합 = 3) |
| D8 | 로컬 통합 게이트가 통과한다 | `npm run verify:all` exit 0 |
| D9 | 신규 스크립트가 lint 와 복잡도 라쳇을 통과한다 (부채 증가 0) | `pnpm lint` exit 0 && `pnpm lint:ratchet` exit 0 |

### Evidence Required

- D1 → `npm run build && npx vitest run` 의 종료 코드와 테스트 요약 줄
- D2 → `npm run validate:spec-lifecycle` 출력(검사한 파일 수 포함)과 종료 코드
- D3 → vitest 결과에서 신규 3 테스트의 이름과 pass 표시
- D4 → `npm run validate:cache-surface` 출력과 종료 코드 + 신규 2 테스트 pass
- D5 → `npm run gen:agents-md:check` 종료 코드 + 신규 3 테스트 pass
- D6 → 위 세 grep 명령의 출력값 (실측: 2 / 0 / 1). 상한을 고정하지 않는 이유는 첫 값이 **선택**(문서가 그 명령을 몇 번 언급하는가)이고 불변식은 "과잉 번역형이 0건"이기 때문이다
- D7 → `.github/workflows/test.yml` 의 해당 3줄 인용 (파일:줄번호)
- D8 → `npm run verify:all` 종료 코드
- D9 → `pnpm lint` / `pnpm lint:ratchet` 종료 코드와 라쳇 요약

### Human Taste (Non-Blocking)

- `vibe/rules/prefix-cache-surface.md` 가 처음 읽는 사람에게 "무엇이 캐시를 깨뜨리는가"를 실제로 이해시키는가 — 릴리스 판단, 완료 게이트 아님
- 게이트 실패 메시지가 고치는 방법까지 알려주는가 — 형식은 D 로 판정하지만 문구의 친절함은 사람 판단

---

## 4. Scenarios

```gherkin
Scenario: 닫힌 집합 밖 Status 를 거부한다
  Given SPEC 헤더의 Status 가 "COMPLETE" 다
  When validate:spec-lifecycle 를 실행한다
  Then 비정상 종료하고 허용된 5개 값을 출력한다

Scenario: Class 누락을 거부한다
  Given SPEC 헤더에 Class 줄이 없다
  When validate:spec-lifecycle 를 실행한다
  Then 비정상 종료하고 닫힌 6개 Class 를 출력한다

Scenario: VERIFIED SPEC 의 죽은 Anchor 를 잡는다
  Given Status 가 VERIFIED 이고 Class 가 feature 인 SPEC 의 Anchors 에 삭제된 경로가 있다
  When validate:spec-lifecycle 를 실행한다
  Then 비정상 종료하고 존재하지 않는 경로를 지목한다

Scenario: process Class 는 Anchors 를 요구받지 않는다
  Given Status 가 VERIFIED 이고 Class 가 process 인 SPEC 에 Anchors 절이 없다
  When validate:spec-lifecycle 를 실행한다
  Then 정상 종료한다

Scenario: 저장소의 모든 SPEC 이 규약을 만족한다
  Given 29개 SPEC 파일이 백필된 상태다
  When validate:spec-lifecycle 를 실행한다
  Then 정상 종료하고 검사한 파일 수를 보고한다

Scenario: 문서에 없는 실물 표면을 잡는다
  Given hooks.json 의 SessionStart 훅이 prefix-cache-surface.md 에 없다
  When validate:cache-surface 를 실행한다
  Then 비정상 종료하고 누락된 훅 이름을 출력한다

Scenario: 실물 없는 문서 항목을 잡는다
  Given prefix-cache-surface.md 가 존재하지 않는 에이전트를 나열한다
  When validate:cache-surface 를 실행한다
  Then 비정상 종료하고 그 항목을 지목한다

Scenario: AGENTS.md 가 CLAUDE.md 와 일치한다
  Given CLAUDE.md 와 규칙 파일이 현재 상태다
  When gen:agents-md:check 를 실행한다
  Then 정상 종료한다

Scenario: CLAUDE.md 만 수정하면 드리프트로 잡힌다
  Given CLAUDE.md 의 한 줄이 바뀌고 AGENTS.md 는 그대로다
  When gen:agents-md:check 를 실행한다
  Then 비정상 종료하고 재생성 명령을 안내한다

Scenario: 대상을 잃은 override 규칙을 잡는다
  Given agents-md-rules.json 의 override 하나가 CLAUDE.md 에서 매치되지 않는다
  When gen:agents-md:check 를 실행한다
  Then 비정상 종료하고 그 규칙을 지목한다

Scenario: 실재하던 번역 드리프트 2건이 사라진다
  Given 생성된 AGENTS.md 가 저장소에 반영됐다
  When 번역 대상 토큰을 grep 한다
  Then pnpm lint:ratchet 는 있고 $vibe lint:ratchet 는 없으며 Doctrine 절은 $vibe 디스패처를 쓴다
```

시나리오 → Done Criteria 매핑: 1~3 → D3 · 4~5 → D2 · 6~7 → D4 · 8~10 → D5 · 11 → D6.

---

## 5. Out of Scope

- `.vibe/specs/` 의 경로 구조 변경 및 `.vibe/decisions/` 신설 (Rejected Alternatives 참조)
- 스킬 52개 본문에 `Model Experience`/`KV Cache effect` 섹션 강제
- per-file 100% 커버리지 게이트 도입 — dsh 의 이 규율은 우리 규모에 맞지 않는다
- `GEMINI.md` 생성·검증 (저장소에 파일 없음)
- 커밋 시점 강제 훅(PreCommit/PreToolUse) 추가
- 기존 SPEC 본문의 내용 갱신 — 이번 백필은 **헤더 필드와 Anchors 절만** 손댄다
- 복잡도 부채(`.oxlint-baseline.json`) 상환
- dsh 의 archived 영구 동결(append-only 매니페스트 + 사이드카 해시) 이식

---

## 6. Verification

- `/vibe.run "harness-discipline-import"` 가 시나리오 단위로 구현·즉시 검증한다.
- `/vibe.verify "harness-discipline-import"` 가 D1~D9 를 판정하고 `.vibe/metrics/run-ledger.json` 의 `verifyPassed` 를 기록한다.
- 게이트 = D1~D9 전부 통과. 모델 자기 보고는 판정 입력이 아니다.

---

## Anchors

Class 가 `process` 라 게이트가 요구하지는 않지만, 이 SPEC 은 실제로 코드에 안착했다.
경로를 적어 두면 게이트가 "코드가 움직였는데 SPEC 이 따라오지 않았다" 를 잡는다 —
규율을 도입한 SPEC 자신이 그 규율을 통과하지 못하면 도입할 이유가 없다.

- `src/tools/spec/specLifecycle.ts`
- `src/tools/docs/cacheSurface.ts`
- `src/tools/docs/agentsMd.ts`
- `scripts/validate-spec-lifecycle.ts`
- `scripts/validate-cache-surface.ts`
- `scripts/gen-agents-md.ts`
- `scripts/agents-md-rules.json`
- `vibe/rules/prefix-cache-surface.md`
