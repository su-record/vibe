import type Database from 'better-sqlite3';
import { uuidv7 } from 'uuidv7';
import type { RiskLevel, OutcomeType } from './schemas.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const SENSITIVE_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\b(sk-[a-zA-Z0-9]{20,})\b/g, '[REDACTED:API_KEY]'],
  [/\b(key-[a-zA-Z0-9]{20,})\b/g, '[REDACTED:API_KEY]'],
  [/Bearer\s+[a-zA-Z0-9._\-]+/gi, 'Bearer [REDACTED]'],
  [/("?password"?\s*[:=]\s*)"[^"]*"/gi, '$1"[REDACTED]"'],
  [/("?secret"?\s*[:=]\s*)"[^"]*"/gi, '$1"[REDACTED]"'],
  [/("?token"?\s*[:=]\s*)"[^"]*"/gi, '$1"[REDACTED]"'],
];

export interface AuditEventRow {
  id: string;
  correlationId: string;
  causationId: string | null;
  eventType: string;
  agentId: string | null;
  actionType: string | null;
  riskLevel: string | null;
  payload: string;
  outcome: string | null;
  createdAt: string;
}

export interface AuditQueryFilters {
  agentId?: string;
  eventType?: string;
  riskLevel?: RiskLevel;
  outcome?: OutcomeType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEvents: number;
  byEventType: Record<string, number>;
  byRiskLevel: Record<string, number>;
  blockedCount: number;
  blockedRate: number;
}

export interface AuditRecordInput {
  correlationId: string;
  causationId?: string;
  eventType: string;
  agentId?: string;
  actionType?: string;
  riskLevel?: string;
  payload: Record<string, unknown>;
  outcome?: string;
}

interface StorageProvider {
  getDatabase(): Database.Database;
}

export class AuditStore {
  private readonly db: Database.Database;
  private readonly insertStmt: Database.Statement;
  private fts5Available = false;

