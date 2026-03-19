/**
 * upgrade 명령어 — 전역 패키지 최신 버전으로 업그레이드
 */

import { execSync } from 'child_process';
import { readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { CliOptions } from '../types.js';
import { log, getPackageJson } from '../utils.js';
import { formatLLMStatus } from '../auth.js';

/**
 * Remove stale npm temp directories that cause ENOTEMPTY errors
 */
function cleanStaleTempDirs(): void {
  try {
    const parentDir = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const scopeDir = join(parentDir, '@su-record');
    const entries = readdirSync(scopeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('.vibe-')) {
        rmSync(join(scopeDir, entry.name), { recursive: true, force: true });
      }
    }
  } catch {
    // Scope dir may not exist yet — ignore
  }
}

/**
 * Upgrade global package to latest version
 * npm install -g → postinstall handles global config
 */
export function upgrade(_options: CliOptions = { silent: false }): void {
  try {
    log('⬆️ Upgrading to latest version...\n');

    cleanStaleTempDirs();

    execSync('npm install -g @su-record/vibe@latest', {
      stdio: 'pipe',
    });

    const packageJson = getPackageJson();
    log(`\n✅ vibe upgraded (v${packageJson.version})\n\n${formatLLMStatus()}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Upgrade failed:', message);
    process.exit(1);
  }
}
