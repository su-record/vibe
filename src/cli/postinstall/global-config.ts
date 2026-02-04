/**
 * 전역 설정 관리
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * 전역 ~/.claude/settings.json에서 hooks 정리
 * core는 이제 프로젝트 레벨 (.claude/settings.local.json)에서 훅을 관리하므로
 * 전역 설정의 hooks는 제거해야 함 (레거시 정리)
 */
export function cleanupGlobalSettingsHooks(): void {
  const globalClaudeDir = path.join(os.homedir(), '.claude');
  const globalSettingsPath = path.join(globalClaudeDir, 'settings.json');

  if (!fs.existsSync(globalSettingsPath)) {
    return;
  }

  try {
    const content = fs.readFileSync(globalSettingsPath, 'utf-8');
    const settings = JSON.parse(content);

    // hooks가 있으면 제거
    if (settings.hooks) {
      delete settings.hooks;
      fs.writeFileSync(globalSettingsPath, JSON.stringify(settings, null, 2) + '\n');
      console.log('   ✓ Cleaned up legacy hooks from global settings');
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('   ⚠️  Failed to cleanup global settings hooks: ' + message);
  }
}
