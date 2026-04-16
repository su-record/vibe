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
  /** 현재 인증 세션이 감지되는지 (파일/Keychain 기반, API 호출 없음). installed=false면 undefined. */
  authenticated?: boolean;
}

/**
 * Claude Code CLI 인증 감지 (파일/Keychain 기반, 빠름)
 * - macOS: `security` 커맨드로 "Claude Code-credentials" Keychain 항목 확인
 * - 그 외: `~/.claude/.credentials.json` 존재 여부
 */
function detectClaudeAuth(configDir: string): boolean {
  if (process.platform === 'darwin') {
    try {
      execSync('security find-generic-password -s "Claude Code-credentials"', { stdio: 'ignore' });
      return true;
    } catch {
      // fall through to file check
    }
  }
  return fs.existsSync(path.join(configDir, '.credentials.json'));
}

/**
 * Codex CLI 인증 감지 (`~/.codex/auth.json` 존재)
 */
function detectCodexAuth(configDir: string): boolean {
  return fs.existsSync(path.join(configDir, 'auth.json'));
}

/**
 * Gemini CLI 인증 감지 (`~/.gemini/oauth_creds.json` 존재 또는 GEMINI_API_KEY 환경변수)
 */
function detectGeminiAuth(configDir: string): boolean {
  if (process.env.GEMINI_API_KEY) return true;
  return fs.existsSync(path.join(configDir, 'oauth_creds.json'));
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

  const installed = hasBin || hasDir;
  return {
    installed,
    configDir,
    authenticated: installed ? detectClaudeAuth(configDir) : undefined,
  };
}

/**
 * coco 설치 여부 감지
 * - `COCO_HOME` 환경변수
 * - `~/.coco/` 디렉토리 존재 여부
 */
export function detectCocoCli(): AiCliStatus {
  const configDir = process.env.COCO_HOME || path.join(os.homedir(), '.coco');
  const hasDir = fs.existsSync(configDir);

  return {
    installed: hasDir,
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

  const installed = hasBin || hasDir;
  return {
    installed,
    configDir,
    pluginDir: path.join(configDir, 'plugins', 'vibe'),
    authenticated: installed ? detectCodexAuth(configDir) : undefined,
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

  const installed = hasBin || hasDir;
  return {
    installed,
    configDir,
    authenticated: installed ? detectGeminiAuth(configDir) : undefined,
  };
}
