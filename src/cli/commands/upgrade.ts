/**
 * upgrade 명령어 — 전역 패키지 최신 버전으로 업그레이드
 */

import { execFileSync, execSync } from 'child_process';
import { readdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
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
 * Read status formatter from the package that was just installed.
 *
 * WHY: `vibe upgrade` keeps running in the old process after npm install.
 * Loading auth.js from the installed package prevents stale post-upgrade labels.
 */
export function readInstalledLLMStatus(globalRoot: string): string {
  const authPath = join(globalRoot, '@su-record', 'vibe', 'dist', 'cli', 'auth.js');
  const authUrl = `${pathToFileURL(authPath).href}?t=${Date.now()}`;
  const script = [
    `import(${JSON.stringify(authUrl)})`,
    ".then(m => process.stdout.write(m.formatLLMStatus()))",
    ".catch(e => { process.stderr.write(String(e?.message || e)); process.exit(1); });",
  ].join('');
  return execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

/**
 * Upgrade global package to latest version
 * npm install -g → postinstall handles global config
 */
export function upgrade(_options: CliOptions = { silent: false }): void {
  try {
    log('⬆️ Upgrading to latest version...\n');

    cleanStaleTempDirs();

    // --prefer-online: npm 캐시 대신 레지스트리에서 최신 버전 확인
    execSync('npm install -g @su-record/vibe@latest --prefer-online', {
      stdio: 'pipe',
    });

    // 설치된 새 버전을 디스크에서 직접 읽기 (현재 프로세스의 캐시된 값이 아닌)
    let newVersion = 'unknown';
    let globalRoot = '';
    try {
      globalRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
      const installedPkg = JSON.parse(
        readFileSync(
          join(globalRoot, '@su-record', 'vibe', 'package.json'),
          'utf-8'
        )
      ) as { version: string };
      newVersion = installedPkg.version;
    } catch {
      newVersion = getPackageJson().version;
    }

    let llmStatus = formatLLMStatus();
    try {
      if (globalRoot) llmStatus = readInstalledLLMStatus(globalRoot);
    } catch { /* fallback to current process formatter */ }

    log(`\n✅ vibe upgraded (v${newVersion})\n\n${llmStatus}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Upgrade failed:', message);
    process.exit(1);
  }
}
