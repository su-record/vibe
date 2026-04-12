/**
 * Hook dispatcher library — 여러 hook script를 단일 이벤트에서 직렬 실행.
 *
 * 목적:
 * - 동일 이벤트에 등록된 N개 스크립트의 **병렬 spawn 폭주**를 순차화
 * - stdin을 한 번만 읽어 각 자식에 그대로 pipe (중복 파싱/읽기 방지)
 * - config.hooks[name].enabled 로 개별 토글
 * - 한 스크립트 실패가 다음 실행을 막지 않도록 cascade 격리
 * - PreToolUse 계열: 자식이 exit 2(deny)면 즉시 상위에 전파
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(__dirname, '..');

function loadHookConfig() {
  try {
    const configPath = path.join(
      process.env.CLAUDE_PROJECT_DIR || process.cwd(),
      '.claude', 'vibe', 'config.json'
    );
    if (!fs.existsSync(configPath)) return {};
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
    const proc = spawn(process.execPath, [scriptPath, ...args], {
      stdio: ['pipe', 'inherit', 'inherit'],
      timeout: timeoutMs,
    });
    if (stdinData) proc.stdin.end(stdinData);
    else proc.stdin.end();
    proc.on('close', (code) => resolve(code ?? 0));
    proc.on('error', () => resolve(1));
  });
}

/**
 * 디스패처 실행.
 * @param {Array<{name: string, script: string, args?: string[], denyOnExit2?: boolean, timeoutMs?: number}>} steps
 */
export async function dispatch(steps) {
  const stdinData = await readStdin();
  const hookConfig = loadHookConfig();

  for (const step of steps) {
    if (!isEnabled(hookConfig, step.name)) continue;
    const code = await runScript(
      step.script,
      step.args || [],
      stdinData,
      step.timeoutMs || 30000
    );
    if (step.denyOnExit2 && code === 2) {
      process.exit(2);
    }
  }
}
