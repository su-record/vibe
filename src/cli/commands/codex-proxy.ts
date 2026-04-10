/**
 * vibe codex 서브커맨드 핸들러
 * Claude Code + OpenAI/Gemini 호환 모델을 LLM으로 사용
 */

import fs from 'fs';
import os from 'os';
import * as p from '@clack/prompts';
import {
  launchSession,
  generateShellFunction,
  checkAuthSource,
  getProxySettings,
} from '../../infra/lib/codex-proxy.js';
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

// ─── Setup 위자드 ────────────────────────────────────────────

export async function codexSetup(): Promise<void> {
  p.intro('Codex Proxy 설정');

  const provider = await selectProvider();
  const apiKey = await configureAuth(provider);
  const model = await selectModel(provider, apiKey);
  const alias = await selectAlias();

  saveConfig(provider, apiKey, model, alias);
  await registerShell(alias);

  p.outro(`설정 완료! ${alias} 로 실행하세요`);
}

async function selectProvider(): Promise<string> {
  const result = await p.select({
    message: 'Provider 선택',
    options: [
      { value: 'chatgpt-pro', label: 'ChatGPT Pro (codex login)', hint: 'ChatGPT Pro 구독' },
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
      p.log.info('codex login 으로 ChatGPT Pro 인증 필요 (이미 완료했다면 스킵)');
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

async function selectModel(
  provider: string,
  auth: { key?: string; url?: string },
): Promise<string> {
  const baseUrl = auth.url || 'https://api.openai.com';
  let token = auth.key;

  // ChatGPT Pro: Codex CLI OAuth 토큰으로 시도
  if (!token && provider === 'chatgpt-pro') {
    try {
      const { getAuthInfo } = await import('../../infra/lib/gpt/auth.js');
      const info = await getAuthInfo();
      token = info.accessToken || info.apiKey;
    } catch { /* codex login 아직 안 한 경우 */ }
  }

  // API에서 모델 목록 조회
  const models = token ? await fetchModels(baseUrl, token) : [];

  if (models.length > 0) {
    const options = models.map(m => ({ value: m, label: m }));
    options.push({ value: '_custom', label: '직접 입력' });
    const result = await p.select({ message: '기본 모델', options });
    if (p.isCancel(result)) { p.cancel('취소'); process.exit(0); }
    if (result !== '_custom') return result as string;
  }

  return textOrCancel('모델 이름');
}

// ─── 모델 목록 조회 ──────────────────────────────────────────

const EXCLUDE_PATTERNS = ['embedding', 'tts', 'whisper', 'dall-e', 'moderation', 'davinci', 'babbage'];

async function fetchModels(baseUrl: string, token: string): Promise<string[]> {
  const spin = p.spinner();
  spin.start('사용 가능한 모델 조회 중...');
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { spin.stop('모델 조회 실패, 직접 입력'); return []; }
    const data = await res.json() as { data?: Array<{ id: string }> };
    const all = (data.data || []).map(m => m.id);
    const filtered = all
      .filter(m => !EXCLUDE_PATTERNS.some(e => m.includes(e)))
      .filter(m => !m.includes(':'))
      .sort();
    spin.stop(`${filtered.length}개 모델 발견`);
    return filtered;
  } catch {
    spin.stop('모델 조회 실패, 직접 입력');
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
  p.log.success(`${profile}에 등록 완료. source ${profile} 실행 필요`);
}

function detectShellProfile(): string | null {
  const home = os.homedir();
  const zshrc = `${home}/.zshrc`;
  const bashrc = `${home}/.bashrc`;
  if (fs.existsSync(zshrc)) return zshrc;
  if (fs.existsSync(bashrc)) return bashrc;
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
