/**
 * Core GPT 오케스트레이션 함수
 */
import { chat } from './chat.js';
import { CostAccumulator } from '../CostAccumulator.js';
/**
 * Core GPT 오케스트레이션 (검색 없음, JSON 모드)
 * - 검색 제외로 빠른 응답
 * - temperature=0 으로 결정론적 결과
 * - JSON 출력 강제 가능
 */
export async function coreGptOrchestrate(prompt, systemPrompt, options = {}) {
    const { maxTokens = 4096, jsonMode = true, signal, timeoutMs } = options;
    const start = Date.now();
    const result = await chat({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: prompt }],
        maxTokens,
        temperature: 0,
        systemPrompt: jsonMode
            ? `${systemPrompt}\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no explanation, just pure JSON.`
            : systemPrompt,
        signal,
        timeoutMs,
    });
    // TS 직접 호출 비용 집계 (B-8) — hook CLI 와 동일 원장에 기록
    CostAccumulator.logCost({
        provider: 'gpt',
        model: result.model || 'gpt-5.5',
        inputLen: prompt.length + systemPrompt.length,
        outputLen: result.content.length,
        durationMs: Date.now() - start,
    });
    return result.content;
}
/**
 * Core Spec 파싱 (Core Spec → 실행 계획)
 */
export async function coreGptParseSpec(spec) {
    return coreGptOrchestrate(spec, `You are a Core Spec parser. Parse the given specification and output a structured execution plan.
Output format: { "phases": [...], "files": [...], "dependencies": [...] }`);
}
/**
 * Core 실행 계획 수립 (Task → Steps)
 */
export async function coreGptPlanExecution(task, context) {
    return coreGptOrchestrate(`Task: ${task}\n\nContext:\n${context}`, `You are a Core execution planner. Given a task and context, create a step-by-step execution plan.
Output format: { "steps": [{ "id": 1, "action": "...", "target": "...", "expected": "..." }], "estimatedComplexity": "low|medium|high" }`);
}
/**
 * Core 코드 분석 (빠른 구조 분석)
 */
export async function coreGptAnalyze(code, question) {
    return coreGptOrchestrate(`Code:\n\`\`\`\n${code}\n\`\`\`\n\nQuestion: ${question}`, `You are a code analyzer. Answer the question about the given code concisely.
Output format: { "answer": "...", "confidence": 0.0-1.0, "relatedSymbols": [...] }`);
}
/**
 * Core 다음 액션 결정 (상태 기반)
 */
export async function coreGptDecideNextAction(currentState, availableActions, goal) {
    return coreGptOrchestrate(`Current State:\n${currentState}\n\nAvailable Actions:\n${availableActions.join('\n')}\n\nGoal: ${goal}`, `You are an action decider. Based on the current state and goal, select the best next action.
Output format: { "selectedAction": "...", "reason": "...", "parameters": {} }`);
}
//# sourceMappingURL=orchestration.js.map