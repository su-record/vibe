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
 *   - Exponential backoff retry (3 attempts)
 *   - Auto fallback: gpt ↔ gemini
 *   - Overload/rate-limit detection
 *   - Image generation (Gemini only, Nano Banana model)
 *   - Image analysis (Gemini multimodal)
 *
 * Analyze-Image Mode:
 *   node llm-orchestrate.js gemini analyze-image "./image.png" "Analyze this UI"
 *   node llm-orchestrate.js gemini analyze-image "./image.png" "prompt" --system "system prompt"
 *
 * Input: JSON from stdin with { prompt: string } (when no CLI args)
 */
import { getLibBaseUrl, readVibeConfig } from './utils.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync, spawn } from 'child_process';

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
// Voice Transcription (record + Gemini STT)
// ============================================

function parseVoiceArgs(args) {
  const result = { pro: false, lang: null, duration: 60 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pro') {
      result.pro = true;
    } else if (args[i] === '--lang' || args[i] === '-l') {
      result.lang = args[++i];
    } else if (args[i] === '--duration' || args[i] === '-d') {
      result.duration = parseInt(args[++i], 10) || 60;
    }
  }
  return result;
}

function checkSoxInstalled() {
  try {
    execSync('sox --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function recordAudio(outputPath, maxDuration) {
  return new Promise((resolve, reject) => {
    const soxProcess = spawn('sox', [
      '-d',
      '-r', '16000',
      '-c', '1',
      '-b', '16',
      '-t', 'wav',
      outputPath,
      'trim', '0', String(maxDuration),
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderrData = '';
    soxProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    // Enter 키로 녹음 중지
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const onKeypress = (key) => {
      if (key[0] === 13 || key[0] === 10 || key[0] === 3) {
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        process.stdin.removeListener('data', onKeypress);
        soxProcess.kill('SIGTERM');
      }
    };
    process.stdin.on('data', onKeypress);

    soxProcess.on('close', () => {
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      process.stdin.removeListener('data', onKeypress);

      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 44) {
        resolve(outputPath);
      } else {
        reject(new Error(`Recording failed: ${stderrData || 'empty audio'}`));
      }
    });

    soxProcess.on('error', (err) => {
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      process.stdin.removeListener('data', onKeypress);
      reject(new Error(`Sox process error: ${err.message}`));
    });
  });
}

async function callProvider(providerName, prompt, sysPrompt, jsonMode) {
  const modulePath = `${LIB_URL}${providerName}-api.js`;
  const module = await import(modulePath);

  const orchestrateFn = providerName === 'gpt'
    ? module.coreGptOrchestrate
    : module.coreGeminiOrchestrate;

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

    const modelLabel = imageArgs.model === 'nano-banana-pro' ? 'Nano Banana Pro' : 'Nano Banana';
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

  // Voice mode handling
  if (mode === 'voice') {
    if (provider !== 'gemini') {
      console.log(JSON.stringify({
        success: false,
        error: 'Voice transcription only supports gemini provider',
      }));
      return;
    }

    if (!checkSoxInstalled()) {
      console.log(JSON.stringify({
        success: false,
        error: 'sox is not installed. Install with: brew install sox (macOS) or apt install sox (Linux)',
      }));
      return;
    }

    const voiceArgs = parseVoiceArgs(process.argv.slice(4));
    const voiceModel = voiceArgs.pro ? 'gemini-3-pro' : 'gemini-3-flash';
    const tmpFile = path.join(os.tmpdir(), `vibe-voice-${crypto.randomUUID()}.wav`);

    console.error(`[VOICE] Recording audio... (press Enter to stop, max ${voiceArgs.duration}s)`);
    console.error(`  Model: ${voiceModel}`);
    if (voiceArgs.lang) {
      console.error(`  Language: ${voiceArgs.lang}`);
    }

    try {
      await recordAudio(tmpFile, voiceArgs.duration);

      const stats = fs.statSync(tmpFile);
      const fileSizeKB = (stats.size / 1024).toFixed(1);
      console.error(`[VOICE] Recording complete (${fileSizeKB} KB). Transcribing...`);

      const geminiApi = await import(`${LIB_URL}gemini-api.js`);
      const result = await geminiApi.transcribeAudio(tmpFile, {
        model: voiceModel,
        language: voiceArgs.lang || undefined,
      });

      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      console.log(JSON.stringify({
        success: true,
        transcription: result.transcription,
        duration: result.duration,
        model: result.model,
      }));
    } catch (err) {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      console.log(JSON.stringify({
        success: false,
        error: err.message,
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
    gemini: /^(gemini[-.\s]|제미나이-|vibe-gemini-)\s*/i,
  };
  const cleanPrompt = prompt.replace(prefixPatterns[provider] || /^/, '').trim();
  const jsonMode = mode === 'orchestrate-json';

  // Provider chain: primary → cross fallback
  const vibeConfig = readVibeConfig();
  const gptModel = vibeConfig.models?.gpt || process.env.GPT_MODEL || 'gpt-5.3-codex';
  const gptLabel = gptModel.includes('spark') ? 'GPT-5.3 Spark' : 'GPT-5.3';
  const providerLabels = { gpt: gptLabel, gemini: 'Gemini-3' };
  const providerChain = provider === 'gpt'
    ? ['gpt', 'gemini']
    : ['gemini', 'gpt'];

  for (const currentProvider of providerChain) {
    const label = providerLabels[currentProvider] || currentProvider.toUpperCase();
    const result = await callWithRetry(currentProvider, cleanPrompt, systemPrompt, jsonMode);

    if (result.success) {
      console.log(`${label} response: ${result.result}`);
      return;
    }

    // Log failure and try fallback
    if (currentProvider !== providerChain[providerChain.length - 1]) {
      const nextProvider = providerChain[providerChain.indexOf(currentProvider) + 1];
      const nextLabel = providerLabels[nextProvider] || nextProvider.toUpperCase();
      console.error(`[${currentProvider.toUpperCase()}] Failed: ${result.error}. Falling back to ${nextLabel}...`);
    } else {
      // All providers failed
      console.log(`[LLM] Error: All providers failed. Last error: ${result.error}`);
    }
  }
}

main();
