/**
 * VIBE Orchestrator - Agent SDK 기반 멀티 에이전트 오케스트레이션
 *
 * 사용법 (hooks에서):
 *   node -e "import('@su-record/vibe/orchestrator').then(o => o.parallelResearch({...})).then(console.log)"
 *
 * 사용법 (코드에서):
 *   import { VibeOrchestrator, parallelResearch } from '@su-record/vibe/orchestrator';
 */

// 타입 export
export type {
  AgentConfig,
  AgentResult,
  ResearchTask,
  ParallelResearchArgs,
  ParallelResearchResult,
  BackgroundAgentArgs,
  BackgroundAgentHandle,
  DiscoveredAgent,
  AgentDiscoveryArgs,
  SessionInfo,
  OrchestratorOptions,
  AgentMessage,
  // Smart Routing types
  TaskType,
  LLMProvider,
  SmartRouteRequest,
  SmartRouteResult,
  LLMAvailabilityCache,
  // Multi-LLM types (v2.5.0)
  MultiLlmResult,
  MultiLlmResearchResult
} from './types.js';

// Smart Routing constants
export { TASK_LLM_PRIORITY } from './types.js';

// Agent Discovery
export {
  discoverAgents,
  loadAgent,
  listAgentsByCategory
} from './agentDiscovery.js';

// Parallel Research
export {
  parallelResearch,
  researchFeature,
  createResearchTasks,
  // Multi-LLM Research (v2.5.0)
  parallelResearchWithMultiLlm,
  executeMultiLlmResearch,
  formatMultiLlmResults
} from './parallelResearch.js';

// Background Agent
export {
  launchBackgroundAgent,
  getBackgroundAgentResult,
  cancelBackgroundAgent,
  listActiveSessions,
  getSessionHistory,
  launchParallelAgents
} from './backgroundAgent.js';

// Main Orchestrator Class
export {
  VibeOrchestrator,
  getOrchestrator
} from './orchestrator.js';

// ============================================
// 간편 함수 (hooks에서 직접 호출용)
// ============================================

import { VibeOrchestrator } from './orchestrator.js';
import {
  parallelResearch as _parallelResearch,
  parallelResearchWithMultiLlm as _parallelResearchWithMultiLlm,
  createResearchTasks
} from './parallelResearch.js';
import {
  launchBackgroundAgent as _launchBackgroundAgent,
  getBackgroundAgentResult as _getBackgroundAgentResult,
  listActiveSessions,
  getSessionHistory
} from './backgroundAgent.js';
import { discoverAgents as _discoverAgents } from './agentDiscovery.js';
import { ToolResult } from '../types/tool.js';

/**
 * 기능 기반 병렬 리서치 (간편 API)
 * v2.5.0: Multi-LLM Research (Claude + GPT + Gemini) 지원
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.research('login feature', ['React', 'TypeScript'])).then(console.log)"
 */
export async function research(
  feature: string,
  techStack: string[] = [],
  projectPath: string = process.cwd()
): Promise<ToolResult> {
  const tasks = createResearchTasks(feature, techStack);
  // Multi-LLM 리서치 (Claude 에이전트 + GPT + Gemini 병렬 실행)
  return _parallelResearchWithMultiLlm({ tasks, projectPath, feature, techStack });
}

/**
 * 백그라운드 에이전트 시작 (간편 API)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.runAgent('Fix the login bug', 'bug-fixer')).then(console.log)"
 */
export async function runAgent(
  prompt: string,
  agentName?: string,
  projectPath: string = process.cwd()
): Promise<ToolResult> {
  return _launchBackgroundAgent({
    prompt,
    agentName: agentName || `agent-${Date.now()}`,
    projectPath
  });
}

/**
 * 에이전트 결과 조회 (간편 API)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.getResult('session-id')).then(console.log)"
 */
export async function getResult(sessionId: string): Promise<ToolResult> {
  return _getBackgroundAgentResult(sessionId);
}

/**
 * 에이전트 목록 조회 (간편 API)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.listAgents()).then(console.log)"
 */
export async function listAgents(
  category?: string,
  projectPath: string = process.cwd()
): Promise<ToolResult> {
  return _discoverAgents({ projectPath, category });
}

/**
 * 병렬 리뷰 실행 (간편 API)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.review(['src/api/user.ts'], ['TypeScript'])).then(console.log)"
 */
