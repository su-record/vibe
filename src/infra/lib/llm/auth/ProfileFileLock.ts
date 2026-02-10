/**
 * ProfileFileLock - Auth Profile 파일 잠금
 * mkdir atomic 패턴으로 cross-process 안전한 파일 잠금
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const LOCK_STALE_MS = 30_000; // 30초
const POLL_INTERVAL_MS = 200;
const DEFAULT_TIMEOUT_MS = 10_000;

function getDefaultLockPath(): string {
  const configDir = process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(os.homedir(), '.config', 'vibe');
  return path.join(configDir, '.auth-profiles.lock');
}

export class ProfileFileLock {
  private readonly lockPath: string;
  private held = false;

  constructor(lockPath?: string) {
    this.lockPath = lockPath ?? getDefaultLockPath();
  }

  async acquire(timeout: number = DEFAULT_TIMEOUT_MS): Promise<void> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      try {
        fs.mkdirSync(this.lockPath, { recursive: false });
        // Write PID for stale detection
        fs.writeFileSync(path.join(this.lockPath, 'pid'), String(process.pid));
        this.held = true;
        return;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
          // Check for stale lock
          if (this.isStale()) {
            this.forceRelease();
            continue;
          }
          await this.sleep(POLL_INTERVAL_MS);
          continue;
        }
        throw err;
      }
    }

    throw new Error(`ProfileFileLock: timeout after ${timeout}ms`);
  }

  release(): void {
    if (!this.held) return;
    this.forceRelease();
    this.held = false;
  }

  isLocked(): boolean {
    return fs.existsSync(this.lockPath);
  }

  private isStale(): boolean {
    try {
      const pidPath = path.join(this.lockPath, 'pid');
      if (!fs.existsSync(pidPath)) {
        const stat = fs.statSync(this.lockPath);
        return Date.now() - stat.mtimeMs > LOCK_STALE_MS;
      }
      const pidStr = fs.readFileSync(pidPath, 'utf-8').trim();
      const pid = parseInt(pidStr, 10);
      if (isNaN(pid)) return true;

      // Check if process is alive
      try {
        process.kill(pid, 0);
        // Process alive — check time
        const stat = fs.statSync(this.lockPath);
        return Date.now() - stat.mtimeMs > LOCK_STALE_MS;
      } catch {
        // Process dead — stale
        return true;
      }
    } catch {
      return true;
    }
  }

  private forceRelease(): void {
    try {
      const pidPath = path.join(this.lockPath, 'pid');
      if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
      fs.rmdirSync(this.lockPath);
    } catch {
      // Already released
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
