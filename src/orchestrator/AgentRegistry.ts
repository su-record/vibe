/**
 * AgentRegistry - 에이전트 실행 이력 영속 저장 (SQLite)
 * 세션 재시작 시 복구, 통계, 크래시 감지
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ============================================
// Types
// ============================================

export interface AgentExecution {
  id: string;
  taskId: string;
  agentName: string;
  prompt?: string;
  result?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  model?: string;
  startedAt: number;
  completedAt?: number;
  sessionId?: string;
  error?: string;
  createdAt?: number;
}

export interface AgentHistoryItem {
  id: string;
  taskId: string;
  agentName: string;
  status: string;
  duration: number | null;
  model: string | null;
  startedAt: number;
  completedAt: number | null;
  error: string | null;
  createdAt: number;
}

export interface AgentStatsSummary {
  totalExecutions: number;
  completed: number;
  failed: number;
  successRate: number;
  avgDuration: number;
}

export interface GlobalAgentStats {
  total: number;
  completed: number;
  failed: number;
  successRate: number;
  avgDuration: number;
  byAgent: Record<string, AgentStatsSummary>;
  byModel: Record<string, { count: number; avgDuration: number }>;
}

// ============================================
// Constants
// ============================================

const MAX_PROMPT_LENGTH = 2000;
const MAX_RESULT_LENGTH = 2000;
const DEFAULT_CLEANUP_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Sensitive info masking
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /AIza[a-zA-Z0-9_-]{35}/g,
  /ya29\.[a-zA-Z0-9_-]+/g,
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+/g,
];

function maskSensitive(text: string): string {
  let masked = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern, '***REDACTED***');
  }
  return masked;
}

function truncateText(text: string | undefined, maxLen: number): string | undefined {
  if (!text) return text;
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

// ============================================
// AgentRegistry
// ============================================

export class AgentRegistry {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private updateCompleteStmt: Database.Statement;
  private updateFailStmt: Database.Statement;

  constructor(projectPath: string) {
    const dbDir = path.join(projectPath, '.claude', 'vibe', 'agents');
    const dbPath = path.join(dbDir, 'registry.db');

    // Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true, mode: 0o700 });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');

    // Set file permissions
    try {
      fs.chmodSync(dbPath, 0o600);
    } catch {
      // May fail on some platforms
    }

    this.initializeSchema();

    // Prepare statements
    this.insertStmt = this.db.prepare(`
      INSERT INTO agent_executions (id, task_id, agent_name, prompt, status, model, started_at, session_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.updateCompleteStmt = this.db.prepare(`
      UPDATE agent_executions SET status = 'completed', result = ?, duration = ?, completed_at = ? WHERE id = ?
    `);

    this.updateFailStmt = this.db.prepare(`
      UPDATE agent_executions SET status = 'failed', error = ?, duration = ?, completed_at = ? WHERE id = ?
    `);
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_executions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        prompt TEXT,
        result TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        duration INTEGER,
        model TEXT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        session_id TEXT,
        error TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_status ON agent_executions(status);
      CREATE INDEX IF NOT EXISTS idx_agent_name ON agent_executions(agent_name);
    `);
  }

  recordStart(execution: {
    id: string;
    taskId: string;
    agentName: string;
    prompt?: string;
    model?: string;
    sessionId?: string;
  }): string {
    const now = Date.now();
    this.insertStmt.run(
      execution.id,
      execution.taskId,
      execution.agentName,
      maskSensitive(truncateText(execution.prompt, MAX_PROMPT_LENGTH) ?? ''),
      'running',
      execution.model ?? null,
      now,
      execution.sessionId ?? null,
      now
    );
    return execution.id;
  }

  recordComplete(id: string, result: string, duration: number): void {
    this.updateCompleteStmt.run(
      maskSensitive(truncateText(result, MAX_RESULT_LENGTH) ?? ''),
      duration,
      Date.now(),
      id
    );
  }

  recordFailure(id: string, error: string, duration: number): void {
    const maskedError = maskSensitive(error);
    this.updateFailStmt.run(maskedError, duration, Date.now(), id);
  }

  getIncompleteExecutions(): AgentHistoryItem[] {
    const stmt = this.db.prepare(`
      SELECT id, task_id as taskId, agent_name as agentName, status, duration, model,
             started_at as startedAt, completed_at as completedAt, error, created_at as createdAt
      FROM agent_executions WHERE status = 'running' ORDER BY started_at ASC
    `);
    return stmt.all() as AgentHistoryItem[];
  }

  markOrphaned(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    const stmt = this.db.prepare(`
      UPDATE agent_executions SET status = 'failed', error = 'Orphaned (process crash)',
             completed_at = ? WHERE status = 'running' AND started_at < ?
    `);
    const result = stmt.run(Date.now(), cutoff);
    return result.changes;
  }

  getHistory(limit: number = 50, agentName?: string): AgentHistoryItem[] {
    if (agentName) {
      const stmt = this.db.prepare(`
        SELECT id, task_id as taskId, agent_name as agentName, status, duration, model,
               started_at as startedAt, completed_at as completedAt, error, created_at as createdAt
        FROM agent_executions WHERE agent_name = ? ORDER BY created_at DESC LIMIT ?
      `);
      return stmt.all(agentName, limit) as AgentHistoryItem[];
    }
    const stmt = this.db.prepare(`
      SELECT id, task_id as taskId, agent_name as agentName, status, duration, model,
             started_at as startedAt, completed_at as completedAt, error, created_at as createdAt
      FROM agent_executions ORDER BY created_at DESC LIMIT ?
    `);
    return stmt.all(limit) as AgentHistoryItem[];
  }

  getAgentStats(agentName: string): AgentStatsSummary {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
             AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avgDuration
      FROM agent_executions WHERE agent_name = ?
    `);
    const row = stmt.get(agentName) as { total: number; completed: number; failed: number; avgDuration: number | null };
    return {
      totalExecutions: row.total,
      completed: row.completed,
      failed: row.failed,
      successRate: row.total > 0 ? row.completed / row.total : 0,
      avgDuration: row.avgDuration ?? 0,
    };
  }

  getGlobalStats(): GlobalAgentStats {
    // Overall stats
    const overallStmt = this.db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
             AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avgDuration
      FROM agent_executions
    `);
    const overall = overallStmt.get() as { total: number; completed: number; failed: number; avgDuration: number | null };

    // By agent
    const byAgentStmt = this.db.prepare(`
      SELECT agent_name as agentName, COUNT(*) as total,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
             AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avgDuration
      FROM agent_executions GROUP BY agent_name
    `);
    const agentRows = byAgentStmt.all() as Array<{ agentName: string; total: number; completed: number; failed: number; avgDuration: number | null }>;
    const byAgent: Record<string, AgentStatsSummary> = {};
    for (const row of agentRows) {
      byAgent[row.agentName] = {
        totalExecutions: row.total,
        completed: row.completed,
        failed: row.failed,
        successRate: row.total > 0 ? row.completed / row.total : 0,
        avgDuration: row.avgDuration ?? 0,
      };
    }

    // By model
    const byModelStmt = this.db.prepare(`
      SELECT model, COUNT(*) as count,
             AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avgDuration
      FROM agent_executions WHERE model IS NOT NULL GROUP BY model
    `);
    const modelRows = byModelStmt.all() as Array<{ model: string; count: number; avgDuration: number | null }>;
    const byModel: Record<string, { count: number; avgDuration: number }> = {};
    for (const row of modelRows) {
      byModel[row.model] = { count: row.count, avgDuration: row.avgDuration ?? 0 };
    }

    return {
      total: overall.total,
      completed: overall.completed,
      failed: overall.failed,
      successRate: overall.total > 0 ? overall.completed / overall.total : 0,
      avgDuration: overall.avgDuration ?? 0,
      byAgent,
      byModel,
    };
  }

  cleanup(ttlMs: number = DEFAULT_CLEANUP_TTL_MS): number {
    const cutoff = Date.now() - ttlMs;
    const stmt = this.db.prepare(`
      DELETE FROM agent_executions
      WHERE (status = 'completed' OR status = 'failed') AND completed_at < ?
    `);
    const result = stmt.run(cutoff);
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}
