/**
 * Gemini 오케스트레이션 함수
 * - 검색 없이 빠르고 결정론적인 응답
 */

import { chat } from './chat.js';
import type { VibeGeminiOptions } from './types.js';

/**
 * Core Gemini 오케스트레이션 (검색 없음, JSON 모드)
 * - 검색 제외로 빠른 응답
 * - temperature=0 으로 결정론적 결과
 * - JSON 출력 강제 가능
 */
export async function coreGeminiOrchestrate(
  prompt: string,
  systemPrompt: string,
  options: VibeGeminiOptions = {}
): Promise<string> {
  const { maxTokens = 4096, jsonMode = true } = options;

  const result = await chat({
    model: 'gemini-3-pro',
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    temperature: 0,
    webSearch: false,
    systemPrompt: jsonMode
      ? `${systemPrompt}\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no explanation, just pure JSON.`
      : systemPrompt,
  });
  return result.content;
}

/**
 * Core Spec 파싱 (Core Spec → 실행 계획)
 */
export async function coreGeminiParseSpec(spec: string): Promise<string> {
  return coreGeminiOrchestrate(spec, `You are a Core Spec parser. Parse the given specification and output a structured execution plan.
Output format: { "phases": [...], "files": [...], "dependencies": [...] }`);
}

/**
 * Core 실행 계획 수립 (Task → Steps)
 */
export async function coreGeminiPlanExecution(task: string, context: string): Promise<string> {
  return coreGeminiOrchestrate(
    `Task: ${task}\n\nContext:\n${context}`,
    `You are a Core execution planner. Given a task and context, create a step-by-step execution plan.
Output format: { "steps": [{ "id": 1, "action": "...", "target": "...", "expected": "..." }], "estimatedComplexity": "low|medium|high" }`
  );
}

/**
 * Core 코드 분석 (빠른 구조 분석)
 */
export async function coreGeminiAnalyze(code: string, question: string): Promise<string> {
  return coreGeminiOrchestrate(
    `Code:\n\`\`\`\n${code}\n\`\`\`\n\nQuestion: ${question}`,
    `You are a code analyzer. Answer the question about the given code concisely.
Output format: { "answer": "...", "confidence": 0.0-1.0, "relatedSymbols": [...] }`
  );
}

/**
 * Core 다음 액션 결정 (상태 기반)
 */
export async function coreGeminiDecideNextAction(
  currentState: string,
  availableActions: string[],
  goal: string
): Promise<string> {
  return coreGeminiOrchestrate(
    `Current State:\n${currentState}\n\nAvailable Actions:\n${availableActions.join('\n')}\n\nGoal: ${goal}`,
    `You are an action decider. Based on the current state and goal, select the best next action.
Output format: { "selectedAction": "...", "reason": "...", "parameters": {} }`
  );
}

/**
 * Core UI/UX 분석 (검색 없이 내부 지식으로)
 */
export async function coreGeminiAnalyzeUX(description: string): Promise<string> {
  return coreGeminiOrchestrate(
    description,
    `You are a UI/UX expert. Analyze the given design description and provide structured feedback.
Output format: { "issues": [...], "suggestions": [...], "accessibility": { "score": 0-100, "concerns": [...] } }`,
    { jsonMode: true }
  );
}
