/**
 * MultiLlmResearch - GPT/Gemini 기반 Multi-LLM 리서치
 * parallelResearch.ts에서 추출 (v2.6.0)
 */

import { MultiLlmResult } from './types.js';
import { warnLog } from '../lib/utils.js';
import * as gptApi from '../lib/gpt-api.js';
import * as geminiApi from '../lib/gemini-api.js';

/**
 * Multi-LLM 리서치 프롬프트 생성
 */
export function createMultiLlmPrompts(feature: string, techStack: string[]): {
  bestPractices: { gpt: string; gemini: string };
  security: { gpt: string; gemini: string };
} {
  const stackStr = techStack.length > 0 ? techStack.join(', ') : 'the project';

  return {
    bestPractices: {
      gpt: `Best practices for implementing "${feature}" with ${stackStr}.
Focus on: architecture patterns, code conventions, design patterns.
Return JSON: { patterns: string[], antiPatterns: string[], libraries: string[] }`,
      gemini: `Best practices for implementing "${feature}" with ${stackStr}.
Focus on: latest trends, framework updates, modern approaches.
Return JSON: { patterns: string[], antiPatterns: string[], libraries: string[] }`
    },
    security: {
      gpt: `Security considerations for "${feature}" with ${stackStr}.
Focus on: CVE database, known vulnerabilities, exploit patterns.
Return JSON: { vulnerabilities: string[], mitigations: string[], checklist: string[] }`,
      gemini: `Security advisories for "${feature}" with ${stackStr}.
Focus on: latest patches, recent incidents, security best practices.
Return JSON: { advisories: string[], patches: string[], incidents: string[] }`
    }
  };
}

/**
 * GPT API 호출 (에러 처리 포함)
 */
async function callGptSafe(
  prompt: string,
  systemPrompt: string,
  jsonMode: boolean = true
): Promise<{ result: string; success: boolean; error?: string }> {
  try {
    const result = await gptApi.vibeGptOrchestrate(prompt, systemPrompt, { jsonMode });
    return { result, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    warnLog('[Multi-LLM] GPT call failed:', errorMsg);
    return { result: '', success: false, error: errorMsg };
  }
}

/**
 * Gemini API 호출 (에러 처리 포함)
 */
async function callGeminiSafe(
  prompt: string,
  systemPrompt: string,
  jsonMode: boolean = true
): Promise<{ result: string; success: boolean; error?: string }> {
  try {
    const result = await geminiApi.vibeGeminiOrchestrate(prompt, systemPrompt, { jsonMode });
    return { result, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    warnLog('[Multi-LLM] Gemini call failed:', errorMsg);
    return { result: '', success: false, error: errorMsg };
  }
}

/**
 * Multi-LLM 병렬 리서치 실행
 */
export async function executeMultiLlmResearch(
  feature: string,
  techStack: string[]
): Promise<MultiLlmResult[]> {
  const prompts = createMultiLlmPrompts(feature, techStack);
  const results: MultiLlmResult[] = [];
  const promises: Promise<void>[] = [];

  // Best Practices - GPT
  promises.push(
    (async () => {
      const taskStart = Date.now();
      const { result, success, error } = await callGptSafe(
        prompts.bestPractices.gpt,
        'You are an expert software architect. Provide best practices in JSON format.'
      );
      results.push({
        provider: 'gpt',
        category: 'best-practices',
        result, success, error,
        duration: Date.now() - taskStart
      });
    })()
  );

  // Best Practices - Gemini
  promises.push(
    (async () => {
      const taskStart = Date.now();
      const { result, success, error } = await callGeminiSafe(
        prompts.bestPractices.gemini,
        'You are an expert in modern development trends. Provide best practices in JSON format.'
      );
      results.push({
        provider: 'gemini',
        category: 'best-practices',
        result, success, error,
        duration: Date.now() - taskStart
      });
    })()
  );

  // Security - GPT
  promises.push(
    (async () => {
      const taskStart = Date.now();
      const { result, success, error } = await callGptSafe(
        prompts.security.gpt,
        'You are a security expert. Focus on CVE database and known vulnerabilities. Return JSON format.'
      );
      results.push({
        provider: 'gpt',
        category: 'security',
        result, success, error,
        duration: Date.now() - taskStart
      });
    })()
  );

  // Security - Gemini
  promises.push(
    (async () => {
      const taskStart = Date.now();
      const { result, success, error } = await callGeminiSafe(
        prompts.security.gemini,
        'You are a security advisor. Focus on latest advisories and patches. Return JSON format.'
      );
      results.push({
        provider: 'gemini',
        category: 'security',
        result, success, error,
        duration: Date.now() - taskStart
      });
    })()
  );

  await Promise.all(promises);
  return results;
}

/**
 * Multi-LLM 결과 포맷팅
 */
export function formatMultiLlmResults(results: MultiLlmResult[]): string {
  if (results.length === 0) {
    return '[Multi-LLM] No results available';
  }

  const successCount = results.filter(r => r.success).length;
  let output = `\n## Multi-LLM Research Results (${successCount}/${results.length} successful)\n\n`;

  // Best Practices 섹션
  const bestPractices = results.filter(r => r.category === 'best-practices');
  if (bestPractices.length > 0) {
    output += `### Best Practices\n\n`;
    for (const bp of bestPractices) {
      const status = bp.success ? '✅' : '❌';
      output += `#### ${status} ${bp.provider.toUpperCase()} (${(bp.duration / 1000).toFixed(1)}s)\n`;
      output += bp.success ? `${bp.result}\n\n` : `Error: ${bp.error}\n\n`;
    }
  }

  // Security 섹션
  const security = results.filter(r => r.category === 'security');
  if (security.length > 0) {
    output += `### Security Advisories\n\n`;
    for (const sec of security) {
      const status = sec.success ? '✅' : '❌';
      output += `#### ${status} ${sec.provider.toUpperCase()} (${(sec.duration / 1000).toFixed(1)}s)\n`;
      output += sec.success ? `${sec.result}\n\n` : `Error: ${sec.error}\n\n`;
    }
  }

  return output;
}
