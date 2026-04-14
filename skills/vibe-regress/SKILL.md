---
name: vibe-regress
tier: core
description: "Regression test auto-evolution. Registers bugs (auto from /vibe.verify failures or manual), generates preventive vitest/jest files from bug records, clusters repeated patterns (3+ same root-cause-tag) into shared tests, and imports historical `fix:` commits from git log. Storage: .claude/vibe/regressions/<slug>.md. Must use this skill when user runs /vibe.regress, when /vibe.verify produces a failure, or when the user says 'don't let this happen again' / '이 버그 다시는' / 'regression test' / '회귀 테스트'."
triggers: [regress, regression, "회귀", "다시는", "반복 버그", "fix commit"]
priority: 70
chain-next: []
---

# vibe.regress — Regression Auto-Evolution

**Purpose**: 같은 버그를 두 번 잡지 않는다. 버그를 잡을 때마다 예방 테스트가 자라난다.

## Why this exists

바이브코딩의 고전적 약점: LLM이 같은 클래스의 버그를 매번 새로 만든다. 회귀 테스트는 이를 기계적으로 막는 유일한 장치. 단, 사람이 매번 회귀 테스트를 쓰면 건너뛰게 됨 — 그래서 자동화.

## Storage Contract

```
.claude/vibe/regressions/
  <bug-slug>.md       # 하나의 버그 = 하나의 파일
  _cluster-<tag>.md   # cluster 서브커맨드가 생성한 공통 테스트 설계
```

### Frontmatter schema (엄격)

```yaml
slug: string            # kebab-case, 글로벌 유일
symptom: string         # 1줄, 사용자 관점
root-cause-tag: enum    # 아래 허용 태그만
fix-commit: string      # git hash (없으면 "pending")
test-path: string       # 생성된 테스트 파일 경로 (없으면 "pending")
status: open | test-generated | resolved
registered: YYYY-MM-DD
feature: string         # 연관 feature 이름 (SPEC과 매칭)
```

### Allowed `root-cause-tag` values

클러스터링의 기반이므로 **미리 정의된 집합만** 사용:

- `timezone` — 시간대/DST/off-by-one
- `nullability` — null/undefined/empty 처리
- `concurrency` — race condition, 동시성
- `boundary` — off-by-one, edge value
- `encoding` — charset, URL encoding, escape
- `validation` — 입력 검증 누락
- `auth` — 인증/권한 로직
- `state-sync` — 클라이언트/서버 상태 불일치
- `integration` — 외부 API 호출 실패
- `type-narrow` — TypeScript 타입 좁히기 실수
- `other` — 위에 안 맞을 때 (나중에 새 태그 추가)

**규칙**: 새 태그가 필요하면 기존 태그에 억지로 맞추지 말고 `other`로 등록한 뒤, `other`가 3개 이상 쌓이면 사용자에게 태그 추가를 제안.

## Subcommands

### 1. `register "<symptom>"` — 수동 등록

대부분은 자동 호출되므로 수동 사용은 드뭅니다 (verify 실패 밖에서 발견된 버그, 또는 프로덕션 이슈용).

**단계**:
1. `getCurrentTime`으로 오늘 날짜 확보
2. `git log -1 --format=%H`으로 현재 커밋 해시 (fix-commit 후보)
3. Claude가 대화로 다음을 뽑아냄:
   - Reproduction steps (Given/When/Then)
   - Root cause 1문단
   - Fix 설명
4. `root-cause-tag`는 허용 집합에서 **자동 추론 후 사용자에게 확인**. 애매하면 `other`.
5. slug 생성: symptom에서 핵심어 → kebab-case, 충돌 시 `-2` 접미사
6. `.claude/vibe/regressions/<slug>.md` 작성 (status: `open`)

### 2. `generate <slug>` — 예방 테스트 생성

**단계**:
1. bug 파일 읽기
2. 테스트 스택 감지:
   - `package.json`의 `devDependencies`에서 `vitest` > `jest` 순
   - 둘 다 없으면 **user에게 질문 후 중단**
3. 테스트 위치 결정:
   - feature의 구현 파일 옆 `__tests__/` 또는
   - 프로젝트의 기존 test dir (vitest config.test.include 확인)
