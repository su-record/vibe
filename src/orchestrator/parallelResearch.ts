/**
 * Parallel Research - 병렬 리서치 에이전트 실행
 * Agent SDK의 query() 함수를 사용하여 여러 에이전트를 동시에 실행
 */

import {
  ParallelResearchArgs,
  ParallelResearchResult,
  ResearchTask,
  AgentResult,
  AgentMessage
} from './types.js';
import { ToolResult } from '../types/tool.js';

// Agent SDK 동적 import (설치되지 않았을 경우 폴백)
let agentSdkQuery: typeof import('@anthropic-ai/claude-agent-sdk').query | null = null;

async function getQueryFunction() {
  if (agentSdkQuery) return agentSdkQuery;

  try {
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    agentSdkQuery = sdk.query;
    return agentSdkQuery;
  } catch {
    return null;
  }
}

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
 * 단일 리서치 태스크 실행
 */
async function executeResearchTask(
  task: ResearchTask,
  projectPath: string,
  timeout: number
): Promise<AgentResult> {
  const startTime = Date.now();

  const query = await getQueryFunction();

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

    // Agent SDK query 실행
    const response = query({
      prompt: task.prompt,
      options: {
        model: 'claude-haiku-3-5', // 리서치는 빠른 모델 사용
        maxTurns: 3,
        allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
        cwd: projectPath
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
    maxConcurrency = 4,
    timeout = 60000 // 1분 기본 타임아웃
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
