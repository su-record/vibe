# SPEC: Curated Release Notes

- **Created**: 2026-07-20
- **Status**: COMPLETE
- **Tech Stack**: TypeScript, Node.js, GitHub Actions, Vitest

---

## 1. Overview / Goal

태그 발행 시 PR 제목만 나열하지 않고, 이전 semantic-version 태그 이후의 SPEC과 conventional commits를 근거로 사용자 관점의 릴리즈 노트를 결정론적으로 생성한다. 이미 발행된 `v3.2.1`도 동일한 품질 기준으로 교체한다.

### Context Sources

- `.github/workflows/release.yml` — 현재 `gh release create --generate-notes` 발행 경로
- `skills/docs/references/api-docs-changelog.md` — changelog 분류·사용자 관점 규칙
- `v3.2.0..v3.2.1` git history와 diff — 실제 릴리즈 범위
- `.vibe/specs/execution-packet-compiler.md` — v3.2.1 핵심 기능의 제품 계약
- GitHub Release `v3.2.1` — 현재 두 줄짜리 자동 생성 본문

### Assumptions

- 릴리즈 태그는 계속 `vMAJOR.MINOR.PATCH` 형식을 사용한다.
- 태그가 가리키는 `package.json`의 버전과 릴리즈 태그가 일치한다.
- 릴리즈 생성기는 네트워크나 LLM 없이 git과 저장소 파일만 사용한다.
- 변경된 SPEC이 없더라도 conventional commit 분류로 유효한 본문을 생성한다.

### Constraints

- npm OIDC publish와 GitHub Release 발행 순서는 유지한다.
- 생성 결과가 비어 있으면 릴리즈를 조용히 발행하지 않고 실패한다.
- merge commit, 버전 전용 커밋, 자동 생성 로그 태그는 사용자 변경 목록에서 제외한다.
- Breaking change가 있으면 가장 먼저 표시하고, 없으면 빈 섹션을 만들지 않는다.
- 릴리즈 노트는 사용자에게 보이는 변화 중심으로 작성하고 내부 구현 세부사항은 분리한다.

---

## 2. Requirements

| ID | Requirement | Done Criteria |
|----|-------------|---------------|
| REQ-release-notes-001 | 이전 semantic tag부터 현재 tag까지 정확한 비교 범위를 계산한다 | D1 |
| REQ-release-notes-002 | 변경된 SPEC의 Overview와 Requirements를 Highlights로 추출한다 | D2 |
| REQ-release-notes-003 | conventional commits를 Added, Fixed, Changed, Documentation, Internal로 분류한다 | D3 |
| REQ-release-notes-004 | GitHub Actions가 생성된 파일을 정식 Release 본문으로 사용한다 | D4 |
| REQ-release-notes-005 | 현재 v3.2.1 릴리즈 본문을 상세한 사용자 관점 문서로 교체한다 | D5 |
| REQ-release-notes-006 | 빌드와 전체 테스트가 통과한다 | D6 |

---

## 3. Done Criteria (deterministic gates)

| # | Criterion | Verified by |
|---|-----------|-------------|
| D1 | semantic tag 선택에서 `log-*` 태그를 제외하고 직전 `v*` 태그를 사용한다 | tag-range unit tests |
| D2 | SPEC이 추가된 fixture에서 Overview와 모든 REQ 설명이 Highlights에 나타난다 | generator snapshot/content tests |
| D3 | feat/fix/docs/refactor/chore와 breaking commit이 지정된 섹션에만 나타난다 | table-driven classification tests |
| D4 | release workflow가 full history checkout 후 생성기를 실행하고 `--notes-file`로 발행한다 | workflow static contract test |
| D5 | 공개 `v3.2.1` Release 본문에 Highlights, Added, Fixed, Verification 섹션이 존재한다 | `gh release view v3.2.1` field check |
| D6 | 저장소 build와 전체 Vitest가 통과한다 | `npm run build && npm test` exit 0 |

### Evidence Required

- D1 → tag selection fixture test output
- D2 → SPEC-derived Highlights content test output
- D3 → commit classification table test output
- D4 → workflow static contract test output
- D5 → GitHub Release body readback
- D6 → build와 전체 Vitest exit code

### Human Taste (Non-Blocking)

- 첫 화면에서 이번 릴리즈의 핵심 가치가 30초 안에 이해되는지
- 내부 파일명보다 사용자 행동과 신뢰성 개선이 먼저 보이는지

---

## 4. Scenarios

```gherkin
Scenario: SPEC 기반 Highlights를 생성한다 # → D1, D2
  Given 직전 semantic tag 이후 execution packet SPEC이 추가됐다
  When 현재 태그의 릴리즈 노트를 생성한다
  Then SPEC Overview와 REQ 설명이 Highlights에 포함된다
  And log 태그는 비교 기준으로 선택되지 않는다

Scenario: 커밋을 사용자 관점 섹션으로 분류한다 # → D3
  Given feat, fix, docs, refactor, chore와 breaking 커밋이 있다
  When 릴리즈 노트를 생성한다
  Then 각 커밋은 대응 섹션에 한 번만 나타난다
  And merge와 버전 전용 커밋은 제외된다

Scenario: 태그 워크플로가 생성된 본문을 발행한다 # → D4
  Given v* 태그가 push됐다
  When release workflow가 실행된다
  Then 전체 git history로 릴리즈 노트 파일을 생성한다
  And GitHub Release는 해당 파일을 본문으로 사용한다

Scenario: 기존 v3.2.1 릴리즈를 보강한다 # → D5
  Given 현재 릴리즈 본문이 PR 제목 두 줄뿐이다
  When 상세 릴리즈 노트를 적용한다
  Then Highlights, Added, Fixed, Verification이 공개 본문에 존재한다

Scenario: 저장소 품질 게이트를 유지한다 # → D6
  Given 릴리즈 자동화가 변경됐다
  When build와 전체 테스트를 실행한다
  Then 모든 결정론적 게이트가 통과한다
```

---

## 5. Out of Scope

- LLM API를 호출해 릴리즈 설명을 생성하는 기능
- npm package contents 또는 provenance 정책 변경
- 자동 major/minor/patch 버전 결정
- 과거 `v3.2.0` 이하 릴리즈 본문 일괄 수정
- CHANGELOG.md 도입

---

## 6. Verification

- generator 단위 테스트와 workflow 정적 계약 테스트를 먼저 실행한다.
- `npm run build && npm test`로 전체 저장소 회귀를 확인한다.
- `gh release edit v3.2.1 --notes-file ...` 후 공개 본문을 readback한다.
- Model Judge는 문장 개선만 제안할 수 있고 발행 성공을 판정하지 않는다.
