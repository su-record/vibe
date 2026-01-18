/**
 * UserPromptSubmit Hook - LLM 오케스트레이션 (GPT/Gemini)
 *
 * Usage: node llm-orchestrate.js <provider> <mode> <systemPrompt>
 *   provider: gpt | gemini
 *   mode: orchestrate | orchestrate-json
 *   systemPrompt: (optional) custom system prompt for orchestrate mode
 *
 * Input: JSON from stdin with { prompt: string }
 */
import { getLibBaseUrl } from './utils.js';

const LIB_URL = getLibBaseUrl();

const provider = process.argv[2] || 'gemini';
const mode = process.argv[3] || 'orchestrate';
const systemPrompt = process.argv[4] || 'You are a helpful assistant.';

async function main() {
  let prompt;

  // CLI argument가 있으면 사용 (5번째 인자부터)
  const cliPrompt = process.argv.slice(5).join(' ').trim();

  if (cliPrompt) {
    // CLI에서 직접 호출: node script.js gpt orchestrate "system" "prompt"
    prompt = cliPrompt;
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

  try {
    const modulePath = `${LIB_URL}${provider}-api.js`;
    const module = await import(modulePath);

    const jsonMode = mode === 'orchestrate-json';
    const orchestrateFn = provider === 'gpt'
      ? module.vibeGptOrchestrate
      : module.vibeGeminiOrchestrate;
    const result = await orchestrateFn(cleanPrompt, systemPrompt, { jsonMode });
    const label = provider === 'gpt' ? 'GPT-5.2' : 'Gemini-3';
    console.log(`${label} 응답: ${result}`);
  } catch (e) {
    console.log(`[${provider.toUpperCase()}] Error: ${e.message}`);
  }
}

main();
