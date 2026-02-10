/**
 * EvidenceStore - Record all policy evaluations and decisions
 * Phase 3: Policy Engine
 *
 * SQLite storage with auto-masking of sensitive data
 */

import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { EvidenceRecord, EvidenceEventType, EvaluationResult } from './types.js';
import { LogLevel } from '../../daemon/types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const DEFAULT_DB_PATH = path.join(VIBE_DIR, 'evidence.db');

/** Patterns for sensitive data masking */
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /AIza[a-zA-Z0-9_-]{35}/g,
  /ya29\.[a-zA-Z0-9_-]+/g,
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+/g,
  /nvapi-[a-zA-Z0-9_-]{20,}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /gho_[a-zA-Z0-9]{36}/g,
];

export class EvidenceStore {
  private db: Database.Database;
  private logger: (level: LogLevel, message: string, data?: unknown) => void;

  constructor(
    logger: (level: LogLevel, message: string, data?: unknown) => void,
    dbPath?: string
  ) {
    this.logger = logger;
    const resolvedPath = dbPath || DEFAULT_DB_PATH;
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.initTables();
  }

  /** Record a generic evidence entry */
  record(entry: Omit<EvidenceRecord, 'id' | 'createdAt'>): number {
    const payload = this.maskSensitive(entry.payload);
    const result = this.db.prepare(`
      INSERT INTO evidence (job_id, event_type, decision, payload, actor, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.jobId,
      entry.eventType,
      entry.decision,
      JSON.stringify(payload),
      entry.actor,
      entry.source,
      new Date().toISOString()
    );

    return Number(result.lastInsertRowid);
  }

  /** Record a policy evaluation */
  recordEvaluation(jobId: string, result: EvaluationResult): number {
    return this.record({
      jobId,
      eventType: 'policy_evaluation',
      decision: result.decision,
      payload: {
        riskLevel: result.riskLevel,
        requiresApproval: result.requiresApproval,
        reasons: result.reasons,
      },
      actor: 'policy_engine',
      source: 'system',
    });
  }

  /** Get evidence for a job */
  getByJob(jobId: string): EvidenceRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM evidence WHERE job_id = ? ORDER BY created_at ASC'
    ).all(jobId) as Record<string, unknown>[];

    return rows.map(this.rowToRecord);
  }

  /** Get evidence by event type */
  getByType(eventType: EvidenceEventType, limit: number = 50): EvidenceRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM evidence WHERE event_type = ? ORDER BY created_at DESC LIMIT ?'
    ).all(eventType, limit) as Record<string, unknown>[];

    return rows.map(this.rowToRecord);
  }

  /** Get recent evidence */
  getRecent(limit: number = 20): EvidenceRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM evidence ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as Record<string, unknown>[];

    return rows.map(this.rowToRecord);
  }

  /** Cleanup old evidence */
  cleanup(maxAgeDays: number = 30): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    const result = this.db.prepare(
      'DELETE FROM evidence WHERE created_at < ?'
    ).run(cutoff.toISOString());

    return result.changes;
  }

  close(): void {
    this.db.close();
  }

  // ========================================================================
  // Private
  // ========================================================================

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS evidence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        decision TEXT NOT NULL,
        payload TEXT,
        actor TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_evidence_job ON evidence(job_id);
      CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(event_type);
      CREATE INDEX IF NOT EXISTS idx_evidence_created ON evidence(created_at);
    `);
  }

  private maskSensitive(payload: Record<string, unknown>): Record<string, unknown> {
    const json = JSON.stringify(payload);
    let masked = json;

    for (const pattern of SENSITIVE_PATTERNS) {
      masked = masked.replace(pattern, '***REDACTED***');
    }

    try {
      return JSON.parse(masked);
    } catch {
      return payload;
    }
  }

  private rowToRecord(row: Record<string, unknown>): EvidenceRecord {
    return {
      id: row.id as number,
      jobId: row.job_id as string,
      eventType: row.event_type as EvidenceEventType,
      decision: row.decision as string,
      payload: row.payload ? JSON.parse(row.payload as string) : {},
      actor: row.actor as string,
      source: row.source as string,
      createdAt: row.created_at as string,
    };
  }
}
