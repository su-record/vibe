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

export interface CocoStatus extends AiCliStatus {
  /** Human label of the active vendor (openai-oauth / openai-apikey / gemini / anthropic-apikey / local). Undefined when not installed or no auth. */
  activeVendor?: string;
  /** Available auth methods — short labels like "OAuth", "OpenAI key", "Anthropic key", "Gemini key", "Local". */
  methods?: string[];
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
 * coco 설치 및 인증 감지
 * - 설치: `which coco` · `~/.bun/bin/coco` · `~/.coco/` · `COCO_HOME` 중 하나라도 있으면 installed
 * - 인증: `~/.config/coco/{auth.json,api-keys.json,active-vendor.json}` + env vars
 *   (api-keys.json은 encrypted envelope이라 내용은 못 읽고 "has any" 까지만 판단)
 * - 활성 vendor: COCO_VENDOR env > active-vendor.json > OAuth 우선순위
 */
const COCO_VENDOR_LABELS: Record<string, string> = {
  'openai-oauth': 'OpenAI (ChatGPT)',
  'openai-apikey': 'OpenAI (API key)',
  'gemini': 'Google Gemini',
  'anthropic-apikey': 'Anthropic Claude',
  'local': 'Local (Ollama)',
};

export function detectCocoCli(): CocoStatus {
  const configDir = process.env.COCO_HOME || path.join(os.homedir(), '.coco');
  const hasConfigDir = fs.existsSync(configDir);

  let hasBin = false;
  try {
    execSync('which coco', { stdio: 'ignore' });
    hasBin = true;
  } catch {
    // which failed — try known install locations directly.
    const candidates = [
      path.join(configDir, 'bin', 'coco'),     // native install (coco install)
      path.join(os.homedir(), '.bun', 'bin', 'coco'), // bun link (dev)
    ];
    if (candidates.some((p) => fs.existsSync(p))) hasBin = true;
  }

  const installed = hasBin || hasConfigDir;
  if (!installed) {
    return { installed: false, configDir };
  }

  // Auth detection — XDG path, same as coco's auth-storage.ts
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const cocoConfigDir = path.join(xdg, 'coco');
  const authFile = path.join(cocoConfigDir, 'auth.json');
  const apiKeysFile = path.join(cocoConfigDir, 'api-keys.json');
  const activeVendorFile = path.join(cocoConfigDir, 'active-vendor.json');

  const hasOAuth = fs.existsSync(authFile);
  const hasApiKeysFile = fs.existsSync(apiKeysFile);
  const envOpenai = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
  const envGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  const envAnthropic = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());

  const methods: string[] = [];
  if (hasOAuth) methods.push('OAuth');
  // api-keys.json is encrypted — we can't enumerate slots. If env vars for specific keys
  // are set, show those explicitly; also note "disk" if the file exists with no env fallback.
  if (envOpenai) methods.push('OpenAI key');
  if (envAnthropic) methods.push('Anthropic key');
  if (envGemini) methods.push('Gemini key');
  if (hasApiKeysFile) methods.push('API keys (disk)');
  methods.push('Local'); // Ollama fallback always available

  const authenticated = hasOAuth || hasApiKeysFile || envOpenai || envGemini || envAnthropic;

  // Active vendor resolution
  let activeVendorKey: string | null = null;
  const envVendor = process.env.COCO_VENDOR;
  if (envVendor && COCO_VENDOR_LABELS[envVendor]) {
    activeVendorKey = envVendor;
  } else if (fs.existsSync(activeVendorFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(activeVendorFile, 'utf-8')) as { vendor?: string };
      if (raw.vendor && COCO_VENDOR_LABELS[raw.vendor]) activeVendorKey = raw.vendor;
    } catch { /* ignore */ }
  }
  if (!activeVendorKey) {
    if (hasOAuth) activeVendorKey = 'openai-oauth';
    else if (envOpenai || hasApiKeysFile) activeVendorKey = 'openai-apikey';
    else if (envGemini) activeVendorKey = 'gemini';
    else if (envAnthropic) activeVendorKey = 'anthropic-apikey';
    else activeVendorKey = 'local';
  }

  return {
    installed: true,
    configDir,
    authenticated,
    activeVendor: COCO_VENDOR_LABELS[activeVendorKey],
    methods,
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
