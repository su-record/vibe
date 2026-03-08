/**
 * LLM 설정 관리
 * config.json 통합 방식 (v2)
 */

import path from 'path';
import fs from 'fs';
import { ExternalLLMConfig, VibeConfig } from '../types.js';
import { patchGlobalConfig, readGlobalConfig, writeGlobalConfig, getVibeDir } from '../../infra/lib/config/GlobalConfigManager.js';

// re-export (하위 호환)
export { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';

/**
 * 외부 LLM 설정
 */
export const EXTERNAL_LLMS: Record<string, ExternalLLMConfig> = {
  claude: {
    name: 'core-claude',
    role: 'fallback',
    description: 'Claude API (Anthropic Direct)',
    package: '',
    envKey: 'ANTHROPIC_API_KEY'
  },
  gpt: {
    name: 'core-gpt',
    role: 'architecture',
    description: 'Code Review/Analysis/Debugging (GPT 5.4 + Codex)',
    package: '@anthropics/openai-mcp',
    envKey: 'OPENAI_API_KEY'
  },
  gemini: {
    name: 'core-gemini',
    role: 'ui-ux',
    description: 'UI/UX Design (Gemini 3)',
    package: '@anthropics/gemini-mcp',
    envKey: 'GOOGLE_API_KEY'
  },
};

/**
 * 외부 LLM API 키로 설정 → config.json에 저장
 */
export function setupExternalLLM(llmType: string, apiKey: string): void {
  if (!apiKey) {
    console.log(`
API key required.

Usage:
  vibe ${llmType} key <api-key>

${llmType === 'gpt' ? 'OpenAI API key: https://platform.openai.com/api-keys' : 'Google API key: https://aistudio.google.com/apikey'}
    `);
    return;
  }

  // config.json에 저장
  const credentialKey = llmType === 'gpt' ? 'gpt' : 'gemini';
  patchGlobalConfig({
    credentials: {
      [credentialKey]: {
        apiKey,
        createdAt: new Date().toISOString(),
      },
    },
  });

  const llmConfig = EXTERNAL_LLMS[llmType];

  // 프로젝트 config.json도 업데이트 (선택적)
  const projectRoot = process.cwd();
  const coreDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(coreDir, 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (!config.models) config.models = {};
      config.models[llmType as 'gpt' | 'gemini'] = {
        enabled: true,
        authType: 'apikey',
        role: llmConfig.role,
        description: llmConfig.description,
      };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch { /* ignore: optional operation */ }
  }

  const configJsonPath = path.join(getVibeDir(), 'config.json');
  console.log(`
${llmType.toUpperCase()} API key configured!

Role: ${llmConfig.description}
Stored: ${configJsonPath}

${llmType.toUpperCase()} is called directly via Hooks:
  - Auto-called with "${llmType}. query" prefix
  - Direct use: import('@su-record/vibe/lib/${llmType}')

Disable: vibe ${llmType} remove
  `);
}

/**
 * 외부 LLM 제거 (config.json에서 삭제 + 프로젝트 비활성화)
 */
export function removeExternalLLM(llmType: string): void {
  const config = readGlobalConfig();
  let removed = false;

  const credentialKey = llmType as 'gpt' | 'gemini';
  if (config.credentials?.[credentialKey]) {
    delete config.credentials[credentialKey];
    removed = true;
  }

  if (removed) {
    writeGlobalConfig(config);
  }

  // 프로젝트 config.json 비활성화 (선택적)
  const projectRoot = process.cwd();
  const coreDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(coreDir, 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const projConfig: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (projConfig.models?.[llmType as 'gpt' | 'gemini']) {
        projConfig.models[llmType as 'gpt' | 'gemini']!.enabled = false;
        fs.writeFileSync(configPath, JSON.stringify(projConfig, null, 2));
      }
    } catch { /* ignore */ }
  }

  if (removed) {
    console.log(`${llmType.toUpperCase()} credentials removed`);
  } else {
    console.log(`${llmType.toUpperCase()} no credentials found`);
  }
}
