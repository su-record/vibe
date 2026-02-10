import type Database from 'better-sqlite3';
import { uuidv7 } from 'uuidv7';

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'expired', 'cancelled'] as const;
type ConfirmationStatus = (typeof VALID_STATUSES)[number];

const TERMINAL_STATUSES = new Set<ConfirmationStatus>(['approved', 'rejected', 'expired', 'cancelled']);

const VALID_TRANSITIONS: Record<string, Set<ConfirmationStatus>> = {
  pending: new Set(['approved', 'rejected', 'expired', 'cancelled']),
};

const DEFAULT_TIMEOUT_S = 300;
const MAX_TIMEOUT_S = 3600;

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid state transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export interface ConfirmationRow {
  id: string;
  correlationId: string;
  actionType: string;
  actionSummary: string;
  riskLevel: string;
  riskScore: number;
  riskFactors: string;
  status: string;
  channel: string | null;
  notifiedAt: string | null;
  respondedAt: string | null;
  ownerResponse: string | null;
  expiresAt: string;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface CreateConfirmationInput {
  correlationId: string;
  actionType: string;
  actionSummary: string;
  riskLevel: string;
  riskScore: number;
  riskFactors: string[];
  timeoutSeconds?: number;
  idempotencyKey?: string;
}

interface StorageProvider {
  getDatabase(): Database.Database;
}

export class ConfirmationStore {
  private readonly db: Database.Database;
  private readonly insertStmt: Database.Statement;
  private readonly resolveStmt: Database.Statement;
  private readonly getByIdStmt: Database.Statement;

  constructor(storage: StorageProvider) {
    this.db = storage.getDatabase();
    this.initTables();

    this.insertStmt = this.db.prepare(`
      INSERT INTO confirmations
        (id, correlationId, actionType, actionSummary, riskLevel, riskScore, riskFactors,
         status, expiresAt, idempotencyKey, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `);

    this.resolveStmt = this.db.prepare(`
      UPDATE confirmations SET status = ?, respondedAt = ?, ownerResponse = ?
      WHERE id = ? AND status = 'pending'
    `);

    this.getByIdStmt = this.db.prepare('SELECT * FROM confirmations WHERE id = ?');
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS confirmations (
        id TEXT PRIMARY KEY,
        correlationId TEXT NOT NULL,
        actionType TEXT NOT NULL,
        actionSummary TEXT NOT NULL,
        riskLevel TEXT NOT NULL,
        riskScore INTEGER NOT NULL,
        riskFactors TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
        channel TEXT,
        notifiedAt TEXT,
        respondedAt TEXT,
        ownerResponse TEXT,
        expiresAt TEXT NOT NULL,
        idempotencyKey TEXT UNIQUE,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_confirmation_status_expires ON confirmations(status, expiresAt);
      CREATE INDEX IF NOT EXISTS idx_confirmation_correlation ON confirmations(correlationId);
      CREATE INDEX IF NOT EXISTS idx_confirmation_idempotency ON confirmations(idempotencyKey);
    `);
  }

  create(input: CreateConfirmationInput): ConfirmationRow {
    if (input.idempotencyKey) {
      const existing = this.getByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }

    const id = uuidv7();
    const now = new Date().toISOString();
    const timeout = Math.min(input.timeoutSeconds ?? DEFAULT_TIMEOUT_S, MAX_TIMEOUT_S);
    const expiresAt = new Date(Date.now() + timeout * 1000).toISOString();

    this.insertStmt.run(
      id,
      input.correlationId,
      input.actionType,
      input.actionSummary,
      input.riskLevel,
      input.riskScore,
      JSON.stringify(input.riskFactors),
      expiresAt,
      input.idempotencyKey ?? null,
      now,
    );

    return this.getById(id)!;
  }

  resolve(id: string, status: ConfirmationStatus, response?: string): ConfirmationRow {
    const current = this.getById(id);
    if (!current) {
      throw new Error(`Confirmation not found: ${id}`);
    }

    const currentStatus = current.status as ConfirmationStatus;
    if (TERMINAL_STATUSES.has(currentStatus)) {
      throw new InvalidTransitionError(currentStatus, status);
    }

    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.has(status)) {
      throw new InvalidTransitionError(currentStatus, status);
    }

    const result = this.db.transaction(() => {
      const changes = this.resolveStmt.run(
        status,
        new Date().toISOString(),
        response ?? null,
        id,
      );
      if (changes.changes === 0) {
        throw new InvalidTransitionError(currentStatus, status);
      }
      return this.getById(id)!;
    })();

    return result;
  }

  getById(id: string): ConfirmationRow | null {
    return (this.getByIdStmt.get(id) as ConfirmationRow) ?? null;
  }

  getExpired(): ConfirmationRow[] {
    const now = new Date().toISOString();
    return this.db
      .prepare("SELECT * FROM confirmations WHERE status = 'pending' AND expiresAt <= ?")
      .all(now) as ConfirmationRow[];
  }

  getPending(): ConfirmationRow[] {
    return this.db
      .prepare("SELECT * FROM confirmations WHERE status = 'pending' ORDER BY createdAt ASC")
      .all() as ConfirmationRow[];
  }

  getByCorrelation(correlationId: string): ConfirmationRow[] {
    return this.db
      .prepare('SELECT * FROM confirmations WHERE correlationId = ? ORDER BY createdAt ASC')
      .all(correlationId) as ConfirmationRow[];
  }

  updateChannel(id: string, channel: string): void {
    this.db
      .prepare('UPDATE confirmations SET channel = ?, notifiedAt = ? WHERE id = ?')
      .run(channel, new Date().toISOString(), id);
  }

  getPendingCount(): number {
    return (
      this.db
        .prepare("SELECT COUNT(*) as count FROM confirmations WHERE status = 'pending'")
        .get() as { count: number }
    ).count;
  }

  private getByIdempotencyKey(key: string): ConfirmationRow | null {
    return (
      this.db
        .prepare('SELECT * FROM confirmations WHERE idempotencyKey = ?')
        .get(key) as ConfirmationRow
    ) ?? null;
  }
}
