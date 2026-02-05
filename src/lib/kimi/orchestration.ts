/**
 * Kimi Core 오케스트레이션
 */

import { chat } from './chat.js';
import type { VibeKimiOptions } from './types.js';

/**
 * Core Kimi 오케스트레이션 (GPT 패턴과 동일)
 * temperature: 0, jsonMode 지원
 */
export async function coreKimiOrchestrate(
  prompt: string,
  systemPrompt: string = 'You are a helpful assistant.',
  options: VibeKimiOptions = {}
): Promise<string> {
  const { maxTokens = 4096, jsonMode = true } = options;

  const result = await chat({
    model: 'kimi-k2.5',
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    temperature: 0,
    systemPrompt: jsonMode
      ? `${systemPrompt}\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no explanation, just pure JSON.`
      : systemPrompt,
  });
  return result.content;
}
