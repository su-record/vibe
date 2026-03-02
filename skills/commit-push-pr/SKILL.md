---
name: commit-push-pr
description: "Commit, push, and create PR in one go. Auto-activates on commit, PR, push keywords."
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

- **No direct commits/pushes to main/master**
- If on main: create a new branch first
- **Never** `--force` push to main/master

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
