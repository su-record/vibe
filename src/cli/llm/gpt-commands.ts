/**
 * GPT CLI 명령어
 * v3: codex CLI 기반 — OAuth 제거, API Key (임베딩용) + codex CLI 상태 확인
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { VibeConfig } from '../types.js';
import {
  readGlobalConfig,
  writeGlobalConfig,
} from '../../infra/lib/config/GlobalConfigManager.js';

/**
 * GPT 상태 확인
 * - codex CLI 설치/버전
 * - API Key 상태 (임베딩용)
 * - 모델 설정
 */
export function gptStatus(): void {
  const config = readGlobalConfig();
  const gptCreds = config.credentials?.gpt;
  const hasApiKey = Boolean(gptCreds?.apiKey || process.env.OPENAI_API_KEY);

  // codex CLI 확인
  let codexVersion = '(not installed)';
  try {
    codexVersion = execSync('codex --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch { /* not installed */ }

  const modelGpt = config.models?.gpt || 'gpt-5.3-codex (default)';
  const modelSpark = config.models?.gptSpark || 'gpt-5.3-codex-spark (default)';

  console.log(`
GPT Status

Codex CLI: ${codexVersion}
API Key: ${hasApiKey ? 'configured (for embeddings)' : 'not set'}

Models:
  gpt (review):    ${modelGpt}
  gpt-spark (research): ${modelSpark}

Stored: ~/.vibe/config.json

Commands:
  vibe gpt key <key>     Set OpenAI API key (for embeddings)
  vibe gpt status        This status
  vibe gpt logout        Remove API key
  codex auth             Codex CLI authentication
  `);
}

/**
 * GPT 로그아웃 (API key 제거)
 */
export function gptLogout(): void {
  const config = readGlobalConfig();

  if (config.credentials?.gpt) {
    delete config.credentials.gpt;
    writeGlobalConfig(config);
    console.log('GPT API key removed from ~/.vibe/config.json');
  } else {
    console.log('No GPT credentials found');
  }

  const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const projConfig: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (projConfig.models?.gpt) {
        projConfig.models.gpt.enabled = false;
        fs.writeFileSync(configPath, JSON.stringify(projConfig, null, 2));
      }
    } catch { /* ignore */ }
  }
}
