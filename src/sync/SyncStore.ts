/**
 * SyncStore - Manage sync metadata
 * Phase 5: Sync & Portability
 *
 * Tracks last_synced, dirty flags, and change history.
 */

import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { SyncMetadata, SyncTarget, SyncConflict, HLC } from './types.js';
import { LogLevel } from '../daemon/types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const DEFAULT_DB_PATH = path.join(VIBE_DIR, 'sync.db');

export class SyncStore {
  private db: Database.Database;
  private logger: (level: LogLevel, message: string, data?: unknown) => void;
  private nodeId: string;

  constructor(
    logger: (level: LogLevel, message: string, data?: unknown) => void,
    dbPath?: string
  ) {
    this.logger = logger;
    this.nodeId = this.getOrCreateNodeId();

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

  /** Record a change for tracking */
  markDirty(target: SyncTarget, key: string, hash: string): void {
    const now = new Date().toISOString();
    const hlc = this.generateHLC();

    this.db.prepare(`
      INSERT INTO sync_metadata (target, key, last_modified_at, hlc, dirty, hash)
      VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(target, key) DO UPDATE SET
        last_modified_at = excluded.last_modified_at,
        hlc = excluded.hlc,
        dirty = 1,
        hash = excluded.hash
    `).run(target, key, now, hlc, hash);
  }

  /** Mark items as synced */
  markClean(target: SyncTarget, key?: string): void {
    if (key) {
      this.db.prepare(
        'UPDATE sync_metadata SET dirty = 0 WHERE target = ? AND key = ?'
      ).run(target, key);
    } else {
      this.db.prepare(
        'UPDATE sync_metadata SET dirty = 0 WHERE target = ?'
      ).run(target);
    }
  }

  /** Get dirty items for sync */
  getDirtyItems(target?: SyncTarget): SyncMetadata[] {
    const query = target
      ? 'SELECT * FROM sync_metadata WHERE dirty = 1 AND target = ?'
      : 'SELECT * FROM sync_metadata WHERE dirty = 1';

    const rows = target
      ? this.db.prepare(query).all(target)
      : this.db.prepare(query).all();

    return (rows as Record<string, unknown>[]).map(this.rowToMetadata);
  }

  /** Get metadata for a specific item */
  getMetadata(target: SyncTarget, key: string): SyncMetadata | undefined {
    const row = this.db.prepare(
      'SELECT * FROM sync_metadata WHERE target = ? AND key = ?'
    ).get(target, key) as Record<string, unknown> | undefined;

    return row ? this.rowToMetadata(row) : undefined;
  }

  /** Get all metadata for a target */
  getAllMetadata(target: SyncTarget): SyncMetadata[] {
    const rows = this.db.prepare(
      'SELECT * FROM sync_metadata WHERE target = ?'
    ).all(target) as Record<string, unknown>[];

    return rows.map(this.rowToMetadata);
  }

  /** Record last sync timestamp */
  recordSync(direction: 'push' | 'pull'): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO sync_history (direction, synced_at, status)
      VALUES (?, ?, 'success')
    `).run(direction, now);
  }

  /** Get last sync time */
  getLastSyncTime(): string | undefined {
    const row = this.db.prepare(
      'SELECT synced_at FROM sync_history ORDER BY synced_at DESC LIMIT 1'
    ).get() as Record<string, unknown> | undefined;

    return row?.synced_at as string | undefined;
  }

  /** Get pending change count */
  getPendingCount(): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM sync_metadata WHERE dirty = 1'
    ).get() as Record<string, unknown>;

    return row.count as number;
  }

  /** Save a conflict */
  saveConflict(conflict: Omit<SyncConflict, 'id' | 'resolved'>): string {
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO sync_conflicts (id, target, key, local_value, remote_value,
        local_modified_at, remote_modified_at, local_hlc, remote_hlc, resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      id, conflict.target, conflict.key,
      conflict.localValue, conflict.remoteValue,
      conflict.localModifiedAt, conflict.remoteModifiedAt,
      conflict.localHlc, conflict.remoteHlc
    );

    return id;
  }

  /** Get unresolved conflicts */
  getConflicts(): SyncConflict[] {
    const rows = this.db.prepare(
      'SELECT * FROM sync_conflicts WHERE resolved = 0'
    ).all() as Record<string, unknown>[];

    return rows.map(this.rowToConflict);
  }

  /** Resolve a conflict */
  resolveConflict(id: string, resolution: 'local' | 'remote'): void {
    this.db.prepare(
      'UPDATE sync_conflicts SET resolved = 1, resolution = ? WHERE id = ?'
    ).run(resolution, id);
  }

  /** Generate HLC timestamp */
  generateHLC(): string {
    const hlc: HLC = {
      wallTime: Date.now(),
      counter: 0,
      nodeId: this.nodeId,
    };
    return `${hlc.wallTime}:${hlc.counter}:${hlc.nodeId}`;
  }

  /** Compare two HLC values */
  static compareHLC(a: string, b: string): number {
    const [aTime, aCounter] = a.split(':').map(Number);
    const [bTime, bCounter] = b.split(':').map(Number);

    if (aTime !== bTime) return aTime - bTime;
    return aCounter - bCounter;
  }

  close(): void {
    this.db.close();
  }

  // ========================================================================
  // Private
  // ========================================================================

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        target TEXT NOT NULL,
        key TEXT NOT NULL,
        last_modified_at TEXT NOT NULL,
        hlc TEXT NOT NULL,
        dirty INTEGER NOT NULL DEFAULT 0,
        hash TEXT NOT NULL,
        PRIMARY KEY (target, key)
      );

      CREATE TABLE IF NOT EXISTS sync_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        direction TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY,
        target TEXT NOT NULL,
        key TEXT NOT NULL,
        local_value TEXT,
        remote_value TEXT,
        local_modified_at TEXT,
        remote_modified_at TEXT,
        local_hlc TEXT,
        remote_hlc TEXT,
        resolved INTEGER NOT NULL DEFAULT 0,
        resolution TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sync_meta_dirty ON sync_metadata(dirty);
      CREATE INDEX IF NOT EXISTS idx_sync_history_at ON sync_history(synced_at);
    `);
  }

  private getOrCreateNodeId(): string {
    const nodeFile = path.join(VIBE_DIR, 'node-id');
    try {
      if (fs.existsSync(nodeFile)) {
        return fs.readFileSync(nodeFile, 'utf-8').trim();
      }
    } catch {
      // Generate new
    }

    const nodeId = crypto.randomUUID().slice(0, 8);
    try {
      if (!fs.existsSync(VIBE_DIR)) {
        fs.mkdirSync(VIBE_DIR, { recursive: true, mode: 0o700 });
      }
      fs.writeFileSync(nodeFile, nodeId);
    } catch {
      // Non-fatal
    }
    return nodeId;
  }

  private rowToMetadata(row: Record<string, unknown>): SyncMetadata {
    return {
      target: row.target as SyncTarget,
      key: row.key as string,
      lastModifiedAt: row.last_modified_at as string,
      hlc: row.hlc as string,
      dirty: Boolean(row.dirty),
      hash: row.hash as string,
    };
  }

  private rowToConflict(row: Record<string, unknown>): SyncConflict {
    return {
      id: row.id as string,
      target: row.target as SyncTarget,
      key: row.key as string,
      localValue: row.local_value as string,
      remoteValue: row.remote_value as string,
      localModifiedAt: row.local_modified_at as string,
      remoteModifiedAt: row.remote_modified_at as string,
      localHlc: row.local_hlc as string,
      remoteHlc: row.remote_hlc as string,
      resolved: Boolean(row.resolved),
      resolution: row.resolution as 'local' | 'remote' | undefined,
    };
  }
}
