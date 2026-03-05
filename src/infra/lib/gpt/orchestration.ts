/**
 * Core GPT 오케스트레이션 함수
 */

import { chat } from './chat.js';
import type { VibeGptOptions } from './types.js';

/**
 * Core GPT 오케스트레이션 (검색 없음, JSON 모드)
 * - 검색 제외로 빠른 응답
 * - temperature=0 으로 결정론적 결과
 * - JSON 출력 강제 가능
 */
export async function coreGptOrchestrate(
  prompt: string,
  systemPrompt: string,
  options: VibeGptOptions = {}
): Promise<string> {
  const { maxTokens = 4096, jsonMode = true } = options;

  const result = await chat({
    model: 'gpt-5.4',
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    temperature: 0,
    systemPrompt: jsonMode
      ? `${systemPrompt}\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no explanation, just pure JSON.`
      : systemPrompt,
  });
  return result.content;
}

/**
 * Core Spec 파싱 (Core Spec → 실행 계획)
 */
export async function coreGptParseSpec(spec: string): Promise<string> {
  return coreGptOrchestrate(spec, `You are a Core Spec parser. Parse the given specification and output a structured execution plan.
Output format: { "phases": [...], "files": [...], "dependencies": [...] }`);
}

/**
 * Core 실행 계획 수립 (Task → Steps)
 */
export async function coreGptPlanExecution(task: string, context: string): Promise<string> {
  return coreGptOrchestrate(
    `Task: ${task}\n\nContext:\n${context}`,
    `You are a Core execution planner. Given a task and context, create a step-by-step execution plan.
Output format: { "steps": [{ "id": 1, "action": "...", "target": "...", "expected": "..." }], "estimatedComplexity": "low|medium|high" }`
  );
}

/**
 * Core 코드 분석 (빠른 구조 분석)
 */
export async function coreGptAnalyze(code: string, question: string): Promise<string> {
  return coreGptOrchestrate(
    `Code:\n\`\`\`\n${code}\n\`\`\`\n\nQuestion: ${question}`,
    `You are a code analyzer. Answer the question about the given code concisely.
Output format: { "answer": "...", "confidence": 0.0-1.0, "relatedSymbols": [...] }`
  );
}

/**
 * Core 다음 액션 결정 (상태 기반)
 */
export async function coreGptDecideNextAction(
  currentState: string,
  availableActions: string[],
  goal: string
): Promise<string> {
  return coreGptOrchestrate(
    `Current State:\n${currentState}\n\nAvailable Actions:\n${availableActions.join('\n')}\n\nGoal: ${goal}`,
    `You are an action decider. Based on the current state and goal, select the best next action.
Output format: { "selectedAction": "...", "reason": "...", "parameters": {} }`
  );
}
