/**
 * CLI Commands: vibe daemon <subcommand>
 * Phase 1: Agent Engine
 *
 * Commands:
 * - vibe daemon start    - Start background daemon
 * - vibe daemon stop     - Stop daemon (graceful)
 * - vibe daemon status   - Show daemon status
 * - vibe daemon restart  - Restart daemon
 */

import * as child_process from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as url from 'node:url';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const PID_FILE = path.join(VIBE_DIR, 'daemon.pid');
const TOKEN_FILE = path.join(VIBE_DIR, 'daemon.token');
const SOCKET_PATH = process.platform === 'win32'
  ? `\\\\.\\pipe\\vibe-daemon-${os.userInfo().username}`
  : path.join(VIBE_DIR, 'daemon.sock');

function readPid(): number | null {
  try {
    if (!fs.existsSync(PID_FILE)) return null;
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readToken(): string | undefined {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
    }
  } catch {
    // Ignore
  }
  return undefined;
}

export function daemonStart(): void {
  const pid = readPid();
  if (pid !== null && isProcessRunning(pid)) {
    console.log(`⚠️  Daemon is already running (PID: ${pid})`);
    return;
  }

  // Clean up stale PID file
  if (pid !== null) {
    console.log(`🧹 Removing stale PID file (PID ${pid} not running)`);
    try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
  }

  // Find the daemon entry point (cross-platform, works regardless of install location)
  const daemonPath = url.fileURLToPath(new URL('../../daemon/VibeDaemon.js', import.meta.url));

  if (!fs.existsSync(daemonPath)) {
    console.error(`❌ Daemon module not found at: ${daemonPath}`);
    console.error('   Run "npm run build" first.');
    process.exit(1);
  }

  // Fork daemon process
  const child = child_process.fork(daemonPath, [], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, VIBE_DAEMON: '1' },
  });

  child.unref();

  // Wait briefly for daemon to start
  setTimeout(() => {
    const newPid = readPid();
    if (newPid !== null && isProcessRunning(newPid)) {
      console.log(`✅ Daemon started (PID: ${newPid})`);
    } else {
      console.error('❌ Daemon failed to start. Check logs: ~/.vibe/logs/daemon.log');
      process.exit(1);
    }
  }, 1500);
}

export function daemonStop(): void {
  const pid = readPid();
  if (pid === null || !isProcessRunning(pid)) {
    console.log('ℹ️  Daemon is not running');
    return;
  }

  console.log(`⏳ Stopping daemon (PID: ${pid})...`);

  // Try IPC graceful stop first
  const token = readToken();
  import('../../daemon/DaemonIPC.js').then(({ DaemonIPC }) => {
    DaemonIPC.sendRequest(SOCKET_PATH, 'daemon.stop', undefined, token, 5000)
      .then(() => {
        // Wait for process to exit
        let checks = 0;
        const interval = setInterval(() => {
          checks++;
          if (!isProcessRunning(pid)) {
            clearInterval(interval);
            console.log('✅ Daemon stopped');
          } else if (checks >= 20) {
            clearInterval(interval);
            // Force kill
            try {
              process.kill(pid, 'SIGKILL');
              console.log('⚠️  Daemon force-killed');
            } catch {
              console.log('✅ Daemon stopped');
            }
            // Clean up
            try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
            try { fs.unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
          }
        }, 500);
      })
      .catch(() => {
        // IPC failed, send SIGTERM directly
        try {
          process.kill(pid, 'SIGTERM');
        } catch { /* ignore */ }
        setTimeout(() => {
          if (isProcessRunning(pid)) {
            try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
          }
          try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
          try { fs.unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
          console.log('✅ Daemon stopped');
        }, 3000);
      });
  }).catch(() => {
    // Module not available, try SIGTERM
    try {
      process.kill(pid, 'SIGTERM');
      console.log('✅ SIGTERM sent');
    } catch (err) {
      console.error('❌ Failed to stop daemon:', (err as Error).message);
    }
  });
}

export async function daemonStatus(): Promise<void> {
  const pid = readPid();
  const isJson = process.argv.includes('--json');

  if (pid === null || !isProcessRunning(pid)) {
    if (isJson) {
      console.log(JSON.stringify({ running: false }));
    } else {
      console.log('ℹ️  Daemon is not running');
    }
    return;
  }

  // Try to get health via IPC
  try {
    const token = readToken();
    const { DaemonIPC } = await import('../../daemon/DaemonIPC.js');
    const health = await DaemonIPC.sendRequest(
      SOCKET_PATH,
      'daemon.health',
      undefined,
      token,
      5000
    ) as Record<string, unknown>;

    if (isJson) {
      console.log(JSON.stringify({ running: true, pid, ...health }, null, 2));
    } else {
      const uptimeMs = health.uptime as number;
      const uptimeSec = Math.floor(uptimeMs / 1000);
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;

      const mem = health.memory as Record<string, number>;
      const memMB = Math.round((mem?.rss || 0) / 1024 / 1024);

      console.log(`
🟢 Daemon Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PID:             ${pid}
  Status:          ${health.status}
  Version:         ${health.version}
  Uptime:          ${hours}h ${minutes}m ${seconds}s
  Active Sessions: ${health.activeSessions}
  Memory:          ${memMB} MB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `.trim());
    }
  } catch {
    if (isJson) {
      console.log(JSON.stringify({ running: true, pid, health: null }));
    } else {
      console.log(`🟡 Daemon is running (PID: ${pid}) but IPC is unavailable`);
    }
  }
}

export function daemonRestart(): void {
  const pid = readPid();

  const upgradeAndStart = (): void => {
    // 패키지 전역 재설치 (postinstall로 전역 에셋 복원)
    try {
      console.log('⬆️  Upgrading package...');
      child_process.execSync('npm install -g @su-record/core@latest', { stdio: 'pipe' });
      console.log('✅ Package updated');
    } catch {
      console.log('⚠️  Package upgrade skipped (offline or up-to-date)');
    }
    daemonStart();
  };

  if (pid !== null && isProcessRunning(pid)) {
    console.log('⏳ Restarting daemon...');
    try {
      process.kill(pid, 'SIGTERM');
    } catch { /* ignore */ }

    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      if (!isProcessRunning(pid) || checks >= 20) {
        clearInterval(interval);
        try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
        try { fs.unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
        try { fs.unlinkSync(TOKEN_FILE); } catch { /* ignore */ }
        upgradeAndStart();
      }
    }, 500);
  } else {
    upgradeAndStart();
  }
}

export function daemonHelp(): void {
  console.log(`
Vibe Daemon Commands:
  vibe start                   데몬 시작 + 인터페이스 활성화 + 부팅 자동시작
  vibe stop                    데몬 중지 + 인터페이스 비활성화 + 자동시작 해제
  vibe restart                 데몬 재시작
  vibe daemon status           데몬 상태 확인
  vibe daemon status --json    JSON 형식 상태

Log file: ~/.vibe/logs/daemon.log
  `);
}