  constructor(storage: StorageProvider) {
    this.db = storage.getDatabase();
    this.initTables();
    this.insertStmt = this.db.prepare(`
      INSERT INTO audit_events
        (id, correlationId, causationId, eventType, agentId, actionType, riskLevel, payload, outcome, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        correlationId TEXT NOT NULL,
        causationId TEXT,
        eventType TEXT NOT NULL,
        agentId TEXT,
        actionType TEXT,
        riskLevel TEXT,
        payload TEXT NOT NULL,
        outcome TEXT CHECK(outcome IS NULL OR outcome IN ('allowed', 'blocked', 'pending', 'expired')),
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_agent_time ON audit_events(agentId, createdAt);
      CREATE INDEX IF NOT EXISTS idx_audit_type_time ON audit_events(eventType, createdAt);
      CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_events(correlationId);
    `);

    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS audit_events_fts USING fts5(
          eventType, agentId, payload,
          content='audit_events', content_rowid='rowid'
        );
      `);
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS audit_events_fts_ai AFTER INSERT ON audit_events BEGIN
          INSERT INTO audit_events_fts(rowid, eventType, agentId, payload)
          VALUES (new.rowid, new.eventType, new.agentId, new.payload);
        END;
      `);
      this.fts5Available = true;
    } catch {
      this.fts5Available = false;
    }

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS prevent_audit_update
        BEFORE UPDATE ON audit_events
        BEGIN SELECT RAISE(ABORT, 'Audit logs are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
        BEFORE DELETE ON audit_events
        BEGIN SELECT RAISE(ABORT, 'Audit logs are immutable'); END;
    `);
  }

  static redactSensitive(payload: string): string {
    let redacted = payload;
    for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
      redacted = redacted.replace(new RegExp(pattern.source, pattern.flags), replacement);
    }
    return redacted;
  }

  record(event: AuditRecordInput): string {
    const id = uuidv7();
    const payloadStr = AuditStore.redactSensitive(JSON.stringify(event.payload));
    this.insertStmt.run(
      id,
      event.correlationId,
      event.causationId ?? null,
      event.eventType,
      event.agentId ?? null,
      event.actionType ?? null,
      event.riskLevel ?? null,
      payloadStr,
      event.outcome ?? null,
      new Date().toISOString(),
    );
    return id;
  }

  recordBatch(events: AuditRecordInput[]): string[] {
    const ids: string[] = [];
    const batchInsert = this.db.transaction(() => {
      for (const event of events) {
        ids.push(this.record(event));
      }
    });
    batchInsert();
    return ids;
  }

  query(filters: AuditQueryFilters): AuditEventRow[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.agentId) {
      conditions.push('agentId = ?');
      params.push(filters.agentId);
    }
    if (filters.eventType) {
      conditions.push('eventType = ?');
      params.push(filters.eventType);
    }
    if (filters.riskLevel) {
      conditions.push('riskLevel = ?');
      params.push(filters.riskLevel);
    }
    if (filters.outcome) {
      conditions.push('outcome = ?');
      params.push(filters.outcome);
    }
    if (filters.startDate) {
      conditions.push('createdAt >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('createdAt <= ?');
      params.push(filters.endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = filters.offset || 0;

    const sql = `SELECT * FROM audit_events ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return this.db.prepare(sql).all(...params) as AuditEventRow[];
  }

  getByCorrelation(correlationId: string): AuditEventRow[] {
    return this.db
      .prepare('SELECT * FROM audit_events WHERE correlationId = ? ORDER BY createdAt ASC')
      .all(correlationId) as AuditEventRow[];
  }

  getStats(dateRange?: { startDate: string; endDate: string }): AuditStats {
    const dateCondition = dateRange ? 'WHERE createdAt >= ? AND createdAt <= ?' : '';
    const dateParams = dateRange ? [dateRange.startDate, dateRange.endDate] : [];

    const total = (
      this.db
        .prepare(`SELECT COUNT(*) as count FROM audit_events ${dateCondition}`)
        .get(...dateParams) as { count: number }
    ).count;

    const byType = this.db
      .prepare(
        `SELECT eventType, COUNT(*) as count FROM audit_events ${dateCondition} GROUP BY eventType`,
      )
      .all(...dateParams) as Array<{ eventType: string; count: number }>;

    const riskCondition = dateRange
      ? 'WHERE createdAt >= ? AND createdAt <= ? AND riskLevel IS NOT NULL'
      : 'WHERE riskLevel IS NOT NULL';

    const byRisk = this.db
      .prepare(
        `SELECT riskLevel, COUNT(*) as count FROM audit_events ${riskCondition} GROUP BY riskLevel`,
      )
      .all(...dateParams) as Array<{ riskLevel: string; count: number }>;

    const blockedCondition = dateRange
      ? `WHERE createdAt >= ? AND createdAt <= ? AND outcome = 'blocked'`
      : `WHERE outcome = 'blocked'`;

    const blocked = (
      this.db
        .prepare(`SELECT COUNT(*) as count FROM audit_events ${blockedCondition}`)
        .get(...dateParams) as { count: number }
    ).count;

    return {
      totalEvents: total,
      byEventType: Object.fromEntries(byType.map((r) => [r.eventType, r.count])),
      byRiskLevel: Object.fromEntries(byRisk.map((r) => [r.riskLevel, r.count])),
      blockedCount: blocked,
      blockedRate: total > 0 ? blocked / total : 0,
    };
  }

  search(query: string, limit?: number): AuditEventRow[] {
    if (!this.fts5Available) return [];

    const sanitized = query
      .replace(/[*"()\-]/g, ' ')
      .replace(/\b(AND|OR|NOT)\b/gi, ' ')
      .trim();
    if (!sanitized) return [];

    const pageSize = Math.min(limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    try {
      return this.db
        .prepare(
          `SELECT a.* FROM audit_events a
           JOIN audit_events_fts f ON a.rowid = f.rowid
           WHERE audit_events_fts MATCH ?
           ORDER BY rank
           LIMIT ?`,
        )
        .all(sanitized, pageSize) as AuditEventRow[];
    } catch {
      return [];
    }
  }
}
