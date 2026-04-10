/**
 * vibe codex 서브커맨드 핸들러
 * Codex Proxy — Claude Code에서 OpenAI 모델을 백엔드로 사용
 */

import {
  startProxy,
  stopProxy,
  getProxyStatus,
  generateShellFunction,
  resolveApiConfig,
} from '../../infra/lib/codex-proxy.js';

const DEFAULT_PORT = 8317;
const DEFAULT_MODEL = 'gpt-4o';

export function codexStart(portArg: string | undefined, daemon: boolean): void {
  const port = portArg ? parseInt(portArg, 10) : DEFAULT_PORT;
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${portArg}`);
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
    console.log(`\n  Codex Proxy: running`);
    console.log(`  PID: ${status.pid}`);
    console.log(`  Port: ${status.port}`);
    const apiConfig = resolveApiConfig();
    console.log(`  API Key: ${apiConfig ? 'configured' : 'not set'}\n`);
  } else {
    console.log('\n  Codex Proxy: stopped\n');
  }
}

export function codexShell(portArg: string | undefined, modelArg: string | undefined): void {
  const port = portArg ? parseInt(portArg, 10) : DEFAULT_PORT;
  const model = modelArg || DEFAULT_MODEL;
  console.log(generateShellFunction(port, model));
}

export function codexHelp(): void {
  console.log(`
Codex Proxy — Anthropic Messages API -> OpenAI Chat Completions API

Claude Code에서 OpenAI 호환 모델을 백엔드로 사용하는 로컬 프록시

Commands:
  vibe codex start [--port PORT] [--daemon]     프록시 시작
  vibe codex stop                                프록시 중지 (daemon)
  vibe codex status                              상태 확인
  vibe codex shell [--port PORT] [--model MODEL] 셸 함수 출력
  vibe codex help                                도움말

Quick Start:
  1. OpenAI API 키 설정:  vibe gpt key <OPENAI_API_KEY>
  2. 프록시 시작:         vibe codex start --daemon
  3. 셸 함수 추가:       vibe codex shell >> ~/.zshrc && source ~/.zshrc
  4. Claude Code 실행:   codex-cc

Environment Variables:
  OPENAI_API_KEY          OpenAI API key
  CODEX_PROXY_API_KEY     프록시 전용 API key (OPENAI_API_KEY 보다 우선)
  CODEX_PROXY_TARGET_URL  대상 URL (default: https://api.openai.com)
  CODEX_PROXY_MODEL       모든 요청에 적용할 모델 override
  `);
}
