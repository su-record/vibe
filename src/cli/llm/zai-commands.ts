/**
 * ZAI (Z.ai / GLM) CLI 명령어
 *
 * - vibe zai key <k>          일반 API 키 설정 (pay-as-you-go)
 * - vibe zai coding-key <k>   GLM Coding Plan 키 설정 (UI/코드 담당, 별도 키)
 * - vibe zai status           상태 확인
 * - vibe zai logout           설정 제거
 */

import {
  patchGlobalConfig,
  readGlobalConfig,
  writeGlobalConfig,
  getVibeDir,
} from '../../infra/lib/config/GlobalConfigManager.js';

/** 일반(pay-as-you-go) API 키 저장 */
export function setZaiKey(apiKey: string): void {
  patchGlobalConfig({
    credentials: { zai: { apiKey, createdAt: new Date().toISOString() } },
  });
  console.log(`ZAI API key configured (general).\nStored: ${getVibeDir()}/config.json`);
}

/** GLM Coding Plan 키 저장 (UI/코드 담당) */
export function setZaiCodingKey(apiKey: string): void {
  patchGlobalConfig({
    credentials: { zai: { codingApiKey: apiKey, createdAt: new Date().toISOString() } },
  });
  console.log(
    `ZAI Coding Plan key configured.\n` +
    `Stored: ${getVibeDir()}/config.json\n` +
    `GLM(최고 모델)이 UI 개발을 담당합니다.`
  );
}

export function zaiStatus(): void {
  const config = readGlobalConfig();
  const creds = config.credentials?.zai;
  const hasCoding = Boolean(creds?.codingApiKey) || Boolean(process.env.ZAI_CODING_API_KEY);
  const hasGeneral = Boolean(creds?.apiKey) || Boolean(process.env.ZAI_API_KEY);

  if (!hasCoding && !hasGeneral) {
    console.log(`
ZAI Status

No credentials found.

Set up:
  vibe zai coding-key <key>   GLM Coding Plan (UI/code)
  vibe zai key <key>          General API
    `);
    return;
  }

  const models = config.models;
  console.log([
    '\nZAI (Z.ai / GLM) Status\n',
    `Coding Plan key: ${hasCoding ? '✓' : '⬚ —'}`,
    `General key:     ${hasGeneral ? '✓' : '⬚ —'}`,
    '\nModels:',
    `  zai (general) = ${models?.zai || process.env.ZAI_MODEL || '(default glm-4.6)'}`,
    `  zaiCoding     = ${models?.zaiCoding || '(default glm-4.6)'}\n`,
  ].join('\n'));
}

export function zaiLogout(): void {
  const config = readGlobalConfig();
  if (config.credentials?.zai) {
    delete config.credentials.zai;
    writeGlobalConfig(config);
    console.log('ZAI credentials removed from ~/.vibe/config.json');
  } else {
    console.log('ZAI no credentials found');
  }
}
