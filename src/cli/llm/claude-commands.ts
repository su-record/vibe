/**
 * Claude API CLI 명령어
 */

import path from 'path';
import fs from 'fs';
import { getGlobalConfigDir, removeExternalLLM } from './config.js';
import type { VibeConfig } from '../types.js';

/**
 * Claude API 상태 확인
 */
export function claudeStatus(): void {
  const configDir = getGlobalConfigDir();
  const apiKeyPath = path.join(configDir, 'claude-apikey.json');

  let hasFileKey = false;
  let maskedKey = '';

  try {
    if (fs.existsSync(apiKeyPath)) {
      const data = JSON.parse(fs.readFileSync(apiKeyPath, 'utf-8'));
      if (data.apiKey) {
        hasFileKey = true;
        const key = data.apiKey as string;
        maskedKey = key.length > 7 ? `${key.slice(0, 3)}***${key.slice(-4)}` : '***';
      }
    }
  } catch { /* ignore */ }

  const hasEnvKey = !!process.env.ANTHROPIC_API_KEY;

  if (!hasFileKey && !hasEnvKey) {
    console.log(`
Claude API: ✗ Not configured

Setup:
  vibe claude key <ANTHROPIC_API_KEY>
  vibe setup

Get key: https://console.anthropic.com/settings/keys
    `);
    return;
  }

  const methods: string[] = [];
  if (hasFileKey) methods.push(`✓ API Key (${maskedKey})`);
  if (hasEnvKey) methods.push('✓ ANTHROPIC_API_KEY env');

  console.log(`
Claude API: ${methods.join(', ')}

Models: Claude Opus 4.5, Sonnet 4.5, Haiku 4.5
Role: Fallback / Direct API

Manage:
  vibe claude logout    Remove key
  `);
}

/**
 * Claude API 로그아웃 (키 삭제)
 */
export function claudeLogout(): void {
  removeExternalLLM('claude');

  // 프로젝트 config.json 업데이트
  const projectRoot = process.cwd();
  const configPath = path.join(projectRoot, '.claude', 'vibe', 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.models?.claude) {
        config.models.claude.enabled = false;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    } catch { /* ignore */ }
  }
}
