---
name: vibe.commit-push-pr
invocation: [auto]
tier: optional
description: "Use when the user asks to commit completed changes, push the branch, and open a pull request in one workflow."
triggers: [commit, push, PR, pull request, merge]
priority: 70
---

# Commit-Push-PR

## Pre-checks

```bash
git status            # What's changed
git diff --stat       # Review changes
git log --oneline -5  # Recent commits for style
```

## Workflow

1. Review and stage changed files
2. Write commit message (Conventional Commits)
3. Push to remote branch
4. Create PR with `gh pr create`

## Commit Message Format

```
[type] title (under 50 chars)

body (optional, 72 char wrap)

Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: `feat` | `fix` | `docs` | `style` | `refactor` | `test` | `chore` | `perf`

## Security Checks (CRITICAL)

```bash
# Before committing — detect sensitive files
git diff --cached --name-only | grep -E '\.(env|pem|key)$|credentials|secret'
```

**Never commit:** `.env`, `.env.local`, `*.pem`, `*.key`, `credentials.json`, `service-account.json`

> If sensitive files are staged, **immediately warn and abort**.

## Branch Protection

**보호 브랜치 규칙 (항상 적용 — 조건부 로드 금지):**

- **`main`/`master` 에 직접 커밋·푸시하지 않는다.**
- 현재 브랜치가 `main`/`master` 면 **먼저 새 브랜치를 만든다.**
- `main`/`master` 에 **force-push 는 절대 하지 않는다.**

> 이 규칙은 reference 로 내리지 않는다. "브랜치가 보호돼 있을 때만 읽어라" 는 순환이다 —
> 무엇이 보호 브랜치인지 판단하려면 이미 이 규칙을 알고 있어야 한다.
> 안전·정확성 규칙은 조건부 로드 대상이 아니다.

## PR Format

```bash
gh pr create \
  --title "[type] title" \
  --body "## Changes
- Key changes

## Related Issues
- Closes #issue-number

## Testing
- Test methods and results"
```

## Done Criteria (K4)

- [ ] No sensitive files in commit
- [ ] Commit message follows Conventional Commits
- [ ] Co-Authored-By line included
- [ ] Not pushing directly to main/master
- [ ] PR created with clear description
