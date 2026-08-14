# Git Worktree: When to Use Decision Guide

## Decision Tree

```
Need to work on a different branch?
    │
    ├─ How long? < 5 minutes
    │       └─ Use git stash + switch
    │
    ├─ Will you need to run tests/build?
    │       └─ No → git stash is fine
    │           Yes → Consider worktree
    │
    └─ Can you commit current work?
            └─ Yes → commit + switch (simplest)
                No → worktree or stash
```

## Use Worktree When

| Scenario | Reason |
|----------|--------|
| Reviewing a PR that needs running | Avoids dirty working tree; test in isolation |
| Critical hotfix while mid-feature | Keep feature branch untouched |
| A/B testing two implementations | Both runnable simultaneously |
| Long-running parallel experiment | Work on both without context switching |

## Skip Worktree When

| Scenario | Better Alternative |
|----------|--------------------|
| Quick config change on another branch | `git stash && git switch` |
| Just reading code on another branch | `git show branch:file` |
| Already committed current work | `git switch` directly |
| Change touches same files | Merging will conflict regardless |
| Repo uses large node_modules | Each worktree needs separate install — expensive |

## Cost/Benefit

| Factor | Worktree Cost |
|--------|--------------|
| Disk space | Full working copy per worktree |
| `npm install` / `pnpm install` | Required in each worktree |
| Mental overhead | Tracking multiple worktree paths |
| Cleanup discipline | Must `git worktree remove` when done |

**Rule of thumb**: If the task is under 15 minutes, `git stash` is almost always faster than setting up a worktree.

## Gotchas

- A branch can only be checked out in **one** worktree at a time
- Worktrees share `.git` — commits in any worktree are immediately visible in all
- Forgetting to remove worktrees leaves stale locks — run `git worktree prune` periodically
- CI/CD hooks may not run correctly outside the main worktree path
