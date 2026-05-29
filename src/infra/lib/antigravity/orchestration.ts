/**
 * Antigravity 오케스트레이션 함수
 * - 검색 없이 빠르고 결정론적인 응답
 */

import { chat, DEFAULT_MODEL } from './chat.js';
import type { VibeAntigravityOptions } from './types.js';

/**
 * Core Antigravity 오케스트레이션 (검색 없음, JSON 모드)
 * - 검색 제외로 빠른 응답
 * - temperature=0 으로 결정론적 결과
 * - JSON 출력 강제 가능
 */
export async function coreAntigravityOrchestrate(
  prompt: string,
  systemPrompt: string,
  options: VibeAntigravityOptions = {}
): Promise<string> {
  const { maxTokens = 4096, jsonMode = true } = options;

  const result = await chat({
    model: 'antigravity-pro',
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    temperature: 0,
    webSearch: false,
    jsonMode,
    systemPrompt: jsonMode
      ? `${systemPrompt}\n\nRespond with valid JSON only.`
      : systemPrompt,
  });
  return result.content;
}

/**
 * Core Spec 파싱 (Core Spec → 실행 계획)
 */
export async function coreAntigravityParseSpec(spec: string): Promise<string> {
  return coreAntigravityOrchestrate(spec, `You are a Core Spec parser. Parse the given specification and output a structured execution plan.
Output format: { "phases": [...], "files": [...], "dependencies": [...] }`);
}

/**
 * Core 실행 계획 수립 (Task → Steps)
 */
export async function coreAntigravityPlanExecution(task: string, context: string): Promise<string> {
  return coreAntigravityOrchestrate(
    `Task: ${task}\n\nContext:\n${context}`,
    `You are a Core execution planner. Given a task and context, create a step-by-step execution plan.
Output format: { "steps": [{ "id": 1, "action": "...", "target": "...", "expected": "..." }], "estimatedComplexity": "low|medium|high" }`
  );
}

/**
 * Core 코드 분석 (빠른 구조 분석)
 */
export async function coreAntigravityAnalyze(code: string, question: string): Promise<string> {
  return coreAntigravityOrchestrate(
    `Code:\n\`\`\`\n${code}\n\`\`\`\n\nQuestion: ${question}`,
    `You are a code analyzer. Answer the question about the given code concisely.
Output format: { "answer": "...", "confidence": 0.0-1.0, "relatedSymbols": [...] }`
  );
}

/**
 * Core 다음 액션 결정 (상태 기반)
 */
export async function coreAntigravityDecideNextAction(
  currentState: string,
  availableActions: string[],
  goal: string
): Promise<string> {
  return coreAntigravityOrchestrate(
    `Current State:\n${currentState}\n\nAvailable Actions:\n${availableActions.join('\n')}\n\nGoal: ${goal}`,
    `You are an action decider. Based on the current state and goal, select the best next action.
Output format: { "selectedAction": "...", "reason": "...", "parameters": {} }`
  );
}

/**
 * Core UI/UX 분석 (검색 없이 내부 지식으로)
 */
export async function coreAntigravityAnalyzeUX(description: string): Promise<string> {
  return coreAntigravityOrchestrate(
    description,
    `You are a UI/UX expert. Analyze the given design description and provide structured feedback.
Output format: { "issues": [...], "suggestions": [...], "accessibility": { "score": 0-100, "concerns": [...] } }`,
    { jsonMode: true }
  );
}
