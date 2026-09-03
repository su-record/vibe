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
import { readLedger, VERIFY_BASIS } from './lib/run-ledger.js';
import { lastCodeEdit } from './lib/hook-test-runs.js';

// Opt-in 가드 — 명시적으로 켜지 않았으면 아무것도 하지 않는다.
const __autoCommitCfg = readProjectConfig();
if (__autoCommitCfg?.hooks?.['auto-commit']?.enabled !== true) process.exit(0);

/**
 * verify 게이트 — vibe.run 세션이 시작됐으면 verifyPassed 가 true 이고 verifyAt > runStarted
 * 이며, verify 이후 코드 편집이 없을 때만 커밋을 허용한다. 신선도 판정은 ledger 를 훅이
 * 덮어쓰지 않고 여기서 hook-test-runs 의 편집 이벤트와 비교한다 (SPEC verify-gate-independence).
 * @returns {string|null} 차단 사유 (통과면 null)
 */
function verifyGateReason(ledger) {
  if (!ledger || !ledger.runStarted) return null;
  if (ledger.verifyPassed !== true) return 'vibe.verify not passed — run /vibe.verify before committing';
  if (!ledger.verifyAt || ledger.verifyAt <= ledger.runStarted) return 'verifyAt is not after runStarted — re-run /vibe.verify';
  const edit = lastCodeEdit(PROJECT_DIR);
  if (edit && edit.at > ledger.verifyAt) {
    return `code edited after verify (${edit.filePath || 'unknown file'} at ${edit.at}) — re-run /vibe.verify`;
  }
  return null;
}

const __ledger = readLedger(PROJECT_DIR);
const __gateReason = verifyGateReason(__ledger);
if (__gateReason) {
  logHookDecision('auto-commit', 'git-commit', 'block', __gateReason);
  process.stderr.write(`[auto-commit] SKIP: ${__gateReason}\n`);
  process.exit(0);
}
if (__ledger && __ledger.runStarted && __ledger.verifyBasis === VERIFY_BASIS.selfReport) {
  // 허용하되 등급을 남긴다 — 독립 실행 없이 통과한 커밋임을 로그에서 구분할 수 있게
  process.stderr.write('[auto-commit] NOTE: verifyPassed is self-report basis (no independent test run backs it)\n');
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
