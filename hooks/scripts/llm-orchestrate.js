/**
 * UserPromptSubmit Hook - LLM 오케스트레이션 (GPT/Gemini)
 *
 * Usage:
 *   node llm-orchestrate.js <provider> <mode> "prompt"
 *   node llm-orchestrate.js <provider> <mode> "systemPrompt" "prompt"
 *
 *   provider: gpt | gemini
 *   mode: orchestrate | orchestrate-json | image | analyze-image
 *
 * Image Mode:
 *   node llm-orchestrate.js gemini image "prompt" --output "./image.png"
 *   node llm-orchestrate.js gemini image "prompt" --output "./image.png" --size "1920x1080"
 *
 * Features:
 *   - CLI-based: GPT → codex exec, Gemini → gemini -p
 *   - Exponential backoff retry (3 attempts)
 *   - Auto fallback: gpt ↔ gemini
 *   - Overload/rate-limit detection
 *   - Image generation (Gemini API, Gemini Flash Image model)
 *   - Image analysis (Gemini API multimodal)
 *
 * Analyze-Image Mode:
 *   node llm-orchestrate.js gemini analyze-image "./image.png" "Analyze this UI"
 *   node llm-orchestrate.js gemini analyze-image "./image.png" "prompt" --system "system prompt"
 *
 * Input: JSON from stdin with { prompt: string } (when no CLI args)
 */
import { getLibBaseUrl, readVibeConfig, logLlmCost } from './utils.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync, spawn } from 'child_process';

const LIB_URL = getLibBaseUrl();
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.';

const provider = process.argv[2] || 'gemini';
const mode = process.argv[3] || 'orchestrate';

// WHY 3 retries: Enough to ride out brief 503/overload blips (typically 1-2
// consecutive), but not so many that a genuinely down provider delays the
// fallback chain for minutes.
const MAX_RETRIES = 3;
// WHY 2000ms initial delay: LLM rate-limit windows are typically 1-5s;
// starting at 2s with exponential backoff (2s, 4s, 8s) covers most reset intervals.
const INITIAL_DELAY_MS = 2000;

// ============================================
// Response Cache (TTL-based, in-memory)
// ============================================
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_ENTRIES = 50;
const responseCache = new Map();

function getCacheKey(providerName, prompt, sysPrompt, jsonMode) {
  const hash = crypto.createHash('sha256')
    .update(`${providerName}|${sysPrompt}|${prompt}|${jsonMode}`)
    .digest('hex')
    .slice(0, 16);
  return hash;
}

function getCachedResponse(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedResponse(key, result) {
  // Evict oldest entries when cache is full
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
  responseCache.set(key, { result, timestamp: Date.now() });
}

// ============================================
// Simple Prompt Detection (early exit)
// WHY skip orchestration for simple prompts: Sending greetings/acks to an
// external LLM wastes latency and tokens — Claude handles these natively.
// ============================================
const SIMPLE_PROMPT_MAX_LEN = 20;
const SIMPLE_PROMPT_PATTERNS = [
  /^(hi|hello|hey|thanks|thank you|ok|yes|no|y|n)\.?$/i,
  /^(help|version|status)$/i,
];

function isSimplePrompt(prompt) {
  const trimmed = prompt.trim();
  if (trimmed.length > SIMPLE_PROMPT_MAX_LEN) return false;
  return SIMPLE_PROMPT_PATTERNS.some(p => p.test(trimmed));
}

function resolveModel(providerName, config) {
  if (providerName === 'gpt-spark') return config.models?.gptCodexSpark || 'gpt-5.3-codex-spark';
  if (providerName === 'gpt-codex') return config.models?.gptCodex || 'gpt-5.3-codex';
  if (providerName === 'gpt') return config.models?.gpt || 'gpt-5.4';
  if (providerName === 'gemini') return config.models?.gemini || 'gemini-3.1-pro-preview';
  return providerName;
}

// Errors that should skip retry and go to fallback immediately
const SKIP_RETRY_PATTERNS = [
  /rate.?limit/i,
  /quota/i,
  /unauthorized/i,
  /forbidden/i,
  /authentication/i,
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
  /spawn error/i,
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

// ============================================
// Image Generation (delegates to gemini-api)
// ============================================

function parseImageArgs(args) {
  const result = { prompt: null, output: './generated-image.png', size: '1024x1024', model: 'nano-banana' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      result.output = args[++i];
    } else if (args[i] === '--size' || args[i] === '-s') {
      result.size = args[++i];
    } else if (args[i] === '--pro') {
      result.model = 'nano-banana-pro';
    } else if (!args[i].startsWith('-') && !result.prompt) {
      result.prompt = args[i];
    }
  }
  return result;
}

// ============================================
// Image Analysis (delegates to gemini-api)
// ============================================

function parseAnalyzeImageArgs(args) {
  const result = { imagePath: null, prompt: null, systemPrompt: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--system' || args[i] === '-s') {
      result.systemPrompt = args[++i];
    } else if (!args[i].startsWith('-')) {
      if (!result.imagePath) {
        result.imagePath = args[i];
      } else if (!result.prompt) {
        result.prompt = args[i];
      }
    }
  }
  return result;
}

