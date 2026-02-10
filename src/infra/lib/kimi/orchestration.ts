/**
 * Kimi Direct (Moonshot) 오케스트레이션
 */

import { chat } from './chat.js';
import { KIMI_DEFAULT_MODEL } from '../kimi-constants.js';
import type { VibeKimiOptions } from './types.js';

/**
 * Core Kimi 오케스트레이션
 * Moonshot 직접 API를 통한 Kimi K2.5 호출
 */
export async function coreKimiOrchestrate(
  prompt: string,
  systemPrompt: string = 'You are a helpful assistant.',
  options: VibeKimiOptions = {}
): Promise<string> {
  const { maxTokens = 4096, jsonMode = true } = options;

  const result = await chat({
    model: KIMI_DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    systemPrompt: jsonMode
      ? `${systemPrompt}\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no explanation, just pure JSON.`
      : systemPrompt,
  });
  return result.content;
}
