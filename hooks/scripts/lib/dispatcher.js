/**
 * Hook dispatcher library — 여러 hook script를 단일 이벤트에서 병렬 실행.
 *
 * 목적:
 * - stdin을 한 번만 읽어 각 자식에 동일 버퍼로 pipe (중복 파싱/읽기 방지)
 * - config.hooks[name].enabled 로 개별 토글
 * - 한 스크립트 실패가 다른 스크립트를 막지 않도록 cascade 격리
 * - PreToolUse 계열: 자식 중 하나라도 exit 2(deny)면 상위에 전파
 *
 * 직렬 → 병렬 전환 (2026-04):
 *   기존 직렬 실행은 tool당 150~300ms 누적 오버헤드를 유발.
 *   PreToolUse 가드는 모두 독립적 검증자이므로 병렬화해도 의미상 문제 없음.
 *   트레이드오프:
 *     - early-deny 낭비: sentinel-guard가 block이어도 pre-tool/scope-guard가
 *       이미 spawn됨. 실측 μs 수준이라 무시.
 *     - stderr 인터리빙: 가드 2개가 동시 block 시 경고 메시지가 섞일 수 있음.
 *       각 메시지는 자체적으로 완결된 라인이라 가독성 문제 없음.
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
 * 디스패처 실행 — 활성화된 스텝을 병렬로 spawn.
 * @param {Array<{name: string, script: string, args?: string[], denyOnExit2?: boolean, timeoutMs?: number}>} steps
 */
export async function dispatch(steps) {
  const stdinData = await readStdin();
  const hookConfig = loadHookConfig();

  const enabledSteps = steps.filter(s => isEnabled(hookConfig, s.name));
  const results = await Promise.all(
    enabledSteps.map(step =>
      runScript(step.script, step.args || [], stdinData, step.timeoutMs || 30000)
        .then(code => ({ step, code }))
    )
  );

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
      } catch {
        // 크래시 격리 — 실패 step은 exit 1 취급, 나머지 step과 디스패처는 계속
        return { step, code: 1 };
      }
    })
  );

  // 하나라도 deny(exit 2) 반환 → 상위에 전파
  if (results.some(({ step, code }) => step.denyOnExit2 && code === 2)) {
    process.exit(2);
  }
}
