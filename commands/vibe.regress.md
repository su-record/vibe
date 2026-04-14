---
description: Regression test auto-evolution — register bugs, generate preventive tests, cluster patterns
argument-hint: "register | generate | list | import | cluster [args]"
---

# /vibe.regress

**Regression Auto-Evolution** — 같은 버그를 두 번 잡지 않기 위한 도구.

> 버그는 기록되고, 예방 테스트는 자동 생성되고, 반복 패턴은 공통 테스트로 승격된다.

## Usage

```
/vibe.regress register "<symptom>"           # 수동 등록 (최소, 대부분 자동)
/vibe.regress generate <slug>                # bug → vitest 파일 생성
/vibe.regress list                           # 미해결 목록
/vibe.regress import                         # git log의 fix: 커밋 역추적
/vibe.regress cluster                        # 3+ 유사 버그 → 공통 테스트 제안
```

## Auto-integration

- `/vibe.verify` 실패 → 자동으로 `register` 호출 (수동 개입 없음)
- `/vibe.run "<feature>"` 시작 → 해당 feature의 미해결 회귀 항목 경고

## Process

Load skill `vibe-regress` with subcommand: `$ARGUMENTS`

`vibe-regress` 스킬이 등록·생성·클러스터링을 수행.

**핵심 단계** (상세는 `skills/vibe-regress/SKILL.md` 참조):

1. 서브커맨드 파싱
2. `.claude/vibe/regressions/<slug>.md` 읽기/쓰기 (frontmatter 스키마 준수)
3. `generate` 시 프로젝트 테스트 스택 감지 → 적합한 템플릿 선택 (vitest/jest)
4. `cluster` 시 frontmatter의 `root-cause-tag`로 그룹핑 → 3개 이상이면 공통 테스트 제안
5. `import` 시 `git log --grep='^fix:'` 파싱 → 중복 스킵, 신규만 등록

## Output

- `.claude/vibe/regressions/<slug>.md` — 버그 레코드 (frontmatter + 증상/재현/근본원인)
- 프로젝트 test dir — 생성된 vitest 파일 (`*.regression.test.ts` 네이밍)
- `list` 서브커맨드는 터미널 표

## Storage Format

```markdown
---
slug: login-jwt-expiry-off-by-one
symptom: "JWT 만료 시간이 1초 일찍 끊김"
root-cause-tag: timezone
fix-commit: abc1234
test-path: src/auth/__tests__/login.regression.test.ts
status: open | test-generated | resolved
registered: 2026-04-14
feature: login
---

## Reproduction
1. ...

## Root cause
...

## Fix
...
```

---

ARGUMENTS: $ARGUMENTS
