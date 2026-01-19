/**
 * Parallel Research - 병렬 리서치 에이전트 실행
 * Agent SDK의 query() 함수를 사용하여 여러 에이전트를 동시에 실행
 * v2.5.0: Multi-LLM Research (Claude + GPT + Gemini)
 */

import {
  ParallelResearchArgs,
  ParallelResearchResult,
  ResearchTask,
  AgentResult,
  AgentMessage,
  MultiLlmResult
} from './types.js';
import { ToolResult } from '../types/tool.js';
import { getAgentSdkQuery, warnLog } from '../lib/utils.js';
import { DEFAULT_MODELS, TIMEOUTS, AGENT } from '../lib/constants.js';
import * as gptApi from '../lib/gpt-api.js';
import * as geminiApi from '../lib/gemini-api.js';

/**
 * 기본 리서치 태스크 템플릿
 */
export function createResearchTasks(feature: string, techStack: string[] = []): ResearchTask[] {
  const stackStr = techStack.length > 0 ? techStack.join(', ') : 'the project';

  return [
    {
      name: 'best-practices-agent',
      category: 'best-practices',
      prompt: `Research best practices for implementing "${feature}" with ${stackStr}. Focus on:
1. Industry-standard patterns
2. Common pitfalls to avoid
3. Recommended libraries/tools
4. Testing strategies

Provide actionable recommendations.`
    },
    {
      name: 'framework-docs-agent',
      category: 'framework-docs',
      prompt: `Find the latest documentation for ${stackStr} related to "${feature}". Include:
1. Official API references
2. Configuration options
3. Migration guides if applicable
4. Code examples from official docs

Use context7 MCP if available for up-to-date documentation.`
    },
    {
      name: 'codebase-patterns-agent',
      category: 'codebase-patterns',
      prompt: `Analyze the current codebase for patterns related to "${feature}". Look for:
1. Similar existing implementations
2. Established conventions
3. Reusable utilities
4. Potential conflicts or dependencies

Use Glob and Grep to search the codebase.`
    },
    {
      name: 'security-advisory-agent',
      category: 'security-advisory',
      prompt: `Review security considerations for "${feature}" with ${stackStr}. Check:
1. OWASP Top 10 relevance
2. Authentication/authorization requirements
3. Data validation needs
4. Known vulnerabilities in dependencies

Provide security recommendations.`
    }
  ];
}

/**
 * 에이전트 파일 로드
 */
async function loadAgentFile(agentName: string, projectPath: string): Promise<string | null> {
  const { promises: fs } = await import('fs');
  const path = await import('path');

  // 에이전트 파일 경로 우선순위
  const possiblePaths = [
    path.join(projectPath, '.claude', 'agents', 'research', `${agentName}.md`),
    path.join(projectPath, 'agents', 'research', `${agentName}.md`),
    // 패키지 내장 에이전트 (fallback)
    path.join(process.cwd(), 'agents', 'research', `${agentName}.md`)
  ];

  for (const filePath of possiblePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch { /* ignore: optional operation */
      // 다음 경로 시도
    }
  }

  return null;
}

/**
 * 단일 리서치 태스크 실행
 */
async function executeResearchTask(
  task: ResearchTask,
  projectPath: string,
  timeout: number
): Promise<AgentResult> {
  const startTime = Date.now();

  const query = await getAgentSdkQuery();

  // Agent SDK가 없으면 시뮬레이션 결과 반환
  if (!query) {
    return {
      agentName: task.name,
      sessionId: `simulated-${Date.now()}`,
      result: `[Agent SDK not installed] Task "${task.name}" would execute: ${task.prompt.slice(0, 100)}...`,
      success: true,
      duration: Date.now() - startTime
    };
  }

  try {
    let sessionId = '';
    let result = '';

    // 에이전트 파일 로드 (systemPrompt로 사용)
    const agentContent = await loadAgentFile(task.name, projectPath);

    // Agent SDK query 실행
    const response = query({
      prompt: task.prompt,
      options: {
        model: DEFAULT_MODELS.RESEARCH,
        maxTurns: 3,
        allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
        cwd: projectPath,
        systemPrompt: agentContent || undefined
      }
    });

    // 타임아웃 처리
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Research task timeout')), timeout);
    });

    // 스트리밍 결과 수집
    const collectResult = async () => {
      for await (const message of response) {
        const msg = message as AgentMessage;

        if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
          sessionId = msg.session_id;
        }

        if (msg.type === 'result' && msg.result) {
          result = msg.result;
        }

        if (msg.type === 'assistant' && msg.message?.content) {
          const textContent = msg.message.content
            .filter(block => block.type === 'text' && block.text)
            .map(block => block.text)
            .join('\n');
          if (textContent) {
            result += textContent;
          }
        }
      }
    };

    await Promise.race([collectResult(), timeoutPromise]);

    return {
      agentName: task.name,
      sessionId,
      result: result || 'No result collected',
      success: true,
      duration: Date.now() - startTime
    };

  } catch (error) {
    return {
      agentName: task.name,
      sessionId: '',
      result: '',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    };
  }
}

/**
 * 병렬 리서치 실행
 */
