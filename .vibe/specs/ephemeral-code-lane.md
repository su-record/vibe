# SPEC: 일회성 코드 레인 (lifetime 축)

- **Created**: 2026-09-02
- **Status**: VERIFIED (2026-09-02 — 게이트 전량 exit 0)
- **Class**: feature
- **Stakes**: production — 품질 게이트를 면제하는 경로를 만든다. 잘못 만들면 게이트 회피 구멍이 된다
- **Tech Stack**: Node.js (ESM, 훅 스크립트), Vitest

---

## 1. Overview / Goal

논문은 코드가 "생성되고 실행되고 폐기되는 일회성 도구" 가 된다고 본다. vibe 에는 그 개념이 없다 —
vibe 가 만지는 모든 코드는 커밋·린트·복잡도·회귀 게이트를 통과한다. 분석 스크립트 하나를 써도
같은 무게가 붙는다.

이 SPEC 은 `lifetime` 축을 연다: `durable`(기본) | `ephemeral`.

> **이 항목은 원래 "열지 말자" 로 판단했던 것이다** (`.vibe/todos/agentic-paradigm-gaps-2026-09-02.md`).
> 사유 둘: 저장소에 실수요 사례가 없고, 게이트 회피 구멍이 된다. 사용자 지시로 진행하되
> **두 번째 사유는 설계로 막는다** — 이 SPEC 의 대부분이 그 방어에 쓰인다.

방어의 핵심 한 줄: **일회성 판정을 모델이 아니라 경로가 한다.** "이건 일회성이라 린트 면제" 를
모델이 판정하면 축이 아니라 뒷문이다. 경로가 판정하면 면제 대상이 눈에 보이고,
그 경로는 커밋될 수 없다.

### Context Sources

| 등급 | 뜻 |
|---|---|
| `[확인]` | 코드·문서에서 직접 읽었다 |
| `[해석]` | 읽은 것에서 추론했다 |
| `[모름]` | 확인하지 못했다 |

- [확인] `.vibe/todos/agentic-paradigm-gaps-2026-09-02.md` — 이 항목의 보류 사유와 "여는 조건과 방법" 이 이미 기록돼 있다: 판정을 경로가 하고, gitignore 하고, 커밋 시도를 `pre-tool-guard.js` 가 차단한다
- [확인] `hooks/scripts/code-check.js:run` — PostToolUse 품질 검사. `getModifiedFiles(ctx)` 로 편집된 파일을 받아 탐지기와 `validateCodeQuality` 를 돌린다. 조기 반환 지점이 이미 있다(`CODE_EXT_RE` 미매치)
- [확인] `hooks/scripts/pre-tool-guard.js:run` — 2단계에서 `gh pr create` 를 정규식으로 잡아 `return 2`(deny)로 차단하는 선례가 있다. exit 2 = denied
- [확인] `.gitignore:39-47` — `.vibe/{metrics,gates,memories,checkpoints,packets,runs}/` 가 이미 런타임 아티팩트로 제외돼 있다
- [확인] `CLAUDE.md` Git 절 — Include/Exclude 목록이 SSOT. `.vibe/` 하위가 어디에 속하는지 여기서 정해진다
- [확인] `hooks/scripts/utils.js:20` — `PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || '.'`. **cwd 가 아니라 `'.'` 이다** — 문자열 접두사 비교로 경로를 판정하면 절대 경로로 들어온 파일이 프로젝트 밖으로 잘못 판정된다 (구현 중 테스트가 잡았다)
- [확인] `CLAUDE.md` Complexity Limits — 라쳇은 `.oxlintrc.json` + `lint:ratchet` 이 판정한다. 이것들은 **커밋된 소스**를 본다
- [해석] gitignore 가 1차 방어다. `git add` 는 무시된 경로를 그냥 거부하므로, 실제로 뚫리는 경로는 `git add -f` 뿐이다 — 훅 차단은 그 하나를 막는 **심층 방어**이지 유일한 방어가 아니다. 이걸 과장하지 않는다
- [모름] 이 레인의 실수요 — 저장소에 사례가 0건이다. 그래서 이 SPEC 은 기능을 넓히지 않고 **최소 표면**만 연다

### Assumptions

훑었으나 묻지 않고 기본값을 채택한 항목 전부:

