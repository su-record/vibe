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

/**
 * .env 파일 파싱 (KEY=VALUE 형식, # 주석 무시)
 * 값이 빈 문자열인 키는 제외
 */
function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawValue = trimmed.slice(eqIdx + 1);
    const value = rawValue.replace(/#.*$/, '').trim();
    if (key && value) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 패키지의 .env 파싱 → settings.json env 섹션에 주입
 * 빌드 시 .env.example → .env 변환됨
 * 값이 있는 변수만 주입 (빈 값은 무시)
 * 이미 settings.json에 값이 있으면 덮어쓰지 않음 (사용자 설정 보존)
 */
export function injectEnvDefaults(packageRoot: string): void {
  const envPath = path.join(packageRoot, '.env');
  if (!fs.existsSync(envPath)) return;

  const envVars = parseEnvFile(envPath);
  if (Object.keys(envVars).length === 0) return;

  const globalClaudeDir = path.join(os.homedir(), '.claude');
  const globalSettingsPath = path.join(globalClaudeDir, 'settings.json');

  try {
    let settings: Record<string, unknown> = {};
    if (fs.existsSync(globalSettingsPath)) {
      settings = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf-8'));
    }

    if (!settings.env || typeof settings.env !== 'object') {
      settings.env = {};
    }
    const env = settings.env as Record<string, string>;

    let changed = false;
    let count = 0;
    for (const [key, value] of Object.entries(envVars)) {
      if (!env[key]) {
        env[key] = value;
        changed = true;
        count++;
      }
    }

    if (changed) {
      fs.writeFileSync(globalSettingsPath, JSON.stringify(settings, null, 2) + '\n');
      console.log(`   ✓ Injected ${count} env defaults to settings.json`);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('   ⚠️  Failed to inject env defaults: ' + message);
  }
}

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
