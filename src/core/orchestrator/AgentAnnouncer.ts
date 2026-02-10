/**
 * AgentAnnouncer - 에이전트 실행 이벤트 통보 + 통계 수집
 * EventEmitter 기반, in-memory only
 */

import { EventEmitter } from 'events';

// ============================================
// Event Types
// ============================================

export interface AgentStartEvent {
  taskId: string;
  agentName: string;
  model: string;
  prompt: string;        // 200자 절삭
  timestamp: number;
}

export interface AgentCompleteEvent {
  taskId: string;
  agentName: string;
  success: boolean;
  duration: number;
  model: string;
  resultSummary: string; // 500자 절삭
  timestamp: number;
}

export interface AgentErrorEvent {
  taskId: string;
  agentName: string;
  error: string;
  retryable: boolean;
  duration: number;
  timestamp: number;
}

export interface AgentStats {
  totalLaunched: number;
  totalCompleted: number;
  totalFailed: number;
  totalDuration: number;
  avgDuration: number;
  byModel: Record<string, { count: number; totalDuration: number }>;
  byAgent: Record<string, { count: number; successRate: number }>;
}

type AnnounceEvent = AgentStartEvent | AgentCompleteEvent | AgentErrorEvent;

// ============================================
// AgentAnnouncer
// ============================================

const MAX_HISTORY = 100;

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

export class AgentAnnouncer extends EventEmitter {
  private history: AnnounceEvent[] = [];
  private stats: AgentStats = this.createEmptyStats();

  constructor() {
    super();
    this.setMaxListeners(20);
  }

  announceStart(event: AgentStartEvent): void {
    event.prompt = truncate(event.prompt, 200);
    event.timestamp = event.timestamp || Date.now();

    this.stats.totalLaunched++;
    this.updateModelStats(event.model, 0);
    this.pushHistory(event);
    this.emit('agent-start', event);
  }

  announceComplete(event: AgentCompleteEvent): void {
    event.resultSummary = truncate(event.resultSummary, 500);
    event.timestamp = event.timestamp || Date.now();

    if (event.success) {
      this.stats.totalCompleted++;
    } else {
      this.stats.totalFailed++;
    }
    this.stats.totalDuration += event.duration;
    const finishedCount = this.stats.totalCompleted + this.stats.totalFailed;
    this.stats.avgDuration = finishedCount > 0
      ? this.stats.totalDuration / finishedCount
      : 0;

    this.updateModelStats(event.model, event.duration);
    this.updateAgentStats(event.agentName, event.success);
    this.pushHistory(event);
    this.emit('agent-complete', event);
  }

  announceError(event: AgentErrorEvent): void {
    event.timestamp = event.timestamp || Date.now();

    this.stats.totalFailed++;
    this.stats.totalDuration += event.duration;
    const finishedCount = this.stats.totalCompleted + this.stats.totalFailed;
    this.stats.avgDuration = finishedCount > 0
      ? this.stats.totalDuration / finishedCount
      : 0;

    this.pushHistory(event);
    this.emit('agent-error', event);
  }

  getStats(): AgentStats {
    return { ...this.stats };
  }

  getRecentHistory(limit: number = 20): AnnounceEvent[] {
    return this.history.slice(-limit);
  }

  resetStats(): void {
    this.stats = this.createEmptyStats();
    this.history = [];
  }

  formatStatusLine(event: AnnounceEvent): string {
    if ('success' in event && 'resultSummary' in event) {
      const e = event as AgentCompleteEvent;
      const icon = e.success ? 'OK' : 'FAIL';
      return `[${icon}] ${e.agentName} (${e.model}) ${e.duration}ms`;
    }
    if ('error' in event && 'retryable' in event) {
      const e = event as AgentErrorEvent;
      return `[ERR] ${e.agentName} ${e.duration}ms: ${truncate(e.error, 80)}`;
    }
    const e = event as AgentStartEvent;
    return `[START] ${e.agentName} (${e.model})`;
  }

  // ============================================
  // Private
  // ============================================

  private pushHistory(event: AnnounceEvent): void {
    this.history.push(event);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  private updateModelStats(model: string, duration: number): void {
    if (!this.stats.byModel[model]) {
      this.stats.byModel[model] = { count: 0, totalDuration: 0 };
    }
    this.stats.byModel[model].count++;
    this.stats.byModel[model].totalDuration += duration;
  }

  private updateAgentStats(agentName: string, success: boolean): void {
    if (!this.stats.byAgent[agentName]) {
      this.stats.byAgent[agentName] = { count: 0, successRate: 0 };
    }
    const agent = this.stats.byAgent[agentName];
    agent.count++;
    // Recalculate success rate (approximate based on running total)
    if (success) {
      agent.successRate = agent.successRate + (1 - agent.successRate) / agent.count;
    } else {
      agent.successRate = agent.successRate - agent.successRate / agent.count;
    }
  }

  private createEmptyStats(): AgentStats {
    return {
      totalLaunched: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalDuration: 0,
      avgDuration: 0,
      byModel: {},
      byAgent: {},
    };
  }
}

// 싱글톤
export const agentAnnouncer = new AgentAnnouncer();
