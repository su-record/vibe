/**
 * Stop Hook - 에이전트 응답 완료 시 자동 커밋
 *
 * 변경사항이 있으면 자동으로 git add + commit.
 * 커밋 메시지는 변경 파일 목록 기반으로 생성.
 * feature branch에서만 동작 (main/master 보호).
 */
import { execSync } from 'child_process';
import { PROJECT_DIR } from './utils.js';

const PROTECTED_BRANCHES = ['main', 'master', 'develop', 'production'];
const MAX_FILES_IN_MSG = 5;

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

  console.log(`[AUTO-COMMIT] ${msg}`);
} catch {
  // Auto-commit failure should never block
}
