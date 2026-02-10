import type Database from 'better-sqlite3';
import { uuidv7 } from 'uuidv7';
import type { EventBus } from './EventBus.js';
import type { AutonomyEventType, EventInput } from './schemas.js';

const POLL_INTERVAL_MS = 1000;
const MAX_RETRY = 3;
const BATCH_SIZE = 10;
const BACKOFF_MS = [1000, 5000, 10000];

interface OutboxRow {
  id: string;
  eventType: string;
  payload: string;
  status: string;
  retryCount: number;
  lastRetryAt: string | null;
  createdAt: string;
  publishedAt: string | null;
}

interface StorageProvider {
  getDatabase(): Database.Database;
}

export class EventOutbox {
  private readonly db: Database.Database;
  private readonly eventBus: EventBus;
  private readonly enqueueStmt: Database.Statement;
  private readonly markProcessingStmt: Database.Statement;
  private readonly markPublishedStmt: Database.Statement;
  private readonly markPendingRetryStmt: Database.Statement;
  private readonly markFailedStmt: Database.Statement;
  private readonly moveToDeadLetterStmt: Database.Statement;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  constructor(storage: StorageProvider, eventBus: EventBus) {
    this.db = storage.getDatabase();
    this.eventBus = eventBus;
    this.initTables();

    this.enqueueStmt = this.db.prepare(`
      INSERT INTO event_outbox (id, eventType, payload, status, retryCount, createdAt)
      VALUES (?, ?, ?, 'pending', 0, ?)
    `);
    this.markProcessingStmt = this.db.prepare(`
      UPDATE event_outbox SET status = 'processing' WHERE id = ? AND status = 'pending'
    `);
    this.markPublishedStmt = this.db.prepare(`
      UPDATE event_outbox SET status = 'published', publishedAt = ? WHERE id = ?
    `);
    this.markPendingRetryStmt = this.db.prepare(`
      UPDATE event_outbox SET status = 'pending', retryCount = retryCount + 1, lastRetryAt = ? WHERE id = ?
    `);
    this.markFailedStmt = this.db.prepare(`
      UPDATE event_outbox SET status = 'failed' WHERE id = ?
    `);
    this.moveToDeadLetterStmt = this.db.prepare(`
      INSERT INTO dead_letter_events (id, originalEventId, eventType, payload, error, retryCount, failedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_outbox (
        id TEXT PRIMARY KEY,
        eventType TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'published', 'failed')),
        retryCount INTEGER DEFAULT 0,
        lastRetryAt TEXT,
        createdAt TEXT NOT NULL,
        publishedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_status ON event_outbox(status, createdAt);

      CREATE TABLE IF NOT EXISTS dead_letter_events (
        id TEXT PRIMARY KEY,
        originalEventId TEXT NOT NULL,
        eventType TEXT NOT NULL,
        payload TEXT NOT NULL,
        error TEXT NOT NULL,
        retryCount INTEGER NOT NULL,
        failedAt TEXT NOT NULL,
        resolvedAt TEXT,
        status TEXT DEFAULT 'failed' CHECK(status IN ('failed', 'retried', 'discarded'))
      );
    `);
  }

  enqueue(event: { eventType: string; payload: Record<string, unknown> }): string {
    const id = uuidv7();
    this.enqueueStmt.run(id, event.eventType, JSON.stringify(event.payload), new Date().toISOString());
    return id;
  }

  start(): void {
    this.recoverProcessing();
    this.intervalId = setInterval(() => {
      if (!this.processing) {
        this.processOutbox();
      }
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  processOutbox(): void {
    this.processing = true;
    try {
      const pending = this.db
        .prepare(
          `SELECT * FROM event_outbox WHERE status = 'pending' ORDER BY createdAt ASC LIMIT ?`,
        )
        .all(BATCH_SIZE) as OutboxRow[];

      for (const row of pending) {
        if (row.retryCount > 0 && row.lastRetryAt) {
          const backoff = BACKOFF_MS[Math.min(row.retryCount - 1, BACKOFF_MS.length - 1)];
          const elapsed = Date.now() - new Date(row.lastRetryAt).getTime();
          if (elapsed < backoff) continue;
        }
        this.processOne(row);
      }
    } finally {
      this.processing = false;
    }
  }

  getPendingCount(): number {
    return (
      this.db
        .prepare(`SELECT COUNT(*) as count FROM event_outbox WHERE status = 'pending'`)
        .get() as { count: number }
    ).count;
  }

  getDeadLetterCount(): number {
    return (
      this.db
        .prepare(`SELECT COUNT(*) as count FROM dead_letter_events WHERE status = 'failed'`)
        .get() as { count: number }
    ).count;
  }

  private processOne(row: OutboxRow): void {
    const changed = this.markProcessingStmt.run(row.id);
    if (changed.changes === 0) return;

    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      this.eventBus.emitIdempotent(
        row.id,
        row.eventType as AutonomyEventType,
        payload as EventInput<AutonomyEventType>,
      );
      const syncErrors = this.eventBus.getLastSyncErrors();
      if (syncErrors.length > 0) {
        throw syncErrors[0];
      }
      this.markPublishedStmt.run(new Date().toISOString(), row.id);
    } catch (err: unknown) {
      const now = new Date().toISOString();
      const newRetryCount = row.retryCount + 1;

      if (newRetryCount >= MAX_RETRY) {
        this.db.transaction(() => {
          this.markFailedStmt.run(row.id);
          this.moveToDeadLetterStmt.run(
            uuidv7(),
            row.id,
            row.eventType,
            row.payload,
            err instanceof Error ? err.message : String(err),
            newRetryCount,
            now,
          );
        })();
        process.stderr.write(
          `[EventOutbox] Event ${row.id} moved to dead letter after ${newRetryCount} retries\n`,
        );
      } else {
        this.markPendingRetryStmt.run(now, row.id);
      }
    }
  }

  private recoverProcessing(): void {
    this.db
      .prepare(`UPDATE event_outbox SET status = 'pending' WHERE status = 'processing'`)
      .run();
  }
}
