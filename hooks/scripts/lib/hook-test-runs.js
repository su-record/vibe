/**
 * Hook Test Runs — 훅 프로세스가 스스로 실행·관측한 사실의 append-only 기록.
 *
 * 파일: <projectDir>/.vibe/metrics/hook-test-runs.jsonl
 * 한 줄 = { kind: 'edit' | 'auto-test' | 'verify-run', at, filePath?, command?, exitCode?, runId? }
 *
 *   edit        post-edit-dispatcher — 코드 파일 편집 이벤트 (auto-commit 의 신선도 판정 근거)
 *   auto-test   auto-test — 편집 파일의 관련 테스트 실행 결과 (보조 증거)
 *   verify-run  verify-runner — verify 시점 전체 테스트 명령 실행 결과 (게이트 근거)
 *
 * WHY jsonl (run-ledger.json 안의 배열이 아니라): post-edit 의 세 step 이 병렬이라
 * withLedgerLock 의 `wx` 잠금이 경합하면 false 로 조용히 유실된다. 한 줄 append 는
 * 원자적이라 잠금이 필요 없다.
 *
 * 쓰는 주체는 훅 프로세스뿐이다 — SKILL.md 는 모델에게 이 파일을 쓰라고 지시하지
 * 않는다. 위조 불가능은 주장하지 않는다 (SPEC verify-gate-independence Constraints).
 * 모든 함수는 fail-open.
 */
import fs from 'fs';
import path from 'path';

const KINDS = new Set(['edit', 'auto-test', 'verify-run']);

/** 기록 파일 경로 */
export function hookTestRunsPath(projectDir) {
  return path.join(projectDir, '.vibe', 'metrics', 'hook-test-runs.jsonl');
}

/**
 * 한 줄 append. `at` 은 없으면 지금 시각.
 * @param {string} projectDir
 * @param {{ kind: string, at?: string, filePath?: string, command?: string, exitCode?: number, runId?: string|null }} entry
 * @returns {boolean}
 */
export function appendHookTestRun(projectDir, entry) {
  try {
    if (!entry || !KINDS.has(entry.kind)) return false;
    const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
    const target = hookTestRunsPath(projectDir);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, line + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * 전체 기록 읽기. 깨진 줄은 건너뛴다.
 * @param {string} projectDir
 * @returns {object[]}
 */
export function readHookTestRuns(projectDir) {
  try {
    const target = hookTestRunsPath(projectDir);
    if (!fs.existsSync(target)) return [];
    return fs.readFileSync(target, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .flatMap(line => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
  } catch {
    return [];
  }
}

/** 기록 비우기 — recordRunStart 가 호출한다 (run 단위 기록). */
export function clearHookTestRuns(projectDir) {
  try {
    const target = hookTestRunsPath(projectDir);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * 마지막 코드 편집 이벤트. 없으면 null.
 * @param {string} projectDir
 * @returns {{ at: string, filePath?: string }|null}
 */
export function lastCodeEdit(projectDir) {
  const edits = readHookTestRuns(projectDir)
    .filter(entry => entry.kind === 'edit' && typeof entry.at === 'string');
  return edits.length > 0 ? edits[edits.length - 1] : null;
}
