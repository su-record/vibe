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
import { findCodexCredentials } from '../../infra/lib/gpt/auth.js';

/**
 * GPT 상태 확인
 * - codex CLI 설치/버전
 * - Codex CLI credential 감지
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

  // Codex CLI credential 자동 감지
  const codexCreds = findCodexCredentials();
  let codexAuthStatus = 'not detected';
  if (codexCreds) {
    const expiresAt = new Date(codexCreds.tokens.expires_at);
    const isExpired = isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();
    codexAuthStatus = isExpired
      ? 'detected (token expired, will auto-refresh)'
      : `detected (expires ${expiresAt.toLocaleString()})`;
  }

  const modelGpt = config.models?.gpt || 'gpt-5.4 (default)';
  const modelSpark = config.models?.gptSpark || 'gpt-5.4-pro (default)';

  console.log(`
GPT Status

Codex CLI: ${codexVersion}
Codex Auth: ${codexAuthStatus}
API Key: ${hasApiKey ? 'configured (for embeddings)' : 'not set'}

Models:
  gpt (review):    ${modelGpt}
  gpt-spark (research): ${modelSpark}

Auth priority: oauth (config) > codex-cli (~/.codex/auth.json) > apikey
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
