#!/usr/bin/env bash
#
# PR 기반 릴리스 — main 보호 규칙(필수 체크 2개)을 우회하지 않는다.
#
# 구 절차는 `pnpm version patch && git push origin main --follow-tags` 였다.
# 필수 상태 체크는 푸시 **후** 에 실행되므로 직접 푸시는 구조적으로 체크를
# 만족시킬 수 없었고, enforce_admins=false 덕에 매 릴리스가 bypass 로 기록됐다.
# 여기서는 버전 범프를 PR 로 보내 체크를 실제로 통과시킨 뒤, 병합된 커밋에
# 태그를 붙여 Release 워크플로(v* 태그 트리거)를 발동시킨다.
#
# 사용법: pnpm release [patch|minor|major]   (기본 patch)
set -euo pipefail

BUMP="${1:-patch}"

# --- 사전 조건 ---------------------------------------------------------------
[ -z "$(git status --porcelain)" ] || { echo "❌ 워킹 트리가 깨끗하지 않다"; exit 1; }
[ "$(git branch --show-current)" = "main" ] || { echo "❌ main 에서 실행해야 한다"; exit 1; }
git fetch origin main --quiet
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "❌ origin/main 과 동기화되지 않았다"; exit 1; }

# --- 버전 범프 (커밋·태그 없이 package.json 만) --------------------------------
pnpm version "$BUMP" --no-git-tag-version >/dev/null
VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"
BRANCH="release/${TAG}"

git rev-parse "$TAG" >/dev/null 2>&1 && { echo "❌ 태그 ${TAG} 가 이미 있다"; exit 1; }
echo "▶ ${TAG} 릴리스 PR 생성"

# --- PR 생성 → 체크 통과 대기 → 병합 -------------------------------------------
git checkout -q -b "$BRANCH"
git commit -qam "$VERSION"
git push -q origin "$BRANCH"

gh pr create --base main --head "$BRANCH" --title "$VERSION" \
  --body "Release ${TAG}. 버전 범프만 포함한다 — 릴리스 절차는 scripts/release.sh 참조."

echo "▶ 필수 체크 대기 중 (Build (type-check) · Tests)"
# `--watch` 는 체크가 아직 하나도 등록되지 않았으면 즉시 실패한다
# ("no checks reported on the ... branch"). PR 생성과 워크플로 등록 사이에
# 수 초의 간격이 있으므로, 등록될 때까지 먼저 기다린다.
for _ in $(seq 1 60); do
  [ "$(gh pr checks "$BRANCH" --json name -q 'length' 2>/dev/null || echo 0)" -gt 0 ] && break
  sleep 5
done
gh pr checks "$BRANCH" --watch --fail-fast
gh pr merge "$BRANCH" --squash --delete-branch

# --- 병합 커밋에 태그를 붙여 Release 워크플로 발동 ------------------------------
git checkout -q main
git pull -q --ff-only origin main
git branch -qD "$BRANCH" 2>/dev/null || true

# 태그는 브랜치 보호 대상이 아니므로 직접 푸시해도 우회가 아니다.
git tag -a "$TAG" -m "$TAG"
git push -q origin "$TAG"

echo "✅ ${TAG} 태그 푸시 완료 — Release 워크플로가 npm publish 를 수행한다"
echo "   gh run watch \$(gh run list --workflow=release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
