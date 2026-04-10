/**
 * vibe codex 서브커맨드 핸들러
 * Claude Code + OpenAI/Gemini 호환 모델을 LLM으로 사용
 */

import {
  launchSession,
  generateShellFunction,
  checkAuthSource,
} from '../../infra/lib/codex-proxy.js';

const AUTH_LABELS: Record<string, string> = {
  'codex-cli': 'Codex CLI (ChatGPT Pro)',
  'apikey': 'OpenAI API Key',
  'env': 'CODEX_PROXY_API_KEY',
};

export function codexLaunch(model: string | undefined, claudeArgs: string[]): void {
  launchSession(model, claudeArgs);
}

export function codexShell(modelArg: string | undefined): void {
  const model = modelArg || 'gpt-4o';
  console.log(generateShellFunction(model));
}

export function codexStatus(): void {
  const auth = checkAuthSource();
  if (auth) {
    const label = AUTH_LABELS[auth.source] || auth.source;
    console.log(`\n  인증: ${label}`);
    console.log(`  Target: ${process.env.CODEX_PROXY_TARGET_URL || 'https://api.openai.com'}\n`);
  } else {
    console.log('\n  인증 미설정. codex login 또는 API key 필요\n');
  }
}

export function codexHelp(): void {
  console.log(`
Codex Proxy — Claude Code + OpenAI/Gemini 호환 모델

Claude Code를 에이전트로, OpenAI/Gemini 등 모델을 LLM으로 사용.
Anthropic Messages API → OpenAI Chat Completions API 자동 변환.

사용법:
  vibe codex                        Claude Code 실행 (프록시 내장)
  vibe codex --model gpt-5-codex    모델 지정
  vibe codex status                 인증 상태 확인
  vibe codex shell [--model MODEL]  셸 함수 출력
  vibe codex help                   도움말

ChatGPT Pro (Codex CLI):
  1. npm i -g @openai/codex && codex login
  2. vibe codex

OpenAI API Key:
  1. vibe gpt key <OPENAI_API_KEY>   (또는 export OPENAI_API_KEY=...)
  2. vibe codex

Gemini:
  1. export CODEX_PROXY_API_KEY=<GEMINI_API_KEY>
  2. export CODEX_PROXY_TARGET_URL=https://generativelanguage.googleapis.com/v1beta/openai
  3. vibe codex --model gemini-2.5-flash

기타 OpenAI 호환 API (Groq, Together, Ollama 등):
  1. export CODEX_PROXY_API_KEY=<API_KEY>
  2. export CODEX_PROXY_TARGET_URL=<BASE_URL>
  3. vibe codex --model <MODEL>

인증 우선순위:
  CODEX_PROXY_API_KEY  >  codex-cli (ChatGPT Pro)  >  OPENAI_API_KEY / vibe config

환경변수:
  CODEX_PROXY_API_KEY     프록시 전용 API key (최우선)
  CODEX_PROXY_TARGET_URL  대상 URL (기본: https://api.openai.com)
  CODEX_PROXY_MODEL       기본 모델 (기본: gpt-4o)
  `);
}