1. 경로는 `.vibe/ephemeral/` 하나. 설정으로 열지 않는다 — 설정 가능하면 판정이 다시 흔들린다
2. 판정은 **경로만** 본다. 파일 내용·확장자·모델 판단을 보지 않는다
3. 경로 판정은 `path.resolve` 로 양쪽을 절대 경로로 만든 뒤 `path.relative` 로 한다 — 문자열 접두사 비교로는 부족하다(위 `PROJECT_DIR = '.'` 참조). `.vibe/ephemeral/../src/x.ts` 는 정규화하면 `.vibe/src/x.ts` 라 **일회성이 아니다** — 상위 탈출로 면제를 훔칠 수 없어야 한다
4. 프로젝트 밖 절대 경로는 일회성이 아니다. 면제는 이 저장소 안에서만 의미가 있다
5. 면제 대상은 `code-check.js` 의 품질 검사뿐이다. 라쳇·린트·테스트는 커밋된 소스를 보므로 애초에 이 경로를 보지 않는다
6. `.gitignore` 에 추가한다 — 이것이 **1차 방어**다
7. `pre-tool-guard.js` 는 `git add`/`git commit`/`git stage` 명령줄에 일회성 경로가 나타나면 차단한다(exit 2). `-f` 로 gitignore 를 넘는 경로를 막는 **심층 방어**이며, 유일한 방어인 척하지 않는다
8. 차단 메시지는 무엇을 왜 막았는지와 대안(경로 밖으로 옮겨라)을 함께 낸다 — 이유 없는 차단은 우회된다
9. `git add .` · `git add -A` 는 차단하지 않는다. gitignore 가 이미 걸러내고, 여기서 막으면 정상 커밋이 전부 멈춘다
10. 모듈은 `hooks/scripts/lib/ephemeral-lane.js` — 소비자가 둘 다 훅(JS)이다. TS 도구로 중복 정의하지 않는다
11. 새 스킬·새 설정 키·새 CLI 서브커맨드를 만들지 않는다. 최소 표면
12. 문서 SSOT 는 `CLAUDE.md` Git 절 (AGENTS.md 는 생성물)
13. Structure 다이어그램 절은 생략한다 — 새 경계 없음. 기존 훅 lib 에 파일 1개 추가

### 되돌리기 어려운 결정

없음 — 경로 규약과 순수 함수다. 되돌리면 `.vibe/ephemeral/` 이 평범한 무시 디렉토리로 남는다.

### Constraints

- **일회성 판정을 모델이 하지 않는다.** 경로만 본다
- **상위 탈출로 면제를 훔칠 수 없다** — 정규화 후 판정한다
- 면제 범위를 최소로 둔다: `code-check.js` 품질 검사만
- `git add .` / `-A` 같은 일상 명령을 막지 않는다
- 훅 규약대로 fail-open — 판정 실패가 편집·커밋을 막지 않는다
- 신규 함수는 복잡도 상한 준수 (≤50줄 · 파라미터 ≤5 · Cyclomatic ≤10)

### Rejected Alternatives (Traps)

- **모델이 `lifetime: ephemeral` 을 판정** — 원래 보류 사유 그 자체다. "이건 일회성이라 린트 면제" 를 모델이 정하면 축이 아니라 뒷문이고, 뒷문은 바쁠 때 쓰인다
- **`.vibe/config.json` 으로 경로를 설정 가능하게** — 설정 가능한 면제 경로는 프로젝트마다 다른 뒷문이 된다. 하나로 못박아야 리뷰어가 어디를 봐야 하는지 안다
- **라쳇·린트까지 면제** — 그것들은 커밋된 소스를 본다. 커밋될 수 없는 경로를 면제 대상에 넣는 것은 없는 문제를 푸는 것이다
- **`git add .` 차단** — gitignore 가 이미 거른다. 여기서 막으면 정상 커밋이 전부 멈추고, 멈추는 게이트는 꺼진다
- **훅 차단을 1차 방어로 선전** — 훅은 프로젝트 로컬이라 미설치가 흔하다. gitignore 가 1차이고 훅은 `-f` 하나를 막는 심층 방어다. 과장하면 없는 안전을 믿게 된다
- **파일 내용으로 일회성 판정** — 판정 근거가 눈에 보이지 않는다. 경로는 `ls` 하나로 감사된다
- **문자열 접두사로 경로 판정** — `PROJECT_DIR` 이 `'.'` 이라 절대 경로가 프로젝트 밖으로 잘못 판정된다. 구현 중 이 형태로 만들었다가 테스트에서 잡혔다

---

## 2. Requirements

