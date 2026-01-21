/**
 * SessionStore - 백그라운드 에이전트 세션 저장소
 * backgroundAgent.ts에서 추출 (v2.6.0)
 */

import {
  BackgroundAgentHandle,
  AgentResult,
  SessionInfo
} from './types.js';
import { ToolResult } from '../types/tool.js';

// 세션 데이터 타입
export interface SessionData {
  handle: BackgroundAgentHandle;
  resultPromise: Promise<AgentResult>;
  cancelController: AbortController;
  createdAt: number;
}

// TTL 설정
const SESSION_TTL = 60 * 60 * 1000; // 1시간
const SESSION_HISTORY_TTL = 24 * 60 * 60 * 1000; // 24시간
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10분

/**
 * SessionStore - 세션 저장 및 관리
 */
class SessionStoreImpl {
  private activeSessions = new Map<string, SessionData>();
  private sessionHistory: SessionInfo[] = [];
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  private cleanup(): void {
    const now = Date.now();

    // 활성 세션 정리
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.createdAt > SESSION_TTL) {
        if (session.handle.status === 'running') {
          session.cancelController.abort();
        }
        this.activeSessions.delete(sessionId);
      }
    }

    // 히스토리 정리
    const cutoff = now - SESSION_HISTORY_TTL;
    while (this.sessionHistory.length > 0 && this.sessionHistory[0].startTime < cutoff) {
      this.sessionHistory.shift();
    }
  }

  add(sessionId: string, data: SessionData): void {
    this.activeSessions.set(sessionId, data);
  }

  get(sessionId: string): SessionData | undefined {
    return this.activeSessions.get(sessionId);
  }

  delete(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  addToHistory(info: SessionInfo): void {
    this.sessionHistory.push(info);
  }

  findInHistory(sessionId: string): SessionInfo | undefined {
    return this.sessionHistory.find(s => s.sessionId === sessionId);
  }

  getActiveSessions(): SessionData[] {
    return Array.from(this.activeSessions.values());
  }

  getRecentHistory(limit: number): SessionInfo[] {
    return this.sessionHistory.slice(-limit).reverse();
  }
}

// 싱글톤 인스턴스
export const sessionStore = new SessionStoreImpl();

/**
 * 활성 세션 목록 조회
 */
export function listActiveSessions(): ToolResult {
  const sessions = sessionStore.getActiveSessions().map(s => ({
    sessionId: s.handle.sessionId,
    agentName: s.handle.agentName,
    status: s.handle.status,
    startTime: new Date(s.handle.startTime).toISOString(),
    runningFor: `${((Date.now() - s.handle.startTime) / 1000).toFixed(0)}s`
  }));

  if (sessions.length === 0) {
    return {
      content: [{ type: 'text', text: 'No active background agents' }]
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
  const recent = sessionStore.getRecentHistory(limit);

  if (recent.length === 0) {
    return {
      content: [{ type: 'text', text: 'No session history' }]
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
