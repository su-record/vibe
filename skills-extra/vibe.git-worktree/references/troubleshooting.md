# Worktree Troubleshooting

Load only after a worktree command fails.

| Error | Fix |
|-------|-----|
| "already checked out" | Branch is in another worktree — `git worktree list`, then remove |
| Locked worktree | `git worktree unlock <path>` |
| Stale worktree | `git worktree prune` |
