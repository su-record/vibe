/**
 * AI CLI 감지 유틸리티
 *
 * Claude Code, Codex CLI, Gemini CLI 설치 여부를 자동 감지하여
 * 설치된 CLI에만 설정을 적용
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface AiCliStatus {
  installed: boolean;
  configDir: string;
  pluginDir?: string;
}

/**
 * Claude Code 설치 여부 감지
 * - `which claude` 실행 가능 여부
 * - `~/.claude/` 디렉토리 존재 여부
 * 둘 중 하나만 true면 installed: true
 */
export function detectClaudeCli(): AiCliStatus {
  const configDir = path.join(os.homedir(), '.claude');
  const hasDir = fs.existsSync(configDir);

  let hasBin = false;
  try {
    execSync('which claude', { stdio: 'ignore' });
    hasBin = true;
  } catch {
    // not found
  }

  return {
    installed: hasBin || hasDir,
    configDir,
  };
}

/**
 * Codex CLI 설치 여부 감지
 * - `which codex` 실행 가능 여부
 * - `~/.codex/` 디렉토리 존재 여부
 * 둘 중 하나만 true면 installed: true
 */
export function detectCodexCli(): AiCliStatus {
  const configDir = path.join(os.homedir(), '.codex');
  const hasDir = fs.existsSync(configDir);

  let hasBin = false;
  try {
    execSync('which codex', { stdio: 'ignore' });
    hasBin = true;
  } catch {
    // not found
  }

  return {
    installed: hasBin || hasDir,
    configDir,
    pluginDir: path.join(configDir, 'plugins', 'vibe'),
  };
}

/**
 * Gemini CLI 설치 여부 감지
 * - `which gemini` 실행 가능 여부
 * - `~/.gemini/` 디렉토리 존재 여부
 * 둘 중 하나만 true면 installed: true
 */
export function detectGeminiCli(): AiCliStatus {
  const configDir = path.join(os.homedir(), '.gemini');
  const hasDir = fs.existsSync(configDir);

  let hasBin = false;
  try {
    execSync('which gemini', { stdio: 'ignore' });
    hasBin = true;
  } catch {
    // not found
  }

  return {
    installed: hasBin || hasDir,
    configDir,
  };
}