export async function parallelResearch(args: ParallelResearchArgs): Promise<ToolResult> {
  const {
    tasks,
    projectPath = process.cwd(),
    maxConcurrency = AGENT.MAX_CONCURRENCY,
    timeout = TIMEOUTS.RESEARCH
  } = args;

  const startTime = Date.now();
  const results: AgentResult[] = [];

  try {
    // 동시성 제어를 위한 청크 분할
    const chunks: ResearchTask[][] = [];
    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      chunks.push(tasks.slice(i, i + maxConcurrency));
    }

    // 청크별 병렬 실행
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(task => executeResearchTask(task, projectPath, timeout))
      );
      results.push(...chunkResults);
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    // 결과 포맷팅
    let summary = `## Parallel Research Results\n\n`;
    summary += `**Duration**: ${(totalDuration / 1000).toFixed(1)}s\n`;
    summary += `**Success**: ${successCount}/${results.length}\n\n`;

    for (const result of results) {
      const status = result.success ? '✅' : '❌';
      summary += `### ${status} ${result.agentName}\n`;
      summary += `Duration: ${(result.duration / 1000).toFixed(1)}s\n`;

      if (result.success) {
        // 결과 요약 (첫 500자)
        const preview = result.result.length > 500
          ? result.result.slice(0, 500) + '...'
          : result.result;
        summary += `\n${preview}\n`;
      } else {
        summary += `Error: ${result.error}\n`;
      }
      summary += '\n---\n\n';
    }

    const fullResult: ParallelResearchResult = {
      results,
      totalDuration,
      successCount,
      failureCount
    };

    return {
      content: [{ type: 'text', text: summary }],
      ...fullResult
    } as ToolResult & ParallelResearchResult;

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Parallel research failed: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * 기능 기반 병렬 리서치 (간편 API)
 */
export async function researchFeature(
  feature: string,
  techStack: string[] = [],
  projectPath: string = process.cwd()
): Promise<ToolResult> {
  const tasks = createResearchTasks(feature, techStack);
  return parallelResearch({ tasks, projectPath });
}

// ============================================
// Multi-LLM Research (v2.5.0)
// ============================================

/**
 * Multi-LLM 리서치 프롬프트 생성
 */
function createMultiLlmPrompts(feature: string, techStack: string[]): {
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
 * Claude 에이전트와 함께 GPT/Gemini를 병렬로 호출하여 3-way validation 수행
 */
export async function executeMultiLlmResearch(
  feature: string,
  techStack: string[]
): Promise<MultiLlmResult[]> {
  const prompts = createMultiLlmPrompts(feature, techStack);
  const results: MultiLlmResult[] = [];

  // 4개 LLM 호출을 병렬로 실행
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
        result,
        success,
        error,
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
        result,
        success,
        error,
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
        result,
        success,
        error,
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
        result,
        success,
        error,
        duration: Date.now() - taskStart
      });
    })()
  );

  // 모든 호출 대기
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
      if (bp.success) {
        output += `${bp.result}\n\n`;
      } else {
        output += `Error: ${bp.error}\n\n`;
      }
    }
  }

  // Security 섹션
  const security = results.filter(r => r.category === 'security');
  if (security.length > 0) {
    output += `### Security Advisories\n\n`;
    for (const sec of security) {
      const status = sec.success ? '✅' : '❌';
      output += `#### ${status} ${sec.provider.toUpperCase()} (${(sec.duration / 1000).toFixed(1)}s)\n`;
      if (sec.success) {
        output += `${sec.result}\n\n`;
      } else {
        output += `Error: ${sec.error}\n\n`;
      }
    }
  }

  return output;
}

/**
 * 통합 병렬 리서치 (Claude 에이전트 + Multi-LLM)
 * v2.5.0: GPT/Gemini가 가능하면 함께 실행
 */
export async function parallelResearchWithMultiLlm(args: ParallelResearchArgs & {
  feature: string;
  techStack: string[];
}): Promise<ToolResult> {
  const { feature, techStack, ...researchArgs } = args;
  const startTime = Date.now();

  // Claude 에이전트와 Multi-LLM을 병렬로 실행
  const [claudeResult, multiLlmResults] = await Promise.all([
    parallelResearch(researchArgs),
    executeMultiLlmResearch(feature, techStack).catch(e => {
      warnLog('[Multi-LLM] Research failed:', e);
      return [] as MultiLlmResult[];
    })
  ]);

  // 결과 병합
  const totalDuration = Date.now() - startTime;
  const multiLlmSuccess = multiLlmResults.filter(r => r.success).length;
  const multiLlmFailure = multiLlmResults.length - multiLlmSuccess;

  // Claude 결과 텍스트에 Multi-LLM 결과 추가
  let combinedText = claudeResult.content[0].text;
  if (multiLlmResults.length > 0) {
    combinedText += formatMultiLlmResults(multiLlmResults);
  }

  return {
    content: [{ type: 'text', text: combinedText }],
    results: (claudeResult as unknown as ParallelResearchResult).results || [],
    totalDuration,
    successCount: ((claudeResult as unknown as ParallelResearchResult).successCount || 0) + multiLlmSuccess,
    failureCount: ((claudeResult as unknown as ParallelResearchResult).failureCount || 0) + multiLlmFailure,
    multiLlm: {
      results: multiLlmResults,
      totalDuration: multiLlmResults.reduce((sum, r) => sum + r.duration, 0),
      successCount: multiLlmSuccess,
      failureCount: multiLlmFailure
    }
  } as ToolResult & ParallelResearchResult;
}