4. 파일명: `<original-file>.regression.test.ts`
5. 내용: `templates/test-vitest.md` 또는 `templates/test-jest.md` 템플릿에서 치환
6. bug 파일 frontmatter 업데이트: `test-path`, `status: test-generated`
7. **생성 후 즉시 테스트 실행** — 실패해야 정상 (아직 수정 안 됨이면) 또는 통과 (수정 완료됨이면). 결과를 frontmatter에 기록.

### 3. `list` — 미해결 목록

```
/vibe.regress list                 # status != resolved 전부
/vibe.regress list --feature login # feature별
/vibe.regress list --tag timezone  # tag별
```

터미널 표:

```
SLUG                              FEATURE   TAG         STATUS           AGE
login-jwt-expiry-off-by-one       login     timezone    test-generated   3d
cart-stock-race-double-deduct     cart      concurrency open             1d
```

### 4. `import` — git log 역추적

**단계**:
1. `git log --grep='^fix:' --format='%H|%s|%ci' --since=<last-import-date>`
   - `last-import-date`는 `.claude/vibe/regressions/.import-cursor` 파일에서 읽음 (없으면 90일 전)
2. 각 커밋에 대해:
   - 이미 같은 `fix-commit`을 가진 bug 파일이 있으면 **스킵**
   - 없으면 커밋 메시지/diff에서 symptom + root-cause-tag 추론 (LLM 호출)
   - 신규 bug.md 작성 (status: `resolved` — 이미 고쳐졌으므로)
3. 완료 후 `.import-cursor` 갱신
4. 새로 import된 항목에 대해 사용자에게 `generate` 제안

**주의**: `fix:` 커밋이 아닌 일반 커밋은 **무시**. Conventional Commits 규약을 사용하지 않는 프로젝트는 `--grep-pattern` 옵션으로 오버라이드.

### 5. `cluster` — 반복 패턴 승격

**단계**:
1. 모든 bug 파일의 `root-cause-tag` 집계
2. **같은 태그가 3개 이상**이면 cluster 후보
3. 각 후보에 대해:
   - 3개 bug의 reproduction을 LLM에게 주고 "공통 원인과 공통 테스트 케이스"를 추출
   - `_cluster-<tag>.md` 파일 생성 (기존 bug 파일들의 slug를 링크)
   - 공통 테스트 skeleton을 `<project-test-dir>/_cluster-<tag>.regression.test.ts`로 제안 (사용자 승인 후 생성)
4. 클러스터 생성 시 원본 bug 파일은 **삭제하지 않음** — 이력 보존

**중요**: cluster는 자동 실행 안 됨. 사용자가 명시적으로 호출해야 함 (과도한 추상화 방지).

## Integration with /vibe.verify

`/vibe.verify` 실패 시 verify가 다음을 호출:

```
Load skill `vibe-regress` with: register --from-verify
  <feature>: {feature-name}
  <scenario>: {failed-scenario}
  <error>: {error-message}
  <location>: {file:line}
```

`--from-verify` 플래그 동작:
- symptom = scenario name + error summary
- feature = 전달된 feature name
- root-cause-tag = error pattern에서 자동 추론 (애매하면 `other`)
- status = `open`
- **사용자 확인 없이 등록** (verify 실패 상황은 이미 주의 집중 중이라 마찰 최소화가 중요)

## Integration with /vibe.run

`/vibe.run "<feature>"` 시작 시:

1. `ls .claude/vibe/regressions/*.md`에서 `feature: <feature-name>` + `status != resolved` 필터
2. 미해결 있으면 경고:
   ```
   ⚠️  Open regressions for this feature:
     - login-jwt-expiry-off-by-one (timezone, 3d old)
     - login-session-leak (auth, 1w old)
   
   Fix these before adding new behavior? [y/N]
   ```
3. `y` → `/vibe.regress generate`로 체인 (미생성 항목)
4. `N` → 계속 진행 (ultrawork 모드는 자동 `N` + TODO 기록)

## Done Criteria

- [ ] 서브커맨드가 지정 없이 호출되면 usage 표시
- [ ] frontmatter 스키마 엄격 준수 (누락 필드 있으면 거부)
- [ ] `root-cause-tag`가 허용 집합 외 값이면 경고 + `other`로 강제
- [ ] `generate` 후 테스트를 **실제로 실행**하여 결과 검증
- [ ] `import`는 중복 스킵 (fix-commit 해시 기준)
- [ ] `cluster`는 3개 미만이면 아무것도 안 함 (false positive 방지)
