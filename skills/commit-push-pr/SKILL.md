---
name: commit-push-pr
description: "Commit, push, and create PR in one go. Auto-activates on commit, PR, push keywords."
triggers: [commit, push, PR, pull request, merge]
priority: 70
---

# Commit-Push-PR — From Commit to PR in One Step

Commit current changes, push to the remote branch, and create a GitHub PR.

## Pre-checks

```bash
# Check current state
git status
git diff --stat
git log --oneline -5
```

## Workflow

1. Review and stage changed files
2. Write commit message (Conventional Commits format)
3. Push to remote branch
4. Create PR with `gh pr create`
5. Write PR title/body

## Commit Message Format

```
[type] title (under 50 chars)

body (optional, 72 char line wrap)
- What was changed
- Why it was changed

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Type List

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Formatting (no code changes) |
| `refactor` | Refactoring |
| `test` | Add/modify tests |
| `chore` | Build, config changes |
| `perf` | Performance improvement |

## Co-Authored-By Rule

Always add for AI-generated/modified code:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Security File Check

Always verify before committing:

```bash
# Detect sensitive files
git diff --cached --name-only | grep -E '\.(env|pem|key)$|credentials|secret'
```

### Never Commit These Files

| File Pattern | Reason |
|-------------|--------|
| `.env`, `.env.local` | Environment variables (contains secrets) |
| `*.pem`, `*.key` | Certificates/keys |
| `credentials.json` | Authentication info |
| `service-account.json` | Service account |

> If any of these files are staged, immediately warn and abort the commit.

## Branch Protection Rules

### main/master Branch Protection

```bash
# Check current branch
git branch --show-current
```

- **No direct commits/pushes to main/master**
- If on main/master: recommend creating a new branch and abort
- **Never** `--force` push (main/master)

## PR Creation Format

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

## git-workflow Rule Integration

This skill follows rules from `.claude/vibe/rules/standards/git-workflow.md`:

- Conventional Commits format
- PR checklist compliance
- Prohibited actions (force push, .env commits, etc.)

> **VIBE tool integration**: `/vibe.review`'s git-history agent automatically validates commit quality
