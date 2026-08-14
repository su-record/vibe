/**
 * Hook dispatcher library — 여러 hook script를 단일 이벤트에서 실행.
 *
 * 목적:
 * - stdin을 한 번만 읽어 각 자식에 동일 버퍼로 pipe (중복 파싱/읽기 방지)
 * - config.hooks[name].enabled 로 개별 토글
 * - 한 스크립트 실패가 다른 스크립트를 막지 않도록 cascade 격리
 * - PreToolUse 계열: 자식 중 하나라도 exit 2(deny)면 상위에 전파
 *
 * 실행 모델이 둘로 갈린다 — 스텝이 서로 독립인지가 기준:
 *
 *   dispatch()          = 순차 (spawn). 유일한 사용처인 Stop 은 스텝끼리
 *                         부작용을 공유한다(auto-commit 의 git 상태를
 *                         devlog-gen 이 읽는다). 병렬화하면 auto-commit 의
 *                         git cascade 와 겹쳐 프로세스가 폭주하고,
 *                         devlog 가 커밋 이전 상태를 관측한다.
 *                         회귀 방지: __tests__/stop-dispatcher-sequential.test.js
 *
 *   dispatchInProcess() = 병렬 (import). PreToolUse 가드는 모두 독립적
 *                         검증자라 순서가 의미 없고, 직렬 실행은 tool당
 *                         150~300ms 누적 오버헤드를 유발한다.
 *                         트레이드오프:
 *                           - early-deny 낭비: sentinel-guard가 block이어도
 *                             pre-tool/scope-guard가 이미 실행됨. 실측 μs 수준.
 *                           - stderr 인터리빙: 가드 2개가 동시 block 시 경고가
 *                             섞일 수 있음. 각 메시지가 완결된 라인이라 무해.
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { readStdinSync, buildCtx } from './hook-context.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(__dirname, '..');

function loadHookConfig() {
  try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    // Vibe config 탐색 — `.vibe/` 를 SSOT 로 삼고, legacy `.claude/vibe/` fallback
    const candidates = [
      path.join(projectDir, '.vibe', 'config.json'),
      path.join(projectDir, '.claude', 'vibe', 'config.json'),
    ];
    const configPath = candidates.find(p => fs.existsSync(p));
    if (!configPath) return {};
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')).hooks || {};
  } catch {
    return {};
  }
}

function isEnabled(hookConfig, name) {
  const entry = hookConfig[name];
  if (entry && typeof entry === 'object' && entry.enabled === false) return false;
  return true;
}

/**
 * guard 크래시를 deny 로 승격할지 — `VIBE_HOOK_FAILCLOSED=0` 이면 끈다.
 *
 * fail-closed 는 "검증하지 못했으면 통과시키지 않는다" 는 안전한 기본값이지만,
 * guard 에 버그가 생기면 Edit·Bash 가 전면 차단되어 guard 소스를 고칠 수단까지
 * 막힌다. 그래서 탈출구는 선택이 아니라 **복구 유일 수단**이고, 차단 메시지가
 * 스스로 그 방법을 알려줘야 한다 (교착에 빠진 사용자는 문서를 찾아볼 수 없다).
 */
function isFailClosed() {
  return process.env.VIBE_HOOK_FAILCLOSED !== '0';
}

/**
 * step 크래시를 stderr 에 드러낸다. 침묵하면 게이트가 죽은 줄도 모른다.
 * @param {string} name
 * @param {unknown} err
 */
function reportCrash(name, err) {
  const message = (err && err.message) || String(err);
  process.stderr.write(`[vibe] hook step "${name}" crashed: ${message}\n`);
}

/**
 * 크래시한 step 의 종료 코드를 정한다.
 * deny 권한(denyOnExit2)이 있는 guard 만 2(deny)로 승격한다 — 로깅용 step 하나가
 * 죽었다고 도구 호출을 막을 이유는 없다.
 * @param {{ name: string, denyOnExit2?: boolean }} step
 * @returns {number}
 */
