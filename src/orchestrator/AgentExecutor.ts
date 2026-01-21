/**
 * AgentExecutor - 백그라운드 에이전트 실행
 * backgroundAgent.ts에서 추출 (v2.6.0)
 */

import {
  BackgroundAgentArgs,
  BackgroundAgentHandle,
  AgentResult,
  AgentMessage
} from './types.js';
import { ToolResult } from '../types/tool.js';
import { getAgentSdkQuery } from '../lib/utils.js';
import { DEFAULT_MODELS, AGENT } from '../lib/constants.js';
import { sessionStore } from './SessionStore.js';

/**
 * 시뮬레이션 핸들 생성 (Agent SDK 미설치 시)
 */
function createSimulatedHandle(
  agentName: string,
  prompt: string
): BackgroundAgentHandle {
  return {
    sessionId: `simulated-${Date.now()}`,
    agentName,
    status: 'completed',
    startTime: Date.now(),
    getResult: async () => ({
      agentName,
      sessionId: `simulated-${Date.now()}`,
      result: `[Agent SDK not installed] Would execute: ${prompt.slice(0, 100)}...`,
      success: true,
      duration: 0
    }),
    cancel: () => {}
  };
}

/**
 * 백그라운드 에이전트 시작
 */
export async function launchBackgroundAgent(args: BackgroundAgentArgs): Promise<ToolResult> {
  const {
    prompt,
    agentName = `agent-${Date.now()}`,
    model = DEFAULT_MODELS.BACKGROUND,
    maxTurns = AGENT.MAX_TURNS,
    allowedTools = AGENT.DEFAULT_ALLOWED_TOOLS,
    projectPath = process.cwd(),
    onProgress
  } = args;

  const query = await getAgentSdkQuery();

  // Agent SDK가 없으면 시뮬레이션
  if (!query) {
    const handle = createSimulatedHandle(agentName, prompt);
    return {
      content: [{
        type: 'text',
        text: `Background agent "${agentName}" started (simulated)\nSession ID: ${handle.sessionId}\n\nNote: Install @anthropic-ai/claude-agent-sdk for real execution.`
      }],
      handle
    } as ToolResult & { handle: BackgroundAgentHandle };
  }

  const startTime = Date.now();
  const cancelController = new AbortController();
  let sessionId = '';
  let result = '';
  let status: BackgroundAgentHandle['status'] = 'running';

  // 결과 수집 Promise
  const resultPromise = new Promise<AgentResult>(async (resolve) => {
    try {
      const response = query({
        prompt,
        options: { model, maxTurns, allowedTools, cwd: projectPath }
      });

      for await (const message of response) {
        if (cancelController.signal.aborted) {
          status = 'cancelled';
          resolve({
            agentName, sessionId,
            result: 'Cancelled by user',
            success: false,
            error: 'Cancelled',
            duration: Date.now() - startTime
          });
          return;
        }

        const msg = message as AgentMessage;

        if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
          sessionId = msg.session_id;
        }

        if (msg.type === 'system' && msg.subtype === 'progress' && onProgress) {
          onProgress(msg.content || 'Processing...');
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

      status = 'completed';
      resolve({
        agentName, sessionId,
        result: result || 'No result',
        success: true,
        duration: Date.now() - startTime
      });
    } catch (error) {
      status = 'failed';
      resolve({
        agentName, sessionId,
        result: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  });

  // 핸들 생성
  const handle: BackgroundAgentHandle = {
    sessionId: sessionId || `pending-${Date.now()}`,
    agentName,
    status,
    startTime,
    getResult: () => resultPromise,
    cancel: () => {
      cancelController.abort();
      status = 'cancelled';
    }
  };

  // 세션 등록
  sessionStore.add(handle.sessionId, {
    handle, resultPromise, cancelController, createdAt: startTime
  });

  // 완료 시 히스토리에 추가
  resultPromise.then((agentResult) => {
    sessionStore.addToHistory({
      sessionId: agentResult.sessionId,
      agentName: agentResult.agentName,
      status: agentResult.success ? 'completed' : 'failed',
      startTime,
      endTime: Date.now(),
      prompt
    });
    sessionStore.delete(handle.sessionId);
  });

  return {
    content: [{
      type: 'text',
      text: `Background agent "${agentName}" started\nSession ID: ${handle.sessionId}\nModel: ${model}\nMax Turns: ${maxTurns}\n\nUse getBackgroundAgentResult("${handle.sessionId}") to check status.`
    }],
    handle
  } as ToolResult & { handle: BackgroundAgentHandle };
}

/**
 * 백그라운드 에이전트 결과 조회
 */
export async function getBackgroundAgentResult(sessionId: string): Promise<ToolResult> {
  const session = sessionStore.get(sessionId);

  if (!session) {
    const historical = sessionStore.findInHistory(sessionId);
    if (historical) {
      return {
        content: [{
          type: 'text',
          text: `Session "${sessionId}" completed at ${new Date(historical.endTime!).toISOString()}\nStatus: ${historical.status}`
        }]
      };
    }
    return {
      content: [{ type: 'text', text: `Session "${sessionId}" not found` }]
    };
  }

  if (session.handle.status === 'running') {
    return {
      content: [{
        type: 'text',
        text: `Session "${sessionId}" is still running\nAgent: ${session.handle.agentName}\nStarted: ${new Date(session.handle.startTime).toISOString()}`
      }]
    };
  }

  const result = await session.resultPromise;
  return {
    content: [{
      type: 'text',
      text: `Session "${sessionId}" ${result.success ? 'completed' : 'failed'}\nDuration: ${(result.duration / 1000).toFixed(1)}s\n\nResult:\n${result.result}`
    }],
    result
  } as ToolResult & { result: AgentResult };
}

/**
 * 백그라운드 에이전트 취소
 */
export function cancelBackgroundAgent(sessionId: string): ToolResult {
  const session = sessionStore.get(sessionId);

  if (!session) {
    return {
      content: [{ type: 'text', text: `Session "${sessionId}" not found or already completed` }]
    };
  }

  session.handle.cancel();
  return {
    content: [{ type: 'text', text: `Session "${sessionId}" cancelled` }]
  };
}

/**
 * 여러 백그라운드 에이전트 동시 실행
 */
export async function launchParallelAgents(
  agentConfigs: BackgroundAgentArgs[]
): Promise<ToolResult> {
  const handles: BackgroundAgentHandle[] = [];
  const errors: string[] = [];

  const results = await Promise.all(
    agentConfigs.map(async (config) => {
      try {
        const result = await launchBackgroundAgent(config);
        if ('handle' in result) {
          return (result as ToolResult & { handle: BackgroundAgentHandle }).handle;
        }
        return null;
      } catch (error) {
        errors.push(`${config.agentName}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    })
  );

  for (const result of results) {
    if (result) handles.push(result);
  }

  let summary = `## Launched ${handles.length} Background Agents\n\n`;
  for (const handle of handles) {
    summary += `- ${handle.agentName}: ${handle.sessionId}\n`;
  }

  if (errors.length > 0) {
    summary += `\n### Errors (${errors.length})\n`;
    for (const error of errors) {
      summary += `- ${error}\n`;
    }
  }

  return {
    content: [{ type: 'text', text: summary }],
    handles
  } as ToolResult & { handles: BackgroundAgentHandle[] };
}
