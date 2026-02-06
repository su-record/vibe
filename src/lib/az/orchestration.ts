/**
 * Azure Foundry 오케스트레이션
 */

import { chat } from './chat.js';
import { AZ_TASK_MODEL, AZ_DEFAULT_MODEL } from '../az-constants.js';
import type { VibeAzOptions } from './types.js';

/**
 * Core AZ 오케스트레이션
 * - taskType에 따라 최적 모델 자동 선택
 *   현재 Azure에 kimi-k2.5만 배포되어 모든 태스크 → kimi-k2.5
 */
export async function coreAzOrchestrate(
  prompt: string,
  systemPrompt: string = 'You are a helpful assistant.',
  options: VibeAzOptions = {}
): Promise<string> {
  const { maxTokens = 4096, jsonMode = true, taskType } = options;

  const model = taskType ? (AZ_TASK_MODEL[taskType] || AZ_DEFAULT_MODEL) : AZ_DEFAULT_MODEL;

  const result = await chat({
    model,
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    systemPrompt: jsonMode
      ? `${systemPrompt}\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no explanation, just pure JSON.`
      : systemPrompt,
  });
  return result.content;
}
