---
name: git-worktree
tier: optional
description: "Git Worktree for parallel branch work. Auto-activates for PR review, hotfix, parallel testing, or working on multiple branches simultaneously."
triggers: [worktree, PR review, hotfix, parallel branch, multiple branches]
priority: 50
---

# Git Worktree

## Pre-check (K1)

> Do you need to work on another branch without losing current work? If you can just `git stash` and switch, worktree may be overkill.

## Core Commands

```bash
# Create worktree for PR review
git worktree add ../review-{pr_number} origin/pr/{pr_number}

# Create worktree with new branch (hotfix)
git worktree add -b hotfix/urgent ../hotfix main

# List all worktrees
git worktree list

# Remove when done
git worktree remove ../review-{pr_number}

# Clean up stale entries
git worktree prune
```

## PR Review Workflow

```
1. git worktree add ../review-123 origin/pr/123
2. cd ../review-123
3. npm install && npm test
4. Run review agents
5. cd - && git worktree remove ../review-123
```

## Hotfix Workflow

```
1. git worktree add -b hotfix/critical ../hotfix main
2. cd ../hotfix
3. Fix bug → commit → push
4. cd - && git worktree remove ../hotfix
```

## Naming Convention

```bash
../review-{pr_number}         # PR review
../hotfix-{issue_number}      # Hotfix
../experiment-{feature_name}  # Experiment
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| "already checked out" | Branch is in another worktree — `git worktree list`, then remove |
| Locked worktree | `git worktree unlock <path>` |
| Stale worktree | `git worktree prune` |

## Done Criteria (K4)

- [ ] Worktree created and work completed in isolation
- [ ] Worktree removed after work is done
- [ ] No stale worktrees left (`git worktree list` clean)
