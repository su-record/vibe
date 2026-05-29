/**
 * LLM 가용성 감지 유틸
 *
 * Claude/Codex/Antigravity CLI 활성화 여부를 런타임에 판단.
 * 결과는 프로세스당 1회 캐시.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface LlmAvailability {
  claude: boolean;
  codex: boolean;
  antigravity: boolean;
}

let cached: LlmAvailability | null = null;

function checkCliInstalled(binName: string, configDir: string): boolean {
  const hasDir = fs.existsSync(configDir);
  if (!/^[a-z]+$/.test(binName)) return hasDir;
  let hasBin = false;
  try {
    execSync(`which ${binName}`, { stdio: 'ignore' });
    hasBin = true;
  } catch {
    // not found
  }
  return hasBin || hasDir;
}

function checkAuthExists(configDir: string, authFileName: string): boolean {
  const authPath = path.join(configDir, authFileName);
  return fs.existsSync(authPath);
}

/**
 * Claude/Codex/Antigravity CLI 가용성 감지 (캐시)
 */
export function detectLlmAvailability(): LlmAvailability {
  if (cached) return cached;

  const claudeDir = path.join(os.homedir(), '.claude');
  const codexDir = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const antigravityRoot = path.join(os.homedir(), '.gemini');
  const antigravityDir = path.join(antigravityRoot, 'antigravity-cli');
  const legacyAntigravityDir = path.join(os.homedir(), '.antigravity');

  const claudeInstalled = checkCliInstalled('claude', claudeDir);
  const codexInstalled = checkCliInstalled('codex', codexDir);
  const antigravityInstalled = checkCliInstalled('agy', antigravityDir) ||
    fs.existsSync(legacyAntigravityDir);

  // 설치 + 인증 존재 시 활성화로 판단
  const claude = claudeInstalled;
  const codex = codexInstalled && checkAuthExists(codexDir, 'auth.json');
  const antigravity = antigravityInstalled && (
    checkAuthExists(antigravityDir, 'settings.json') ||
    !!process.env.ANTIGRAVITY_API_KEY
  );
  cached = { claude, codex, antigravity };
  return cached;
}

/** Claude CLI 활성화 여부 */
export function isClaudeAvailable(): boolean {
  return detectLlmAvailability().claude;
}

/** Codex CLI 활성화 여부 */
export function isCodexAvailable(): boolean {
  return detectLlmAvailability().codex;
}

/** Antigravity CLI 활성화 여부 */
export function isAntigravityAvailable(): boolean {
  return detectLlmAvailability().antigravity;
}

/** 캐시 초기화 (테스트용) */
export function resetLlmAvailabilityCache(): void {
  cached = null;
}