function crashExitCode(step) {
  if (!step.denyOnExit2 || !isFailClosed()) return 1;
  process.stderr.write(
    `[vibe] blocked: guard "${step.name}" could not complete, so the operation was not verified.\n` +
    `       To bypass temporarily, re-run with VIBE_HOOK_FAILCLOSED=0\n`
  );
  return 2;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

/**
 * 단일 스크립트 실행. stdin을 통해 입력 전달, stdout은 메인 stdout으로 통과.
 * @returns {Promise<number>} exit code
 */
function runScript(scriptName, args, stdinData, timeoutMs) {
  return new Promise((resolve) => {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    const env = buildChildEnv(stdinData);
    const proc = spawn(process.execPath, [scriptPath, ...args], {
      stdio: ['pipe', 'inherit', 'inherit'],
      timeout: timeoutMs,
      env,
    });
    if (stdinData) proc.stdin.end(stdinData);
    else proc.stdin.end();
    proc.on('close', (code) => resolve(code ?? 0));
    proc.on('error', () => resolve(1));
  });
}

function buildChildEnv(stdinData) {
  const env = { ...process.env };
  if (!stdinData) return env;

  env.HOOK_INPUT = stdinData;
  try {
    const parsed = JSON.parse(stdinData);
    if (parsed?.tool_input) {
      env.TOOL_INPUT = typeof parsed.tool_input === 'string'
        ? parsed.tool_input
        : JSON.stringify(parsed.tool_input);
    }
  } catch {
    // Leave legacy env untouched when stdin is not JSON.
  }
  return env;
}

/**
 * 디스패처 실행 — 활성화된 스텝을 선언 순서대로 **순차** spawn.
 *
 * 순차인 이유는 파일 상단 주석 참고 — 스텝이 git 상태 같은 부작용을 공유한다.
 * 앞 스텝이 실패해도 다음 스텝은 계속 실행한다(cascade 격리 유지).
 *
 * @param {Array<{name: string, script: string, args?: string[], denyOnExit2?: boolean, timeoutMs?: number}>} steps
 */
export async function dispatch(steps) {
  const stdinData = await readStdin();
  const hookConfig = loadHookConfig();

  const enabledSteps = steps.filter(s => isEnabled(hookConfig, s.name));
  const results = [];
  for (const step of enabledSteps) {
    const code = await runScript(step.script, step.args || [], stdinData, step.timeoutMs || 30000);
    results.push({ step, code });
  }

  // 하나라도 deny(exit 2) 반환 → 상위에 전파
  if (results.some(({ step, code }) => step.denyOnExit2 && code === 2)) {
    process.exit(2);
  }
}

/**
 * in-process 디스패처 — 자식 spawn 없이 import된 run(ctx)들을 병렬 실행.
 *
 * spawn 대비:
 *   - 자식 node VM 기동(~20ms × N)과 stdin 재읽기/재파싱 제거
 *   - 크래시 격리는 step별 try/catch로 대체 (throw → exit 1 취급, fail-open)
 *   - step별 강제 timeout은 없음 — 무거운 작업(포매터/테스트러너)은 모두
 *     자체 timeout을 가진 비동기 자식 프로세스라 디스패처가 행 걸리지 않는다
 *
 * deny 시맨틱 보존: denyOnExit2 step이 2를 반환하면 process.exit(2)로 상위 전파.
 *
 * @param {Array<{name: string, run: (ctx: object) => Promise<number>, denyOnExit2?: boolean}>} steps
 * @param {{ argvToolName?: string }} [options]
 */
export async function dispatchInProcess(steps, { argvToolName = '' } = {}) {
  const { raw, parsed } = readStdinSync();
  const ctx = buildCtx({ rawInput: raw, payload: parsed, argvToolName });
  const hookConfig = loadHookConfig();

  const enabledSteps = steps.filter(s => isEnabled(hookConfig, s.name));
  const results = await Promise.all(
    enabledSteps.map(async (step) => {
      try {
        return { step, code: await step.run(ctx) };
      } catch (err) {
        // 크래시 격리는 유지하되 침묵하지 않는다. deny 권한이 있는 guard 는
        // 검증에 실패한 것이므로 통과시키지 않는다 (fail-closed).
        reportCrash(step.name, err);
        return { step, code: crashExitCode(step) };
      }
    })
  );

  // 하나라도 deny(exit 2) 반환 → 상위에 전파
  if (results.some(({ step, code }) => step.denyOnExit2 && code === 2)) {
    process.exit(2);
  }
}