| REQ ID | 요구사항 | Done Criteria |
|---|---|---|
| REQ-ephemeral-code-lane-001 | 경로만으로 일회성을 판정한다 | DC-1 |
| REQ-ephemeral-code-lane-002 | 상위 탈출·프로젝트 밖 경로로 면제를 훔칠 수 없다 | DC-2 |
| REQ-ephemeral-code-lane-003 | 품질 검사가 일회성 경로를 건너뛴다 | DC-3 |
| REQ-ephemeral-code-lane-004 | git 스테이징 명령에서 일회성 경로를 잡아낸다 | DC-4 |
| REQ-ephemeral-code-lane-005 | `git add .` · `-A` 를 막지 않는다 | DC-5 |
| REQ-ephemeral-code-lane-006 | pre-tool-guard 가 일회성 커밋 시도를 차단한다 | DC-6 |
| REQ-ephemeral-code-lane-007 | gitignore 가 1차 방어로 존재한다 | DC-7 |
| REQ-ephemeral-code-lane-008 | 문서가 방어 순서를 정확히 적는다 | DC-8 |

### Done Criteria

| ID | 판정 | Evidence Required |
|---|---|---|
| DC-1 | `.vibe/ephemeral/x.js` · `./.vibe/ephemeral/x.js` · 절대 경로 형태가 모두 참이고, 그 밖은 거짓 | `npx vitest run hooks/scripts/__tests__/ephemeral-lane.test.js` exit 0 |
| DC-2 | `.vibe/ephemeral/../src/x.ts` · `.vibe/ephemeral/../../etc/x` · 다른 프로젝트의 절대 경로가 전부 거짓 | 동일 테스트 exit 0 |
| DC-3 | `code-check.js run` 이 일회성 경로에서 findings 없이 exit 0 으로 조기 반환한다 | 동일 테스트 exit 0 |
| DC-4 | `git add -f .vibe/ephemeral/x.js` 에서 그 경로를 뽑아낸다 (`git commit`·`git stage` 포함) | 동일 테스트 exit 0 |
| DC-5 | `git add .` · `git add -A` · `git commit -am "..."` 에서 빈 배열을 낸다 | 동일 테스트 exit 0 |
| DC-6 | `pre-tool-guard run` 이 해당 Bash 명령에 exit 2 를 내고 이유·대안을 stderr 로 낸다 | 동일 테스트 exit 0 |
| DC-7 | `.gitignore` 에 `.vibe/ephemeral/` 이 있다 | 동일 테스트 exit 0 |
| DC-8 | `CLAUDE.md` 가 gitignore=1차·훅=심층방어 순서와 "판정은 경로가 한다" 를 적는다 | 동일 테스트(정적 계약 검사) exit 0 |

---

## 3. Scenarios

| # | Given | When | Then | REQ |
|---|---|---|---|---|
| S1 | `.vibe/ephemeral/probe.js` 를 편집했다 | `code-check.js run` | 품질 검사 없이 exit 0 — 일회성 레인 | 003 |
| S2 | `src/index.ts` 를 편집했다 | `code-check.js run` | 평소대로 검사한다 — 면제는 경로 안에서만 | 003 |
| S3 | `.vibe/ephemeral/../src/x.ts` 를 편집했다 | `isEphemeralPath` | 거짓 — 상위 탈출로 면제를 훔칠 수 없다 | 002 |
| S4 | `git add -f .vibe/ephemeral/probe.js` | `pre-tool-guard run` | exit 2 + 이유·대안 메시지 | 004·006 |
| S5 | `git add .` | `pre-tool-guard run` | 통과 — gitignore 가 거른다 | 005 |
| S6 | 경로 판정 중 예외가 난다 | `isEphemeralPath` | 거짓 반환(fail-open 아닌 **fail-safe**) — 모르면 면제하지 않는다 | 001 |

---

## 4. Out of Scope

- 설정으로 경로를 바꾸는 것
- 라쳇·린트·테스트 면제 — 그것들은 커밋된 소스를 본다
- `lifetime` 을 SPEC 헤더 필드로 만드는 것 — 실수요가 생기면 그때
- 일회성 코드의 실행 샌드박스

---

## Anchors

이 SPEC 이 안착한 경로 — 사라지면 `npm run validate:spec-lifecycle` 이 빨간불을 켠다.

- `hooks/scripts/lib/ephemeral-lane.js`
- `hooks/scripts/__tests__/ephemeral-lane.test.js`
- `hooks/scripts/code-check.js`
- `hooks/scripts/pre-tool-guard.js`
- `.gitignore`
- `CLAUDE.md`
