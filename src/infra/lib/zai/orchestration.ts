/**
 * ZAI (Z.ai / GLM) 오케스트레이션 함수
 */

import { chat, DEFAULT_MODEL, ZAI_TOP_MODEL } from './client.js';
import { CostAccumulator } from '../CostAccumulator.js';
import type { VibeZaiOptions } from './types.js';

/**
 * Core ZAI 오케스트레이션 (결정론적, 선택적 JSON 모드)
 * coding 키가 있으면 자동으로 GLM Coding Plan 을 사용한다.
 */
export async function coreZaiOrchestrate(
  prompt: string,
  systemPrompt: string,
  options: VibeZaiOptions = {}
): Promise<string> {
  const { maxTokens = 4096, jsonMode = false, plan, signal, timeoutMs } = options;
  const start = Date.now();
  const result = await chat({
    messages: [{ role: 'user', content: prompt }],
    systemPrompt: jsonMode ? `${systemPrompt}\n\nRespond with valid JSON only.` : systemPrompt,
    maxTokens,
    temperature: 0,
    plan,
    signal,
    timeoutMs,
  });
  CostAccumulator.logCost({
    provider: 'zai',
    model: result.model || DEFAULT_MODEL,
    inputLen: prompt.length + systemPrompt.length,
    outputLen: result.content.length,
    durationMs: Date.now() - start,
  });
  return result.content;
}

/**
 * UI 개발 전용 — GLM 최고 모델(coding plan) 로 실행.
 * "zai 사용 가능 시 모든 UI 개발은 GLM 최고 모델이 담당" 정책의 실행 지점.
 */
export async function coreZaiUiImplement(
  prompt: string,
  systemPrompt = 'You are a senior UI engineer. Produce production-quality, accessible UI code that matches the project stack and design system.'
): Promise<string> {
  const start = Date.now();
  const result = await chat({
    model: ZAI_TOP_MODEL,
    plan: 'coding',
    messages: [{ role: 'user', content: prompt }],
    systemPrompt,
    maxTokens: 8192,
    temperature: 0,
  });
  CostAccumulator.logCost({
    provider: 'zai',
    model: result.model || ZAI_TOP_MODEL,
    inputLen: prompt.length + systemPrompt.length,
    outputLen: result.content.length,
    durationMs: Date.now() - start,
  });
  return result.content;
}
