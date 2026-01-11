# Git Worktree Skill

Git Worktree를 활용한 병렬 브랜치 작업 스킬

## Overview

메인 작업을 중단하지 않고 다른 브랜치에서 리뷰/테스트 수행

## Usage

```bash
# Worktree 생성
git worktree add ../review-pr123 pr/123

# 해당 디렉토리에서 작업
cd ../review-pr123
npm test

# 작업 완료 후 정리
git worktree remove ../review-pr123
```

## Commands

### Create Worktree

```bash
# PR 리뷰용 worktree
git worktree add ../review-{pr_number} origin/pr/{pr_number}

# 특정 브랜치 worktree
git worktree add ../feature-work feature/new-feature

# 새 브랜치로 worktree
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
# 정상 제거
git worktree remove ../review-123

# 강제 제거 (uncommitted changes 무시)
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

1. **No Stash Needed**: 현재 작업 그대로 유지
2. **Full Codebase**: 각 worktree는 완전한 코드베이스
3. **Parallel Work**: 여러 브랜치 동시 작업
4. **Clean Testing**: 격리된 환경에서 테스트

## Best Practices

### Naming Convention

```bash
# PR 리뷰
../review-{pr_number}

# 핫픽스
../hotfix-{issue_number}

# 실험
../experiment-{feature_name}
```

### Cleanup

```bash
# 정기 정리
git worktree prune

# 모든 worktree 확인
git worktree list

# 스크립트로 자동 정리
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
# 해결: 해당 브랜치가 다른 worktree에 있음
git worktree list  # 확인
git worktree remove <path>  # 제거
```

### Locked Worktree

```bash
# 해결: 잠긴 worktree 해제
git worktree unlock <path>
```

### Stale Worktree

```bash
# 해결: 삭제된 디렉토리 정리
git worktree prune
```
