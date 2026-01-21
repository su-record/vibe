/**
 * Background Agent - 백그라운드 에이전트 관리
 */

import {
  BackgroundAgentArgs,
  BackgroundAgentHandle,
  AgentResult,
  AgentMessage,
  SessionInfo
} from './types.js';
import { ToolResult } from '../types/tool.js';
import { getAgentSdkQuery } from '../lib/utils.js';
import { DEFAULT_MODELS, AGENT } from '../lib/constants.js';

// 활성 세션 저장소
const activeSessions = new Map<string, {
  handle: BackgroundAgentHandle;
  resultPromise: Promise<AgentResult>;
  cancelController: AbortController;
  createdAt: number;
}>();

// 세션 히스토리 (완료된 세션 포함)
const sessionHistory: SessionInfo[] = [];

// TTL 설정 (기본 1시간)
const SESSION_TTL = 60 * 60 * 1000;
const SESSION_HISTORY_TTL = 24 * 60 * 60 * 1000; // 히스토리는 24시간
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10분마다 정리

// 세션 정리 함수
function cleanupExpiredSessions(): void {
  const now = Date.now();

  // 활성 세션 정리 (TTL 초과 + running 상태인 경우 취소)
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL) {
      if (session.handle.status === 'running') {
        session.cancelController.abort();
      }
      activeSessions.delete(sessionId);
    }
  }

  // 히스토리 정리 (24시간 초과)
  const cutoff = now - SESSION_HISTORY_TTL;
  while (sessionHistory.length > 0 && sessionHistory[0].startTime < cutoff) {
    sessionHistory.shift();
  }
}

// 정리 타이머 시작 (모듈 로드 시 자동 시작)
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupTimer(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL);
  // unref로 프로세스 종료를 막지 않음
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

// 모듈 로드 시 타이머 시작
startCleanupTimer();

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
    const handle: BackgroundAgentHandle = {
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
        options: {
          model,
          maxTurns,
          allowedTools,
          cwd: projectPath
        }
      });

      for await (const message of response) {
        // 취소 체크
        if (cancelController.signal.aborted) {
          status = 'cancelled';
          resolve({
            agentName,
            sessionId,
            result: 'Cancelled by user',
            success: false,
            error: 'Cancelled',
            duration: Date.now() - startTime
          });
          return;
        }

        const msg = message as AgentMessage;

        // 세션 ID 캡처
        if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
          sessionId = msg.session_id;
        }

        // 진행 상황 콜백
        if (msg.type === 'system' && msg.subtype === 'progress' && onProgress) {
          onProgress(msg.content || 'Processing...');
        }

        // 결과 수집
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

      status = 'completed';
      resolve({
        agentName,
        sessionId,
        result: result || 'No result',
        success: true,
        duration: Date.now() - startTime
      });

    } catch (error) {
      status = 'failed';
      resolve({
        agentName,
        sessionId,
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
  activeSessions.set(handle.sessionId, {
    handle,
    resultPromise,
    cancelController,
    createdAt: startTime
  });

  // 완료 시 히스토리에 추가
  resultPromise.then((result) => {
    sessionHistory.push({
      sessionId: result.sessionId,
      agentName: result.agentName,
      status: result.success ? 'completed' : 'failed',
      startTime,
      endTime: Date.now(),
      prompt
    });

    // 활성 세션에서 제거
    activeSessions.delete(handle.sessionId);
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
  const session = activeSessions.get(sessionId);

  if (!session) {
    // 히스토리에서 찾기
    const historical = sessionHistory.find(s => s.sessionId === sessionId);
    if (historical) {
      return {
        content: [{
          type: 'text',
          text: `Session "${sessionId}" completed at ${new Date(historical.endTime!).toISOString()}\nStatus: ${historical.status}`
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: `Session "${sessionId}" not found`
      }]
    };
  }

  // 진행 중인 세션
  if (session.handle.status === 'running') {
    return {
      content: [{
        type: 'text',
        text: `Session "${sessionId}" is still running\nAgent: ${session.handle.agentName}\nStarted: ${new Date(session.handle.startTime).toISOString()}`
      }]
    };
  }

  // 완료된 경우 결과 반환
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
  const session = activeSessions.get(sessionId);

  if (!session) {
    return {
      content: [{
        type: 'text',
        text: `Session "${sessionId}" not found or already completed`
      }]
    };
  }

  session.handle.cancel();

  return {
    content: [{
      type: 'text',
      text: `Session "${sessionId}" cancelled`
    }]
  };
}

/**
 * 활성 세션 목록
 */
export function listActiveSessions(): ToolResult {
  const sessions = Array.from(activeSessions.values()).map(s => ({
    sessionId: s.handle.sessionId,
    agentName: s.handle.agentName,
    status: s.handle.status,
    startTime: new Date(s.handle.startTime).toISOString(),
    runningFor: `${((Date.now() - s.handle.startTime) / 1000).toFixed(0)}s`
  }));

  if (sessions.length === 0) {
    return {
      content: [{
        type: 'text',
        text: 'No active background agents'
      }]
    };
  }

  let summary = `## Active Background Agents (${sessions.length})\n\n`;
  for (const session of sessions) {
    summary += `- **${session.agentName}** (${session.sessionId})\n`;
    summary += `  Status: ${session.status} | Running: ${session.runningFor}\n`;
  }

  return {
    content: [{ type: 'text', text: summary }],
    sessions
  } as ToolResult & { sessions: typeof sessions };
}

/**
 * 세션 히스토리 조회
 */
export function getSessionHistory(limit: number = 10): ToolResult {
  const recent = sessionHistory.slice(-limit).reverse();

  if (recent.length === 0) {
    return {
      content: [{
        type: 'text',
        text: 'No session history'
      }]
    };
  }

  let summary = `## Session History (last ${recent.length})\n\n`;
  for (const session of recent) {
    const duration = session.endTime
      ? `${((session.endTime - session.startTime) / 1000).toFixed(1)}s`
      : 'N/A';
    summary += `- **${session.agentName}** (${session.sessionId})\n`;
    summary += `  Status: ${session.status} | Duration: ${duration}\n`;
  }

  return {
    content: [{ type: 'text', text: summary }],
    history: recent
  } as ToolResult & { history: SessionInfo[] };
}

/**
 * 여러 백그라운드 에이전트 동시 실행
 */
export async function launchParallelAgents(
  agentConfigs: BackgroundAgentArgs[]
): Promise<ToolResult> {
  const handles: BackgroundAgentHandle[] = [];
  const errors: string[] = [];

  // 병렬로 에이전트 시작
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
    if (result) {
      handles.push(result);
    }
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
