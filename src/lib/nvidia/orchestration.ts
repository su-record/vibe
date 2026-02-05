/**
 * NVIDIA NIM 오케스트레이션
 */

import { chat } from './chat.js';
import { NVIDIA_TASK_MODEL, NVIDIA_DEFAULT_MODEL } from '../nvidia-constants.js';
import type { VibeNvidiaOptions } from './types.js';

/**
 * Core NVIDIA 오케스트레이션
 * - taskType에 따라 최적 모델 자동 선택
 *   reasoning/architecture → kimi-k2-thinking
 *   code-review → devstral-2
 *   code-analysis → kimi-k2-instruct
 *   code-gen → qwen3-coder
 *   debugging → deepseek-v3.2
 *   general → kimi-k2.5
 */
export async function coreNvidiaOrchestrate(
  prompt: string,
  systemPrompt: string = 'You are a helpful assistant.',
  options: VibeNvidiaOptions = {}
): Promise<string> {
  const { maxTokens = 4096, jsonMode = true, taskType } = options;

  const model = taskType ? (NVIDIA_TASK_MODEL[taskType] || NVIDIA_DEFAULT_MODEL) : NVIDIA_DEFAULT_MODEL;

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

// 하위 호환
/** @deprecated Use coreNvidiaOrchestrate */
export const coreKimiOrchestrate = coreNvidiaOrchestrate;
