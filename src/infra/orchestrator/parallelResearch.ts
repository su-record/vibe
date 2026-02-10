/**
 * Parallel Research - 병렬 리서치 에이전트 실행
 * Agent SDK의 query() 함수를 사용하여 여러 에이전트를 동시에 실행
 *
 * v2.6.0: MultiLlmResearch 모듈로 분리
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

// Multi-LLM Research (분리된 모듈)
import {
  executeMultiLlmResearch,
  formatMultiLlmResults
} from './MultiLlmResearch.js';

// Re-export for backward compatibility
export { executeMultiLlmResearch, formatMultiLlmResults };

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

  const possiblePaths = [
    path.join(projectPath, '.claude', 'agents', 'research', `${agentName}.md`),
    path.join(projectPath, 'agents', 'research', `${agentName}.md`),
    path.join(process.cwd(), 'agents', 'research', `${agentName}.md`)
  ];

  for (const filePath of possiblePaths) {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch { /* try next path */ }
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

    const agentContent = await loadAgentFile(task.name, projectPath);

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

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Research task timeout')), timeout);
    });

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
          if (textContent) result += textContent;
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
    const chunks: ResearchTask[][] = [];
    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      chunks.push(tasks.slice(i, i + maxConcurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(task => executeResearchTask(task, projectPath, timeout))
      );
      results.push(...chunkResults);
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    let summary = `## Parallel Research Results\n\n`;
    summary += `**Duration**: ${(totalDuration / 1000).toFixed(1)}s\n`;
    summary += `**Success**: ${successCount}/${results.length}\n\n`;

    for (const result of results) {
      const status = result.success ? '✅' : '❌';
      summary += `### ${status} ${result.agentName}\n`;
      summary += `Duration: ${(result.duration / 1000).toFixed(1)}s\n`;
      if (result.success) {
        const preview = result.result.length > 500
          ? result.result.slice(0, 500) + '...'
          : result.result;
        summary += `\n${preview}\n`;
      } else {
        summary += `Error: ${result.error}\n`;
      }
      summary += '\n---\n\n';
    }

    return {
      content: [{ type: 'text', text: summary }],
      results, totalDuration, successCount, failureCount
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

/**
 * 통합 병렬 리서치 (Claude 에이전트 + Multi-LLM)
 */
export async function parallelResearchWithMultiLlm(args: ParallelResearchArgs & {
  feature: string;
  techStack: string[];
}): Promise<ToolResult> {
  const { feature, techStack, ...researchArgs } = args;
  const startTime = Date.now();

  const [claudeResult, multiLlmResults] = await Promise.all([
    parallelResearch(researchArgs),
    executeMultiLlmResearch(feature, techStack).catch(e => {
      warnLog('[Multi-LLM] Research failed:', e);
      return [] as MultiLlmResult[];
    })
  ]);

  const totalDuration = Date.now() - startTime;
  const multiLlmSuccess = multiLlmResults.filter(r => r.success).length;
  const multiLlmFailure = multiLlmResults.length - multiLlmSuccess;

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
