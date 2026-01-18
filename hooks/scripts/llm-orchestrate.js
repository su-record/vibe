/**
 * UserPromptSubmit Hook - LLM 오케스트레이션 (GPT/Gemini)
 *
 * Usage:
 *   node llm-orchestrate.js <provider> <mode> "prompt"
 *   node llm-orchestrate.js <provider> <mode> "systemPrompt" "prompt"
 *
 *   provider: gpt | gemini
 *   mode: orchestrate | orchestrate-json
 *
 * Features:
 *   - Exponential backoff retry (3 attempts)
 *   - Auto fallback: gemini → gpt, gpt → gemini
 *   - Overload/rate-limit detection
 *
 * Input: JSON from stdin with { prompt: string } (when no CLI args)
 */
import { getLibBaseUrl } from './utils.js';

const LIB_URL = getLibBaseUrl();
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.';

const provider = process.argv[2] || 'gemini';
const mode = process.argv[3] || 'orchestrate';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;

// Errors that should skip retry and go to fallback immediately
const SKIP_RETRY_PATTERNS = [
  /rate.?limit/i,
  /quota/i,
  /unauthorized/i,
  /forbidden/i,
  /401/,
  /403/,
  /429/,
];

// Errors that should trigger retry with backoff
const RETRY_PATTERNS = [
  /overload/i,
  /503/,
  /5\d\d/,
  /network/i,
  /timeout/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
];

function shouldSkipRetry(errorMsg) {
  return SKIP_RETRY_PATTERNS.some(pattern => pattern.test(errorMsg));
}

function shouldRetry(errorMsg) {
  return RETRY_PATTERNS.some(pattern => pattern.test(errorMsg));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callProvider(providerName, prompt, sysPrompt, jsonMode) {
  const modulePath = `${LIB_URL}${providerName}-api.js`;
  const module = await import(modulePath);

  const orchestrateFn = providerName === 'gpt'
    ? module.vibeGptOrchestrate
    : module.vibeGeminiOrchestrate;

  return await orchestrateFn(prompt, sysPrompt, { jsonMode });
}

async function callWithRetry(providerName, prompt, sysPrompt, jsonMode) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return { success: true, result: await callProvider(providerName, prompt, sysPrompt, jsonMode) };
    } catch (e) {
      lastError = e;
      const errorMsg = e.message || String(e);

      // Skip retry for auth/quota errors - go to fallback immediately
      if (shouldSkipRetry(errorMsg)) {
        return { success: false, error: errorMsg, skipToFallback: true };
      }

      // Retry with backoff for transient errors
      if (shouldRetry(errorMsg) && attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.error(`[${providerName.toUpperCase()}] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      // Unknown error or max retries reached
      return { success: false, error: errorMsg, skipToFallback: false };
    }
  }

  return { success: false, error: lastError?.message || 'Max retries exceeded', skipToFallback: false };
}

async function main() {
  let prompt;
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;

  // CLI argument가 있으면 사용
  // Usage 1: node script.js gpt orchestrate "system prompt" "user prompt"
  // Usage 2: node script.js gpt orchestrate "user prompt" (uses default system prompt)
  const arg4 = process.argv[4]?.trim();
  const arg5 = process.argv.slice(5).join(' ').trim();

  if (arg5) {
    // 5번째 인자가 있으면: arg4=시스템 프롬프트, arg5=사용자 프롬프트
    systemPrompt = arg4;
    prompt = arg5;
  } else if (arg4) {
    // 4번째 인자만 있으면: arg4=사용자 프롬프트 (시스템 프롬프트는 기본값)
    prompt = arg4;
  } else {
    // Hook에서 호출: stdin으로 JSON 입력
    let inputData = '';
    for await (const chunk of process.stdin) {
      inputData += chunk;
    }

    try {
      const parsed = JSON.parse(inputData);
      prompt = parsed.prompt;
    } catch {
      console.log(`[${provider.toUpperCase()}] Error: Invalid JSON input`);
      return;
    }
  }

  // 접두사 제거
  const prefixPatterns = {
    gpt: /^(gpt[-.\s]|지피티-|vibe-gpt-)\s*/i,
    gemini: /^(gemini[-.\s]|제미나이-|vibe-gemini-)\s*/i,
  };
  const cleanPrompt = prompt.replace(prefixPatterns[provider] || /^/, '').trim();
  const jsonMode = mode === 'orchestrate-json';

  // Provider chain: primary → fallback
  const fallbackProvider = provider === 'gpt' ? 'gemini' : 'gpt';
  const providerChain = [provider, fallbackProvider];

  for (const currentProvider of providerChain) {
    const label = currentProvider === 'gpt' ? 'GPT-5.2' : 'Gemini-3';
    const result = await callWithRetry(currentProvider, cleanPrompt, systemPrompt, jsonMode);

    if (result.success) {
      console.log(`${label} 응답: ${result.result}`);
      return;
    }

    // Log failure and try fallback
    if (currentProvider !== providerChain[providerChain.length - 1]) {
      const fallbackLabel = fallbackProvider === 'gpt' ? 'GPT' : 'Gemini';
      console.error(`[${currentProvider.toUpperCase()}] Failed: ${result.error}. Falling back to ${fallbackLabel}...`);
    } else {
      // All providers failed
      console.log(`[LLM] Error: All providers failed. Last error: ${result.error}`);
    }
  }
}

main();
