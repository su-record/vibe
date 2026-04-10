/**
 * vibe codex 서브커맨드 핸들러
 * Codex Proxy — Claude Code에서 Codex(ChatGPT Pro) 모델을 LLM으로 사용
 */

import {
  startProxy,
  stopProxy,
  getProxyStatus,
  generateShellFunction,
  checkAuthSource,
} from '../../infra/lib/codex-proxy.js';

const DEFAULT_PORT = 8317;
const DEFAULT_MODEL = 'gpt-4o';

const AUTH_LABELS: Record<string, string> = {
  'codex-cli': 'Codex CLI (ChatGPT Pro)',
  'apikey': 'OpenAI API Key',
  'env': 'CODEX_PROXY_API_KEY',
};

export function codexStart(portArg: string | undefined, daemon: boolean): void {
  const port = portArg ? parseInt(portArg, 10) : DEFAULT_PORT;
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`잘못된 포트: ${portArg}`);
    process.exit(1);
  }
  startProxy(port, daemon);
}

export function codexStop(): void {
  stopProxy();
}

export function codexStatus(): void {
  const status = getProxyStatus();
  if (status.running) {
    console.log(`\n  Codex Proxy: 실행 중`);
    console.log(`  PID: ${status.pid}`);
    console.log(`  Port: ${status.port}`);
    const auth = checkAuthSource();
    const label = auth ? AUTH_LABELS[auth.source] || auth.source : '미설정';
    console.log(`  인증: ${label}\n`);
  } else {
    console.log('\n  Codex Proxy: 중지됨\n');
  }
}

export function codexShell(portArg: string | undefined, modelArg: string | undefined): void {
  const port = portArg ? parseInt(portArg, 10) : DEFAULT_PORT;
  const model = modelArg || DEFAULT_MODEL;
  console.log(generateShellFunction(port, model));
}

export function codexHelp(): void {
  console.log(`
Codex Proxy — Claude Code + OpenAI 모델

Claude Code를 UI/에이전트로, Codex(ChatGPT Pro)를 LLM으로 사용하는 로컬 프록시.
Anthropic Messages API → OpenAI Chat Completions API 실시간 변환.

커맨드:
  vibe codex start [--port PORT] [--daemon]     프록시 시작
  vibe codex stop                                프록시 중지 (daemon)
  vibe codex status                              상태 확인
  vibe codex shell [--port PORT] [--model MODEL] 셸 함수 출력
  vibe codex help                                도움말

ChatGPT Pro로 시작 (추천):
  1. Codex CLI 설치:      npm i -g @openai/codex
  2. ChatGPT Pro 로그인:  codex login
  3. 프록시 시작:         vibe codex start --daemon
  4. 셸 함수 추가:       vibe codex shell >> ~/.zshrc && source ~/.zshrc
  5. Claude Code 실행:   codex-cc

API Key로 시작:
  1. API 키 설정:        vibe gpt key <OPENAI_API_KEY>
  2. 이하 동일 (3~5)

인증 우선순위:
  CODEX_PROXY_API_KEY  >  codex-cli (ChatGPT Pro)  >  OPENAI_API_KEY / vibe config

환경변수:
  CODEX_PROXY_API_KEY     프록시 전용 API key (최우선)
  CODEX_PROXY_TARGET_URL  대상 URL (기본: https://api.openai.com)
  CODEX_PROXY_MODEL       모든 요청에 적용할 모델 override
  `);
}
