/**
 * 전역 설정 관리
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

/** 전역 ~/.claude/settings.json에 설정해야 할 env 변수 */
const GLOBAL_ENV_SETTINGS: Record<string, string> = {
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
};

/** 전역 ~/.claude/settings.json에 설정해야 할 최상위 속성 */
const GLOBAL_TOP_LEVEL_SETTINGS: Record<string, string> = {
  teammateMode: 'in-process',
};

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

/**
 * 전역 ~/.claude/settings.json에 env 변수 설정
 * 모든 세션, 모든 프로젝트에서 동일하게 적용되어야 하는 환경변수를 전역 설정에 등록
 */
export function ensureGlobalEnvSettings(): void {
  const globalClaudeDir = path.join(os.homedir(), '.claude');
  const globalSettingsPath = path.join(globalClaudeDir, 'settings.json');

  try {
    // 디렉토리 확보
    if (!fs.existsSync(globalClaudeDir)) {
      fs.mkdirSync(globalClaudeDir, { recursive: true });
    }

    // 기존 설정 읽기 또는 빈 객체
    let settings: Record<string, unknown> = {};
    if (fs.existsSync(globalSettingsPath)) {
      const content = fs.readFileSync(globalSettingsPath, 'utf-8');
      settings = JSON.parse(content);
    }

    // env 블록 확보
    if (!settings.env || typeof settings.env !== 'object') {
      settings.env = {};
    }
    const env = settings.env as Record<string, string>;

    // env 변수 설정 (이미 동일 값이면 스킵)
    let changed = false;
    for (const [key, value] of Object.entries(GLOBAL_ENV_SETTINGS)) {
      if (env[key] !== value) {
        env[key] = value;
        changed = true;
      }
    }

    // 최상위 속성 설정 (teammateMode 등)
    for (const [key, value] of Object.entries(GLOBAL_TOP_LEVEL_SETTINGS)) {
      if (settings[key] !== value) {
        settings[key] = value;
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(globalSettingsPath, JSON.stringify(settings, null, 2) + '\n');
      console.log('   ✓ Global settings updated (Agent Teams + teammateMode)');
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('   ⚠️  Failed to update global env settings: ' + message);
  }
}