// ============================================
// CLI Provider Functions
// ============================================

const CLI_TIMEOUT_MS = 180000;
const CLI_FALLBACK_TIMEOUT_MS = 30000;
const IS_WINDOWS = os.platform() === 'win32';

function spawnCli(cmd, args, options) {
  // Windows: .cmd shim은 spawn 직접 실행 불가 → cmd.exe /c 로 실행
  if (IS_WINDOWS) {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/c', cmd, ...args], options);
  }
  return spawn(cmd, args, options);
}

function buildCliPrompt(prompt, sysPrompt, jsonMode) {
  let fullPrompt = sysPrompt && sysPrompt !== DEFAULT_SYSTEM_PROMPT
    ? `[System]\n${sysPrompt}\n\n[User]\n${prompt}`
    : prompt;
  if (jsonMode) {
    fullPrompt += '\n\nIMPORTANT: You must respond with valid JSON only.';
  }
  return fullPrompt;
}


function callCodexCli(prompt, sysPrompt, jsonMode, model, timeoutMs) {
  const fullPrompt = buildCliPrompt(prompt, sysPrompt, jsonMode);
  const outputFile = path.join(os.tmpdir(), `vibe-codex-${crypto.randomUUID()}.txt`);
  // stdin pipe로 프롬프트 전달 (shell escaping 이슈 회피)
  const args = ['exec', '-m', model, '--sandbox', 'read-only', '--ephemeral', '-c', 'model_reasoning_effort="medium"', '-o', outputFile, '-'];

  // config에 저장된 API key를 환경변수로 전달 (임베딩과 동일한 키 사용)
  const vibeConfig = readVibeConfig();
  const apiKey = vibeConfig.credentials?.gpt?.apiKey || process.env.OPENAI_API_KEY;
  const env = apiKey ? { ...process.env, OPENAI_API_KEY: apiKey } : process.env;
  const effectiveTimeout = timeoutMs || CLI_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const proc = spawnCli('codex', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: effectiveTimeout,
      env,
    });
    proc.stdin.end(fullPrompt);

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputFile)) {
        const result = fs.readFileSync(outputFile, 'utf8');
        try { fs.unlinkSync(outputFile); } catch { /* ignore */ }
        resolve(result);
      } else {
        try { fs.unlinkSync(outputFile); } catch { /* ignore */ }
        reject(new Error(`codex exec failed (code ${code}): ${stderr.slice(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      try { fs.unlinkSync(outputFile); } catch { /* ignore */ }
      reject(new Error(`codex exec spawn error: ${err.message}`));
    });
  });
}

function callGeminiCli(prompt, sysPrompt, jsonMode, model, timeoutMs) {
  const fullPrompt = buildCliPrompt(prompt, sysPrompt, jsonMode);
  // -p 로 headless 모드, stdin으로 프롬프트 전달 (stdin is appended to -p value)
  const args = ['-p', '.', '-o', 'text'];
  if (model) args.push('-m', model);
  const effectiveTimeout = timeoutMs || CLI_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const proc = spawnCli('gemini', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: effectiveTimeout,
    });
    proc.stdin.end(fullPrompt);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`gemini cli failed (code ${code}): ${(stderr || stdout).slice(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`gemini cli spawn error: ${err.message}`));
    });
  });
}

