/**
 * GPT 특수 기능 (아키텍처 분석, 디버깅)
 */

import { ask } from './chat.js';
import { isCodexAvailable } from '../llm-availability.js';

/**
 * 아키텍처/디버깅 분석 (GPT-5.4 사용)
 */
export async function analyzeArchitecture(prompt: string): Promise<string> {
  if (!isCodexAvailable()) return '';
  return ask(prompt, {
    model: 'gpt-5.4',
    maxTokens: 8192,
    temperature: 0.5,
    systemPrompt: 'You are a senior software architect. Analyze the given code or architecture and provide detailed insights, potential issues, and recommendations.',
  });
}

/**
 * 코드 디버깅 (GPT-5.4 Codex 사용 — 코딩 특화)
 */
export async function debugCode(prompt: string): Promise<string> {
  if (!isCodexAvailable()) return '';
  return ask(prompt, {
    model: 'gpt-5.3-codex',
    maxTokens: 4096,
    temperature: 0.3,
    systemPrompt: 'You are an expert debugger. Analyze the given code, identify bugs, and provide fixes with clear explanations.',
  });
}
