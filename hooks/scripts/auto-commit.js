/**
 * Stop Hook - 에이전트 응답 완료 시 자동 커밋 + 롤백 체크포인트
 *
 * ⚠️ OPT-IN ONLY (기본 비활성).
 *   매 턴 자동 커밋은 "사용자가 요청할 때만 커밋한다"는 원칙과 충돌하고,
 *   `git add -A` 가 스코프 밖 파일(임시/미완성)까지 스테이징하는 부작용이 있다.
 *   따라서 `.vibe/config.json` 에서 `hooks["auto-commit"].enabled === true`
 *   로 명시적으로 켰을 때만 동작한다.
 *
 * 동작 시: 변경사항이 있으면 git add -A + commit (커밋 메시지는 변경 파일 목록 기반),
 *   feature branch 에서만 (main/master 보호).
 * 체크포인트: 커밋마다 vibe-checkpoint 태그 생성 → `git reset --hard vibe-checkpoint-N`
 *   으로 롤백 가능. 최근 5개만 유지.
 */
import { execSync } from 'child_process';
import { PROJECT_DIR, readProjectConfig, logHookDecision } from './utils.js';
import { readLedger } from './lib/run-ledger.js';

// Opt-in 가드 — 명시적으로 켜지 않았으면 아무것도 하지 않는다.
const __autoCommitCfg = readProjectConfig();
if (__autoCommitCfg?.hooks?.['auto-commit']?.enabled !== true) process.exit(0);

// verify 게이트 — vibe.run 세션이 시작됐으면 verifyPassed가 true이고
// verifyAt > runStarted 인 경우에만 커밋을 허용한다.
const __ledger = readLedger(PROJECT_DIR);
if (__ledger && __ledger.runStarted) {
  const verifyOk = __ledger.verifyPassed === true
    && __ledger.verifyAt
    && __ledger.verifyAt > __ledger.runStarted;
  if (!verifyOk) {
    const reason = !__ledger.verifyPassed
      ? 'vibe.verify not passed — run /vibe.verify before committing'
      : 'verifyAt is not after runStarted — re-run /vibe.verify';
    logHookDecision('auto-commit', 'git-commit', 'block', reason);
    process.stderr.write(`[auto-commit] SKIP: ${reason}\n`);
    process.exit(0);
  }
}

// verifyRequired 게이트 — PostToolUse에서 P1 이슈가 발견되어 verify가 요구됨.
if (__ledger && __ledger.verifyRequired === true) {
  const reason = `P1 issue requires verification: ${__ledger.verifyRequiredReason || 'see code-check findings'}`;
  logHookDecision('auto-commit', 'git-commit', 'block', reason);
  process.stderr.write(`[auto-commit] SKIP: ${reason}\n`);
  process.exit(0);
}

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

  // 변경 유무와 파일 목록을 단일 `git status --porcelain` 호출로 처리
  const files = getChangedFiles();
  if (files.length === 0) process.exit(0);

  const msg = buildCommitMessage(files);

  execSync('git add -A', { cwd: PROJECT_DIR, stdio: 'ignore' });
  execSync(`git commit -m "${msg}"`, { cwd: PROJECT_DIR, stdio: 'ignore' });

  const tag = createCheckpoint();
  console.log(`[AUTO-COMMIT] ${msg}`);
  console.log(`[CHECKPOINT] ${tag} — rollback: git reset --hard ${tag}`);
} catch {
  // Auto-commit failure should never block
}