async function callProvider(providerName, prompt, sysPrompt, jsonMode, timeoutMs) {
  const vibeConfig = readVibeConfig();

  if (providerName === 'gpt' || providerName === 'gpt-codex' || providerName === 'gpt-spark') {
    let model;
    if (providerName === 'gpt-spark') {
      model = vibeConfig.models?.gptCodexSpark || process.env.GPT_CODEX_SPARK_MODEL || 'gpt-5.3-codex-spark';
    } else if (providerName === 'gpt-codex') {
      model = vibeConfig.models?.gptCodex || process.env.GPT_CODEX_MODEL || 'gpt-5.3-codex';
    } else {
      model = vibeConfig.models?.gpt || process.env.GPT_MODEL || 'gpt-5.4';
    }
    return await callCodexCli(prompt, sysPrompt, jsonMode, model, timeoutMs);
  }

  if (providerName === 'gemini') {
    const model = vibeConfig.models?.gemini || process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview';
    return await callGeminiCli(prompt, sysPrompt, jsonMode, model, timeoutMs);
  }

  throw new Error(`Unknown provider: ${providerName}`);
}

async function callWithRetry(providerName, prompt, sysPrompt, jsonMode, timeoutMs) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return { success: true, result: await callProvider(providerName, prompt, sysPrompt, jsonMode, timeoutMs) };
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
  // Image mode handling
  if (mode === 'image') {
    if (provider !== 'gemini') {
      console.log('[IMAGE] Error: Image generation only supports gemini provider');
      return;
    }

    const imageArgs = parseImageArgs(process.argv.slice(4));
    if (!imageArgs.prompt) {
      console.log('[IMAGE] Error: --prompt is required');
      return;
    }

    // Ensure output directory exists
    const outputDir = path.dirname(imageArgs.output);
    if (outputDir && outputDir !== '.' && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const modelLabel = imageArgs.model === 'nano-banana-pro' ? 'Gemini Pro Image' : 'Gemini Flash Image';
    console.error(`[IMAGE] Generating with ${modelLabel}...`);
    console.error(`  Prompt: ${imageArgs.prompt}`);
    console.error(`  Size: ${imageArgs.size}`);
    console.error(`  Model: ${modelLabel}`);
    console.error(`  Output: ${imageArgs.output}`);

    try {
      const geminiApi = await import(`${LIB_URL}gemini-api.js`);
      const image = await geminiApi.generateImage(imageArgs.prompt, { size: imageArgs.size, model: imageArgs.model });
      fs.writeFileSync(imageArgs.output, image.data);
      const stats = fs.statSync(imageArgs.output);
      const sizeKB = (stats.size / 1024).toFixed(1);

      console.log(JSON.stringify({
        success: true,
        path: path.resolve(imageArgs.output),
        size: stats.size,
        sizeKB: `${sizeKB} KB`,
        prompt: imageArgs.prompt
      }));
    } catch (err) {
      console.log(JSON.stringify({
        success: false,
        error: err.message,
        prompt: imageArgs.prompt
      }));
    }
    return;
  }

  // Analyze-image mode handling
  if (mode === 'analyze-image') {
    if (provider !== 'gemini') {
      console.log('[ANALYZE-IMAGE] Error: Image analysis only supports gemini provider');
      return;
    }

    const analyzeArgs = parseAnalyzeImageArgs(process.argv.slice(4));
    if (!analyzeArgs.imagePath) {
      console.log('[ANALYZE-IMAGE] Error: image path is required');
      return;
    }
    if (!analyzeArgs.prompt) {
      console.log('[ANALYZE-IMAGE] Error: analysis prompt is required');
      return;
    }

    const absolutePath = path.resolve(analyzeArgs.imagePath);
    if (!fs.existsSync(absolutePath)) {
      console.log(JSON.stringify({
        success: false,
        error: `Image file not found: ${absolutePath}`,
        imagePath: analyzeArgs.imagePath,
      }));
      return;
    }

    console.error(`[ANALYZE-IMAGE] Analyzing image with Gemini...`);
    console.error(`  Image: ${absolutePath}`);
    console.error(`  Prompt: ${analyzeArgs.prompt}`);

    try {
      const geminiApi = await import(`${LIB_URL}gemini-api.js`);
      const options = {};
      if (analyzeArgs.systemPrompt) {
        options.systemPrompt = analyzeArgs.systemPrompt;
      }
      const analysis = await geminiApi.analyzeImage(absolutePath, analyzeArgs.prompt, options);

      console.log(JSON.stringify({
        success: true,
        analysis,
        imagePath: absolutePath,
      }));
    } catch (err) {
      console.log(JSON.stringify({
        success: false,
        error: err.message,
        imagePath: absolutePath,
      }));
    }
    return;
  }

  // Text generation mode (orchestrate / orchestrate-json)
  let prompt;
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;

  // --input <file> 플래그를 먼저 확인 (위치 인자보다 우선)
  const inputFlagIdx = process.argv.indexOf('--input');
  if (inputFlagIdx !== -1 && process.argv[inputFlagIdx + 1]) {
    const inputFile = process.argv[inputFlagIdx + 1];

    // Path traversal 방지: 절대경로로 resolve 후 임시 디렉토리 또는 프로젝트 내 확인
    const resolvedInput = path.resolve(inputFile);
    const allowedDirs = [os.tmpdir(), process.cwd()];
    const isAllowed = allowedDirs.some(dir => resolvedInput.startsWith(path.resolve(dir)));
    if (!isAllowed) {
      console.log(`[${provider.toUpperCase()}] Error: Input file must be in temp directory or project directory`);
      return;
    }

    try {
      const inputData = fs.readFileSync(resolvedInput, 'utf8');
      const parsed = JSON.parse(inputData);
      prompt = parsed.prompt;
      if (parsed.systemPrompt) {
        systemPrompt = parsed.systemPrompt;
      }
    } catch (err) {
      console.log(`[${provider.toUpperCase()}] Error: Failed to read input file: ${err.message}`);
      return;
    }
  } else {
    // CLI argument 사용
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
      // Hook에서 호출: stdin으로 JSON 입력 (fallback)
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
  }

  // 접두사 제거
  const prefixPatterns = {
    gpt: /^(gpt[-.\s]|지피티-|vibe-gpt-)\s*/i,
    'gpt-codex': /^(gpt[-.\s]|지피티-|vibe-gpt-)\s*/i,
    gemini: /^(gemini[-.\s]|제미나이-|vibe-gemini-)\s*/i,
  };
  const cleanPrompt = prompt.replace(prefixPatterns[provider] || /^/, '').trim();
  const jsonMode = mode === 'orchestrate-json';

  // Early exit: simple prompts don't need LLM orchestration
  if (isSimplePrompt(cleanPrompt)) {
    return;
  }

  // Check cache for identical prompts
  const cacheKey = getCacheKey(provider, cleanPrompt, systemPrompt, jsonMode);
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    logLlmCost(provider, 'cache', cleanPrompt.length, cached.length, 0, true);
    console.log(cached);
    return;
  }

  // Provider chain: primary → cross fallback
  // WHY GPT → Gemini (not reverse): GPT is the primary code/reasoning model;
  // Gemini serves as cross-vendor fallback so a single vendor outage never
  // blocks the user. When Gemini is primary (e.g. web-search), GPT is fallback.
  const providerLabels = { gpt: 'GPT', 'gpt-codex': 'GPT Codex', gemini: 'Gemini' };
  const isGpt = provider === 'gpt' || provider === 'gpt-codex';
  const providerChain = isGpt
    ? [provider, 'gemini']
    : ['gemini', 'gpt'];

  const vibeConfig = readVibeConfig();

  for (let i = 0; i < providerChain.length; i++) {
    const currentProvider = providerChain[i];
    const label = providerLabels[currentProvider] || currentProvider.toUpperCase();
    // Use shorter timeout for fallback providers
    const timeoutMs = i === 0 ? CLI_TIMEOUT_MS : CLI_FALLBACK_TIMEOUT_MS;
    const startTime = Date.now();
    const result = await callWithRetry(currentProvider, cleanPrompt, systemPrompt, jsonMode, timeoutMs);

    if (result.success) {
      const output = `${label} response: ${result.result}`;
      setCachedResponse(cacheKey, output);

      // 비용 추적
      const model = resolveModel(currentProvider, vibeConfig);
      logLlmCost(currentProvider, model, cleanPrompt.length, result.result.length, Date.now() - startTime, false);

      console.log(output);
      return;
    }

    // Log failure and try fallback
    if (i < providerChain.length - 1) {
      const nextProvider = providerChain[i + 1];
      const nextLabel = providerLabels[nextProvider] || nextProvider.toUpperCase();
      console.error(`[${currentProvider.toUpperCase()}] Failed: ${result.error}. Falling back to ${nextLabel}...`);
    } else {
      // All providers failed
      console.log(`[LLM] Error: All providers failed. Last error: ${result.error}`);
    }
  }
}

main();
