/**
 * upgrade 명령어 — 전역 패키지 최신 버전으로 업그레이드
 */

import { execSync } from 'child_process';
import { CliOptions } from '../types.js';
import { log, getPackageJson } from '../utils.js';
import { formatLLMStatus } from '../auth.js';

/**
 * 전역 패키지를 최신 버전으로 업그레이드
 * npm install -g 실행 → postinstall이 전역 설정 자동 처리
 */
export function upgrade(options: CliOptions = { silent: false }): void {
  try {
    log('⬆️ Upgrading to latest version...\n');

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
