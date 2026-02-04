---
description: Git Worktree for parallel branch work. Auto-activates for PR review, hotfix, parallel testing, or working on multiple branches simultaneously.
---
# Git Worktree Skill

Parallel branch work using Git Worktree

## Overview

Perform reviews/tests on other branches without interrupting main work

## Usage

```bash
# Create worktree
git worktree add ../review-pr123 pr/123

# Work in that directory
cd ../review-pr123
npm test

# Clean up after work is done
git worktree remove ../review-pr123
```

## Commands

### Create Worktree

```bash
# Worktree for PR review
git worktree add ../review-{pr_number} origin/pr/{pr_number}

# Worktree for specific branch
git worktree add ../feature-work feature/new-feature

# Worktree with new branch
git worktree add -b hotfix/urgent ../hotfix main
```

### List Worktrees

```bash
git worktree list
# /path/to/main       abc1234 [main]
# /path/to/review-123 def5678 [pr/123]
```

### Remove Worktree

```bash
# Normal removal
git worktree remove ../review-123

# Force removal (ignore uncommitted changes)
git worktree remove --force ../review-123

# Prune stale worktrees
git worktree prune
```

## Workflow Integration

### PR Review Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  /vibe.review PR#123                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. git worktree add ../review-123 origin/pr/123               │
│  2. cd ../review-123                                            │
│  3. npm install && npm test                                     │
│  4. Run parallel review agents                                  │
│  5. Generate review report                                      │
│  6. cd - && git worktree remove ../review-123                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Hotfix Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  Urgent hotfix while working on feature                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  # Keep feature work intact                                     │
│  git worktree add -b hotfix/critical ../hotfix main            │
│  cd ../hotfix                                                   │
│                                                                 │
│  # Fix and deploy                                               │
│  vim src/bug.py                                                 │
│  git commit -am "fix: critical bug"                             │
│  git push origin hotfix/critical                                │
│                                                                 │
│  # Return to feature                                            │
│  cd - && git worktree remove ../hotfix                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Benefits

1. **No Stash Needed**: Keep current work intact
2. **Full Codebase**: Each worktree is a complete codebase
3. **Parallel Work**: Work on multiple branches simultaneously
4. **Clean Testing**: Test in isolated environment

## Best Practices

### Naming Convention

```bash
# PR review
../review-{pr_number}

# Hotfix
../hotfix-{issue_number}

# Experiment
../experiment-{feature_name}
```

### Cleanup

```bash
# Regular cleanup
git worktree prune

# Check all worktrees
git worktree list

# Auto cleanup with script
for wt in $(git worktree list --porcelain | grep worktree | cut -d' ' -f2); do
  if [[ $wt == *"review-"* ]] || [[ $wt == *"hotfix-"* ]]; then
    git worktree remove "$wt" 2>/dev/null || true
  fi
done
```

### Integration with CI/CD

```yaml
# GitHub Actions example
- name: Setup Review Worktree
  run: |
    git fetch origin pull/${{ github.event.pull_request.number }}/head:pr-${{ github.event.pull_request.number }}
    git worktree add ../review pr-${{ github.event.pull_request.number }}

- name: Run Tests in Worktree
  working-directory: ../review
  run: npm test

- name: Cleanup
  run: git worktree remove ../review
```

## Troubleshooting

### "already checked out" Error

```bash
# Solution: Branch is already in another worktree
git worktree list  # Check
git worktree remove <path>  # Remove
```

### Locked Worktree

```bash
# Solution: Unlock the locked worktree
git worktree unlock <path>
```

### Stale Worktree

```bash
# Solution: Clean up deleted directories
git worktree prune
```
