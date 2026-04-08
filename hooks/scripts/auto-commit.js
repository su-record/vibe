/**
 * Stop Hook - 에이전트 응답 완료 시 자동 커밋 + 롤백 체크포인트
 *
 * 변경사항이 있으면 자동으로 git add + commit.
 * 커밋 메시지는 변경 파일 목록 기반으로 생성.
 * feature branch에서만 동작 (main/master 보호).
 *
 * 체크포인트: 커밋마다 vibe-checkpoint 태그를 생성해
 * 문제 발생 시 `git reset --hard vibe-checkpoint-N` 으로 롤백 가능.
 * 최근 5개만 유지, 오래된 체크포인트는 자동 정리.
 */
import { execSync } from 'child_process';
import { PROJECT_DIR } from './utils.js';

const PROTECTED_BRANCHES = ['main', 'master', 'develop', 'production'];
const MAX_FILES_IN_MSG = 5;
const MAX_CHECKPOINTS = 5;
const CHECKPOINT_PREFIX = 'vibe-checkpoint-';

function getCurrentBranch() {
  return execSync('git branch --show-current', {
    cwd: PROJECT_DIR,
    encoding: 'utf-8',
  }).trim();
}

function hasChanges() {
  const status = execSync('git status --porcelain', {
    cwd: PROJECT_DIR,
    encoding: 'utf-8',
  }).trim();
  return status.length > 0;
}

function getChangedFiles() {
  const status = execSync('git status --porcelain', {
    cwd: PROJECT_DIR,
    encoding: 'utf-8',
  }).trim();
  return status.split('\n')
    .map(line => line.slice(3).trim())
    .filter(f => f.length > 0);
}

function buildCommitMessage(files) {
  const shown = files.slice(0, MAX_FILES_IN_MSG);
  const remaining = files.length - shown.length;
  let msg = `auto: update ${shown.join(', ')}`;
  if (remaining > 0) msg += ` (+${remaining} more)`;
  return msg;
}

function createCheckpoint() {
  const existing = execSync('git tag -l "vibe-checkpoint-*"', {
    cwd: PROJECT_DIR, encoding: 'utf-8',
  }).trim().split('\n').filter(Boolean).sort();

  const nextNum = existing.length > 0
    ? Number(existing[existing.length - 1].replace(CHECKPOINT_PREFIX, '')) + 1
    : 1;

  const tag = `${CHECKPOINT_PREFIX}${nextNum}`;
  execSync(`git tag ${tag}`, { cwd: PROJECT_DIR, stdio: 'ignore' });

  // 오래된 체크포인트 정리 (최근 MAX_CHECKPOINTS개만 유지)
  const allTags = [...existing, tag];
  if (allTags.length > MAX_CHECKPOINTS) {
    const toDelete = allTags.slice(0, allTags.length - MAX_CHECKPOINTS);
    for (const old of toDelete) {
      execSync(`git tag -d ${old}`, { cwd: PROJECT_DIR, stdio: 'ignore' });
    }
  }

  return tag;
}

try {
  const branch = getCurrentBranch();
  if (PROTECTED_BRANCHES.includes(branch)) {
    // Never auto-commit to protected branches
    process.exit(0);
  }

  if (!hasChanges()) process.exit(0);

  const files = getChangedFiles();
  const msg = buildCommitMessage(files);

  execSync('git add -A', { cwd: PROJECT_DIR, stdio: 'ignore' });
  execSync(`git commit -m "${msg}"`, { cwd: PROJECT_DIR, stdio: 'ignore' });

  const tag = createCheckpoint();
  console.log(`[AUTO-COMMIT] ${msg}`);
  console.log(`[CHECKPOINT] ${tag} — rollback: git reset --hard ${tag}`);
} catch {
  // Auto-commit failure should never block
}
