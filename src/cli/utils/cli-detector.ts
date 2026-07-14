/**
 * AI CLI 감지 유틸리티
 *
 * Claude Code, Codex CLI, Antigravity CLI 설치 여부를 자동 감지하여
 * 설치된 CLI에만 설정을 적용
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { findExecutableInPath } from '../../infra/lib/utils.js';

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
 * Antigravity CLI 인증 감지.
 *
 * Antigravity는 OS keyring을 우선 사용하므로 파일만으로 완전 검증할 수 없다.
 * 여기서는 API key와 Antigravity 설정 존재 여부를 빠르게 감지한다.
 */
function detectAntigravityAuth(configDir: string): boolean {
  if (process.env.ANTIGRAVITY_API_KEY) return true;
  return fs.existsSync(path.join(configDir, 'settings.json'));
}

/**
 * Claude Code 설치 여부 감지
 * - PATH에서 `claude` 실행 파일 존재 여부
 * - `~/.claude/` 디렉토리 존재 여부
 * 둘 중 하나만 true면 installed: true
 */
export function detectClaudeCli(): AiCliStatus {
  const configDir = path.join(os.homedir(), '.claude');
  const hasDir = fs.existsSync(configDir);
  const hasBin = findExecutableInPath('claude');

  const installed = hasBin || hasDir;
  return {
    installed,
    configDir,
    authenticated: installed ? detectClaudeAuth(configDir) : undefined,
  };
}

/**
 * Codex CLI 설치 여부 감지
 * - PATH에서 `codex` 실행 파일 존재 여부
 * - `~/.codex/` 디렉토리 존재 여부
 * 둘 중 하나만 true면 installed: true
 */
export function detectCodexCli(): AiCliStatus {
  const configDir = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const hasDir = fs.existsSync(configDir);
  const hasBin = findExecutableInPath('codex');

  const installed = hasBin || hasDir;
  return {
    installed,
    configDir,
    pluginDir: path.join(configDir, 'plugins', 'vibe'),
    authenticated: installed ? detectCodexAuth(configDir) : undefined,
  };
}

/**
 * Antigravity CLI 설치 여부 감지
 * - PATH에서 `agy` 실행 파일 존재 여부
 * - `~/.gemini/antigravity-cli/` 또는 `~/.antigravity/` 디렉토리 존재 여부
 * 둘 중 하나만 true면 installed: true
 */
export function detectAntigravityCli(): AiCliStatus {
  const configDir = path.join(os.homedir(), '.gemini', 'antigravity-cli');
  const legacyDir = path.join(os.homedir(), '.antigravity');
  const hasDir = fs.existsSync(configDir) || fs.existsSync(legacyDir);
  const hasBin = findExecutableInPath('agy');

  const installed = hasBin || hasDir;
  return {
    installed,
    configDir,
    authenticated: installed ? detectAntigravityAuth(configDir) : undefined,
  };
}