export async function review(
  filePaths: string[],
  techStack: string[] = [],
  projectPath: string = process.cwd()
): Promise<ToolResult> {
  const orchestrator = new VibeOrchestrator({ projectPath });
  const results = await orchestrator.runParallelReview(filePaths, techStack);

  // 결과 포맷팅
  let summary = `## Parallel Review Results\n\n`;
  summary += `**Files**: ${filePaths.length}\n`;
  summary += `**Reviewers**: ${results.length}\n\n`;

  const successCount = results.filter(r => r.success).length;
  summary += `**Success**: ${successCount}/${results.length}\n\n`;

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    summary += `### ${status} ${result.agentName}\n`;
    if (result.success) {
      summary += result.result.slice(0, 500);
      if (result.result.length > 500) summary += '...';
    } else {
      summary += `Error: ${result.error}`;
    }
    summary += '\n\n';
  }

  return {
    content: [{ type: 'text', text: summary }],
    results
  } as ToolResult & { results: typeof results };
}

/**
 * 오케스트레이터 상태 확인
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.status()).then(console.log)"
 */
export function status(): ToolResult {
  const active = listActiveSessions();
  const history = getSessionHistory(5);

  return {
    content: [{
      type: 'text',
      text: `## Orchestrator Status\n\n${active.content[0].text}\n\n${history.content[0].text}`
    }]
  };
}

// ============================================
// Multi-LLM Integration (GPT, Gemini)
// ============================================

import * as gptApi from '../lib/gpt-api.js';
import * as geminiApi from '../lib/gemini-api.js';

// ============================================
// GPT Integration (웹 검색, 아키텍처 분석)
// ============================================

/**
 * GPT 질문 (간편 API) - 웹 검색 없음, Gemini로 위임
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.gptSearch('React 19 features')).then(console.log)"
 * @deprecated GPT Codex API는 웹 검색을 지원하지 않습니다. geminiSearch를 사용하세요.
 */
export async function gptSearch(query: string): Promise<ToolResult> {
  // GPT Codex API는 웹 검색 미지원 → Gemini로 위임
  return geminiSearch(query);
}

/**
 * GPT 오케스트레이션 (간편 API)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.gpt('Analyze this architecture')).then(console.log)"
 */
export async function gpt(
  prompt: string,
  systemPrompt: string = 'You are a helpful assistant.'
): Promise<ToolResult> {
  try {
    const result = await gptApi.vibeGptOrchestrate(prompt, systemPrompt, { jsonMode: false });
    return {
      content: [{ type: 'text', text: result }],
      success: true
    } as ToolResult & { success: boolean };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `[GPT Error] ${(error as Error).message}` }],
      success: false
    } as ToolResult & { success: boolean };
  }
}

// ============================================
// Gemini Integration (UI/UX 분석, 코드 분석)
// ============================================

/**
 * Gemini 웹 검색 (간편 API)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.geminiSearch('React 19 features')).then(console.log)"
 */
export async function geminiSearch(query: string): Promise<ToolResult> {
  try {
    const result = await geminiApi.quickWebSearch(query);
    return {
      content: [{ type: 'text', text: result }],
      success: true
    } as ToolResult & { success: boolean };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `[Gemini Error] ${(error as Error).message}` }],
      success: false
    } as ToolResult & { success: boolean };
  }
}

/**
 * Gemini 오케스트레이션 (간편 API)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.gemini('Review this UI')).then(console.log)"
 */
export async function gemini(
  prompt: string,
  systemPrompt: string = 'You are a helpful assistant.'
): Promise<ToolResult> {
  try {
    const result = await geminiApi.vibeGeminiOrchestrate(prompt, systemPrompt, { jsonMode: false });
    return {
      content: [{ type: 'text', text: result }],
      success: true
    } as ToolResult & { success: boolean };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `[Gemini Error] ${(error as Error).message}` }],
      success: false
    } as ToolResult & { success: boolean };
  }
}

// ============================================
// Multi-LLM Orchestration
// ============================================

/**
 * 멀티 LLM 병렬 쿼리 (간편 API)
 * GPT, Gemini 동시 호출
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.multiLlm('Review this code')).then(console.log)"
 */
export async function multiLlm(
  prompt: string,
  options?: { useGpt?: boolean; useGemini?: boolean }
): Promise<ToolResult> {
  const orchestrator = new VibeOrchestrator();
  const results = await orchestrator.multiLlmQuery(prompt, options);

  let summary = '## Multi-LLM Results\n\n';

  if (results.gpt) {
    summary += `### GPT\n${results.gpt}\n\n`;
  }
  if (results.gemini) {
    summary += `### Gemini\n${results.gemini}\n\n`;
  }

  return {
    content: [{ type: 'text', text: summary }],
    results
  } as ToolResult & { results: typeof results };
}

