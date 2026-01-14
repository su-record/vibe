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
  AgentMessage
} from './types.js';

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
  createResearchTasks
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
  return _parallelResearch({ tasks, projectPath });
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
