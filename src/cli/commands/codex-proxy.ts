/**
 * vibe codex 서브커맨드 핸들러
 * Claude Code + OpenAI/Gemini 호환 모델을 LLM으로 사용
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import * as p from '@clack/prompts';
import {
  launchSession,
  generateShellFunction,
  checkAuthSource,
  getProxySettings,
} from '../../infra/lib/codex-proxy.js';
import { findCodexCredentials } from '../../infra/lib/gpt/auth.js';
import { patchGlobalConfig } from '../../infra/lib/config/GlobalConfigManager.js';
import type { GlobalVibeConfig } from '../types.js';

const AUTH_LABELS: Record<string, string> = {
  'codex-cli': 'Codex CLI (ChatGPT Pro)',
  'apikey': 'API Key',
  'env': 'CODEX_PROXY_API_KEY',
};

// ─── 실행 ────────────────────────────────────────────────────

export function codexLaunch(model: string | undefined, claudeArgs: string[]): void {
  launchSession(model, claudeArgs);
}

// ─── 셸 함수 출력 ───────────────────────────────────────────

export function codexShell(modelArg: string | undefined): void {
  const settings = getProxySettings();
  const model = modelArg || settings.model;
  console.log(generateShellFunction(model));
}

// ─── 상태 확인 ───────────────────────────────────────────────

export function codexStatus(): void {
  const auth = checkAuthSource();
  const settings = getProxySettings();
  console.log(`\n  Provider: ${settings.provider || '미설정'}`);
  console.log(`  모델:     ${settings.model || '(기본값)'}`);
  console.log(`  인증:     ${auth ? AUTH_LABELS[auth.source] || auth.source : '미설정'}`);
  console.log(`  Target:   ${settings.targetUrl || 'https://api.openai.com'}`);
  console.log(`  명령어:   ${settings.alias || 'vibe codex'}\n`);
}

// ─── Setup ──────────────────────────────────────────────────

export async function codexSetup(): Promise<void> {
  p.intro('Codex Proxy 설정');

  // 1. 인증 자동 감지
  const detected = detectAuth();

  if (detected) {
    p.log.success(`${detected.label} 인증 확인됨`);
    // 2. 모델 자동 조회
    const models = detected.provider === 'chatgpt-pro'
      ? readCodexModelsCache()
      : detected.key ? await fetchModels(detected.url || 'https://api.openai.com', detected.key) : [];

    const model = await selectModel(models);
    const alias = await selectAlias();

    saveConfig(detected.provider, { key: detected.key, url: detected.url }, model, alias);
    await registerShell(alias);
    p.outro(`설정 완료! ${alias} 로 실행하세요`);
  } else {
    // 감지 실패 → 수동 설정
    p.log.warn('인증 정보를 찾을 수 없습니다');
    const provider = await selectProvider();
    const auth = await configureAuth(provider);
    const models = auth.key
      ? await fetchModels(auth.url || 'https://api.openai.com', auth.key)
      : [];
    const model = await selectModel(models);
    const alias = await selectAlias();

    saveConfig(provider, auth, model, alias);
    await registerShell(alias);
    p.outro(`설정 완료! ${alias} 로 실행하세요`);
  }
}

// ─── 인증 자동 감지 ─────────────────────────────────────────

interface DetectedAuth {
  provider: string;
  label: string;
  key?: string;
  url?: string;
}

function detectAuth(): DetectedAuth | null {
  // 1. Codex CLI (ChatGPT Pro)
  const codexCreds = findCodexCredentials();
  if (codexCreds) {
    return { provider: 'chatgpt-pro', label: 'Codex CLI (ChatGPT Pro)' };
  }
  // 2. 환경변수
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', label: 'OpenAI (OPENAI_API_KEY)', key: process.env.OPENAI_API_KEY };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: 'gemini', label: 'Gemini (GEMINI_API_KEY)',
      key: process.env.GEMINI_API_KEY,
      url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    };
  }
  return null;
}

// ─── 수동 설정 (감지 실패 시) ───────────────────────────────

async function selectProvider(): Promise<string> {
  const result = await p.select({
    message: 'Provider 선택',
    options: [
      { value: 'chatgpt-pro', label: 'ChatGPT Pro', hint: 'codex login 필요' },
      { value: 'openai', label: 'OpenAI API Key' },
      { value: 'gemini', label: 'Gemini API Key' },
      { value: 'custom', label: '커스텀 (OpenAI 호환)', hint: 'Groq, Together, Ollama 등' },
    ],
  });
  if (p.isCancel(result)) { p.cancel('취소'); process.exit(0); }
  return result as string;
}

async function configureAuth(provider: string): Promise<{ key?: string; url?: string }> {
  switch (provider) {
    case 'chatgpt-pro':
      p.log.warn('codex login 으로 ChatGPT Pro 인증 후 다시 실행하세요');
      return {};
    case 'openai': {
      const key = await textOrCancel('OpenAI API Key', 'sk-...');
      return { key };
    }
    case 'gemini': {
      const key = await textOrCancel('Gemini API Key');
      return { key, url: 'https://generativelanguage.googleapis.com/v1beta/openai' };
    }
    case 'custom': {
      const url = await textOrCancel('API Base URL', 'https://api.example.com');
      const key = await textOrCancel('API Key');
      return { key, url };
    }
    default:
      return {};
  }
}

// ─── 모델 선택 ──────────────────────────────────────────────

async function selectModel(models: string[]): Promise<string> {
  if (models.length > 0) {
    const options = models.map(m => ({ value: m, label: m }));
    options.push({ value: '_custom', label: '직접 입력' });
    const result = await p.select({ message: '기본 모델', options });
    if (p.isCancel(result)) { p.cancel('취소'); process.exit(0); }
    if (result !== '_custom') return result as string;
  }
  return textOrCancel('모델 이름');
}

// ─── Codex CLI 모델 캐시 ────────────────────────────────────

interface CodexModelsCache {
  models?: Array<{ slug: string; display_name?: string }>;
}

function readCodexModelsCache(): string[] {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const cachePath = path.join(codexHome, 'models_cache.json');
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CodexModelsCache;
    return (data.models || []).map(m => m.slug).filter(Boolean);
  } catch {
    return [];
  }
}

// ─── API 모델 목록 조회 ─────────────────────────────────────

const EXCLUDE_PATTERNS = ['embedding', 'tts', 'whisper', 'dall-e', 'moderation', 'davinci', 'babbage'];

async function fetchModels(baseUrl: string, token: string): Promise<string[]> {
  const spin = p.spinner();
  spin.start('사용 가능한 모델 조회 중...');
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { spin.stop('모델 조회 실패'); return []; }
    const data = await res.json() as { data?: Array<{ id: string }> };
    const all = (data.data || []).map(m => m.id);
    const filtered = all
      .filter(m => !EXCLUDE_PATTERNS.some(e => m.includes(e)))
      .filter(m => !m.includes(':'))
      .sort();
    spin.stop(`${filtered.length}개 모델 발견`);
    return filtered;
  } catch {
    spin.stop('모델 조회 실패');
    return [];
  }
}

async function selectAlias(): Promise<string> {
  const result = await p.text({ message: '실행 명령어', initialValue: 'cc' });
  if (p.isCancel(result)) { p.cancel('취소'); process.exit(0); }
  return result;
}

// ─── Config 저장 ─────────────────────────────────────────────

function saveConfig(
  provider: string,
  auth: { key?: string; url?: string },
  model: string,
  alias: string,
): void {
  const patch: Partial<GlobalVibeConfig> = {
    codexProxy: {
      provider, model, alias,
      ...(auth.url ? { targetUrl: auth.url } : {}),
      ...(auth.key && provider === 'custom' ? { apiKey: auth.key } : {}),
    },
  };
  if (auth.key && provider === 'openai') {
    patch.credentials = { gpt: { apiKey: auth.key, createdAt: new Date().toISOString() } };
  }
  if (auth.key && provider === 'gemini') {
    patch.credentials = { gemini: { apiKey: auth.key, createdAt: new Date().toISOString() } };
  }
  patchGlobalConfig(patch);
  p.log.success('설정 저장 완료');
}

// ─── 셸 등록 ─────────────────────────────────────────────────

async function registerShell(alias: string): Promise<void> {
  const profile = detectShellProfile();
  if (!profile) { p.log.warn('셸 프로파일 미탐지. 수동 등록 필요'); return; }

  const ok = await p.confirm({ message: `${profile}에 ${alias}() 등록?` });
  if (p.isCancel(ok) || !ok) return;

  const content = fs.readFileSync(profile, 'utf-8');
  const funcLine = `${alias}() { vibe codex "$@"; }`;
  if (content.includes(`${alias}()`)) {
    p.log.info('이미 등록됨');
    return;
  }
  fs.appendFileSync(profile, `\n# Codex Proxy (vibe)\n${funcLine}\n`);
  p.log.success(`${profile}에 등록 완료`);
  p.log.info('새 터미널에서 사용 가능. 현재 터미널: source ' + profile);
}

function detectShellProfile(): string | null {
  const home = os.homedir();
  const shell = process.env.SHELL ?? '';
  const zshrc = `${home}/.zshrc`;
  const bashrc = `${home}/.bashrc`;
  // 실제 사용 중인 셸 기준으로 우선 판단
  if (shell.endsWith('/zsh') && fs.existsSync(zshrc)) return zshrc;
  if (shell.endsWith('/bash') && fs.existsSync(bashrc)) return bashrc;
  // fallback: 파일 존재 여부 (SHELL 미설정 시)
  if (fs.existsSync(bashrc)) return bashrc;
  if (fs.existsSync(zshrc)) return zshrc;
  return null;
}

// ─── 유틸 ────────────────────────────────────────────────────

async function textOrCancel(message: string, placeholder?: string): Promise<string> {
  const result = await p.text({ message, placeholder });
  if (p.isCancel(result)) { p.cancel('취소'); process.exit(0); }
  return result;
}

// ─── 도움말 ──────────────────────────────────────────────────

export function codexHelp(): void {
  console.log(`
Codex Proxy — Claude Code + OpenAI/Gemini 호환 모델

사용법:
  vibe codex --setup          설정 위자드 (인증, 모델, 셸 등록)
  vibe codex                  실행 (설정된 모델)
  vibe codex /gpt-5-codex     모델 지정 실행
  vibe codex --model MODEL    모델 지정 실행
  vibe codex status           설정 확인
  vibe codex shell            셸 함수 출력
  vibe codex help             도움말

설정 후:
  cc                          실행 (설정된 모델)
  cc /gemini-2.5-flash        모델 바꿔서 실행
  `);
}