/**
 * LLM 상태 확인 (간편 API)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.llmStatus()).then(console.log)"
 */
export async function llmStatus(): Promise<ToolResult> {
  const orchestrator = new VibeOrchestrator();
  const llmStatusResult = await orchestrator.checkLlmStatus();

  const gptIcon = llmStatusResult.gpt.available ? '✓' : '✗';
  const geminiIcon = llmStatusResult.gemini.available ? '✓' : '✗';

  let text = '## LLM Status\n\n';
  text += `- GPT: ${gptIcon} ${llmStatusResult.gpt.available ? 'Available' : 'Unavailable'}\n`;
  text += `- Gemini: ${geminiIcon} ${llmStatusResult.gemini.available ? 'Available' : 'Unavailable'}\n`;

  return {
    content: [{ type: 'text', text }],
    status: llmStatusResult
  } as ToolResult & { status: typeof llmStatusResult };
}

// ============================================
// Smart Routing (스마트 라우팅 with fallback)
// ============================================

import type { TaskType, SmartRouteResult } from './types.js';

/**
 * 스마트 라우팅 - 작업 유형에 따라 최적의 LLM 선택 + 자동 fallback
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.smartRoute({type:'architecture',prompt:'Review this design'})).then(console.log)"
 */
export async function smartRoute(
  type: TaskType,
  prompt: string,
  systemPrompt?: string
): Promise<ToolResult & { result: SmartRouteResult }> {
  const orchestrator = new VibeOrchestrator();
  const result = await orchestrator.smartRoute({ type, prompt, systemPrompt });

  const fallbackInfo = result.usedFallback
    ? ` (fallback from ${result.attemptedProviders.slice(0, -1).join(' → ')})`
    : '';

  return {
    content: [{
      type: 'text',
      text: `[${result.provider.toUpperCase()}${fallbackInfo}]\n\n${result.content}`
    }],
    result
  };
}

/**
 * 아키텍처 분석 with fallback (GPT → Gemini → Claude)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.smartArchitecture('Review this system design')).then(console.log)"
 */
export async function smartArchitecture(prompt: string): Promise<ToolResult & { result: SmartRouteResult }> {
  return smartRoute('architecture', prompt, 'You are a software architect. Analyze and review the architecture.');
}

/**
 * UI/UX 분석 with fallback (Gemini → GPT → Claude)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.smartUiux('Improve this form UX')).then(console.log)"
 */
export async function smartUiux(prompt: string): Promise<ToolResult & { result: SmartRouteResult }> {
  return smartRoute('uiux', prompt, 'You are a UI/UX expert. Analyze and provide feedback.');
}

/**
 * 코드 분석 with fallback (Gemini → GPT → Claude)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.smartCodeAnalysis('Analyze this code')).then(console.log)"
 */
export async function smartCodeAnalysis(prompt: string): Promise<ToolResult & { result: SmartRouteResult }> {
  return smartRoute('code-analysis', prompt, 'You are a code analysis expert. Review and analyze the code.');
}

/**
 * 디버깅 with fallback (GPT → Gemini → Claude)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.smartDebugging('Find bugs in this code')).then(console.log)"
 */
export async function smartDebugging(prompt: string): Promise<ToolResult & { result: SmartRouteResult }> {
  return smartRoute('debugging', prompt, 'You are a debugging expert. Find bugs and suggest fixes.');
}

/**
 * 웹 검색 with fallback (GPT → Gemini → Claude)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.smartWebSearch('React 19 new features')).then(console.log)"
 */
export async function smartWebSearch(query: string): Promise<ToolResult & { result: SmartRouteResult }> {
  return smartRoute('web-search', query, 'Search the web and provide relevant information.');
}

/**
 * 코드 생성 with fallback (Claude 직접)
 *
 * @example
 * node -e "import('@su-record/vibe/orchestrator').then(o => o.smartCodeGen('Create a React button component')).then(console.log)"
 */
export async function smartCodeGen(description: string, context?: string): Promise<ToolResult & { result: SmartRouteResult }> {
  const prompt = context ? `${description}\n\nContext:\n${context}` : description;
  return smartRoute('code-gen', prompt, 'Generate clean, well-documented code.');
}
