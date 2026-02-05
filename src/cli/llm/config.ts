/**
 * LLM 설정 관리
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { ExternalLLMConfig, VibeConfig } from '../types.js';

/**
 * 외부 LLM 설정
 */
export const EXTERNAL_LLMS: Record<string, ExternalLLMConfig> = {
  gpt: {
    name: 'core-gpt',
    role: 'architecture',
    description: 'Architecture/Debugging (GPT 5.2)',
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
  kimi: {
    name: 'core-kimi',
    role: 'code-review',
    description: 'Code Review/Reasoning (Kimi K2.5)',
    package: '',
    envKey: 'MOONSHOT_API_KEY'
  }
};

/**
 * 전역 설정 디렉토리 경로 가져오기
 */
export function getGlobalConfigDir(): string {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vibe');
}

/**
 * 외부 LLM API 키로 설정 (전역 저장소)
 */
export function setupExternalLLM(llmType: string, apiKey: string): void {
  if (!apiKey) {
    console.log(`
❌ API key required.

Usage:
  vibe ${llmType} key <api-key>

${llmType === 'gpt' ? 'OpenAI API key: https://platform.openai.com/api-keys' : 'Google API key: https://aistudio.google.com/apikey'}
    `);
    return;
  }

  // 전역 설정 디렉토리에 저장
  const globalConfigDir = getGlobalConfigDir();
  if (!fs.existsSync(globalConfigDir)) {
    fs.mkdirSync(globalConfigDir, { recursive: true });
  }

  const authFile = path.join(globalConfigDir, `${llmType}-apikey.json`);
  const authData = {
    type: 'apikey',
    apiKey: apiKey,
    createdAt: Date.now()
  };

  fs.writeFileSync(authFile, JSON.stringify(authData, null, 2));

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

  console.log(`
✅ ${llmType.toUpperCase()} API key configured!

Role: ${llmConfig.description}
Stored: ${authFile}

${llmType.toUpperCase()} is called directly via Hooks:
  - Auto-called with "${llmType}. query" prefix
  - Direct use: import('@su-record/core/lib/${llmType}')

Disable: vibe ${llmType} remove
  `);
}

/**
 * 외부 LLM 제거 (전역 + 프로젝트)
 */
export function removeExternalLLM(llmType: string): void {
  const globalConfigDir = getGlobalConfigDir();
  let removed = false;

  // 1. 전역 API 키 파일 삭제
  const apiKeyFile = path.join(globalConfigDir, `${llmType}-apikey.json`);
  if (fs.existsSync(apiKeyFile)) {
    fs.unlinkSync(apiKeyFile);
    removed = true;
  }

  // 2. 전역 OAuth 토큰 파일 삭제
  const authFile = path.join(globalConfigDir, `${llmType}-auth.json`);
  if (fs.existsSync(authFile)) {
    fs.unlinkSync(authFile);
    removed = true;
  }

  // 3. 프로젝트 config.json 비활성화 (선택적)
  const projectRoot = process.cwd();
  const coreDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(coreDir, 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.models?.[llmType as 'gpt' | 'gemini']) {
        config.models[llmType as 'gpt' | 'gemini']!.enabled = false;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    } catch { /* ignore */ }
  }

  if (removed) {
    console.log(`✅ ${llmType.toUpperCase()} credentials removed`);
  } else {
    console.log(`ℹ️ ${llmType.toUpperCase()} no credentials found`);
  }
}
