---
description: "변경사항 커밋, 푸시, PR 생성을 한 번에 수행. 커밋, PR, 푸시, commit, push 키워드에 자동 활성화."
---

# Commit-Push-PR — 커밋부터 PR까지 한 번에

현재 변경사항을 커밋하고, 원격 브랜치에 푸시한 후, GitHub PR을 생성한다.

## 사전 확인

```bash
# 현재 상태 확인
git status
git diff --stat
git log --oneline -5
```

## 작업 순서

1. 변경된 파일 확인 및 스테이징
2. 커밋 메시지 작성 (Conventional Commits 한국어 형식)
3. 원격 브랜치로 푸시
4. `gh pr create`로 PR 생성
5. PR 제목/본문 한국어 작성

## 커밋 메시지 형식

```
[타입] 제목 (50자 이내)

본문 (선택, 72자 줄바꿈)
- 무엇을 변경했는지
- 왜 변경했는지

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 타입 목록

| 타입 | 설명 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `style` | 포맷팅 (코드 변경 없음) |
| `refactor` | 리팩토링 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 설정 변경 |
| `perf` | 성능 개선 |

## Co-Authored-By 규칙

AI가 생성/수정한 코드에는 반드시 추가:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## 보안 파일 체크

커밋 전 반드시 확인:

```bash
# 위험 파일 탐지
git diff --cached --name-only | grep -E '\.(env|pem|key)$|credentials|secret'
```

### 커밋 금지 파일

| 파일 패턴 | 이유 |
|----------|------|
| `.env`, `.env.local` | 환경 변수 (시크릿 포함) |
| `*.pem`, `*.key` | 인증서/키 |
| `credentials.json` | 인증 정보 |
| `service-account.json` | 서비스 계정 |

> 위 파일이 스테이징에 포함되면 즉시 경고하고 커밋을 중단한다.

## 브랜치 보호 규칙

### main/master 브랜치 보호

```bash
# 현재 브랜치 확인
git branch --show-current
```

- **main/master에서는 직접 커밋/푸시 금지**
- main/master인 경우: 새 브랜치 생성을 권장하고 중단
- `--force` push 절대 금지 (main/master)

## PR 생성 형식

```bash
gh pr create \
  --title "[타입] 제목" \
  --body "## 변경 사항
- 주요 변경 내용

## 관련 이슈
- Closes #이슈번호

## 테스트
- 테스트 방법 및 결과"
```

## git-workflow rule 연계

이 스킬은 `.claude/core/rules/standards/git-workflow.md`의 규칙을 따른다:

- Conventional Commits 한국어 형식
- PR 체크리스트 항목 준수
- 금지사항 (force push, .env 커밋 등) 준수

> **vibe 도구 연계**: `/vibe.review`의 git-history 에이전트가 커밋 품질을 자동 검증한다
