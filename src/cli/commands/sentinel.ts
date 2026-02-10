/**
 * vibe sentinel CLI commands
 * Security Sentinel 관리 명령어
 */

import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getProjectRoot(): string {
  return process.cwd();
}

function getStoragePath(): string {
  return join(getProjectRoot(), '.claude', 'vibe');
}

function tryLoadStorage(): {
  getDatabase(): { prepare(sql: string): { all(...args: unknown[]): unknown[]; get(...args: unknown[]): unknown; run(...args: unknown[]): void } };
} | null {
  try {
    const dbPath = join(getStoragePath(), 'memory.db');
    if (!existsSync(dbPath)) return null;
    // Dynamic import to avoid compile-time dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    return { getDatabase: () => db };
  } catch {
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Commands
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function sentinelStatus(): void {
  const storage = tryLoadStorage();
  if (!storage) {
    console.log('Sentinel: No database found. Run a session first.');
    return;
  }
  const db = storage.getDatabase();

  const policyCount = (db.prepare('SELECT COUNT(*) as count FROM policies WHERE enabled = 1').get() as { count: number })?.count ?? 0;

  let pendingConfirmations = 0;
  try {
    pendingConfirmations = (db.prepare("SELECT COUNT(*) as count FROM confirmations WHERE status = 'pending'").get() as { count: number })?.count ?? 0;
  } catch {
    // Table may not exist yet
  }

  const last24h = new Date(Date.now() - 86_400_000).toISOString();
  let totalActions = 0;
  let allowedActions = 0;
  let blockedActions = 0;

  try {
    totalActions = (db.prepare('SELECT COUNT(*) as count FROM audit_events WHERE createdAt >= ?').get(last24h) as { count: number })?.count ?? 0;
    allowedActions = (db.prepare("SELECT COUNT(*) as count FROM audit_events WHERE createdAt >= ? AND outcome = 'allowed'").get(last24h) as { count: number })?.count ?? 0;
    blockedActions = (db.prepare("SELECT COUNT(*) as count FROM audit_events WHERE createdAt >= ? AND outcome = 'blocked'").get(last24h) as { count: number })?.count ?? 0;
  } catch {
    // Table may not exist
  }

  let pendingSuggestions = 0;
  try {
    pendingSuggestions = (db.prepare("SELECT COUNT(*) as count FROM suggestions WHERE status = 'pending'").get() as { count: number })?.count ?? 0;
  } catch {
    // Table may not exist
  }

  console.log(`
Security Sentinel Status
========================
  Policies:      ${policyCount} active
  Confirmations: ${pendingConfirmations} pending
  Suggestions:   ${pendingSuggestions} pending

  Last 24h:
    Total actions:   ${totalActions}
    Allowed:         ${allowedActions}
    Blocked:         ${blockedActions}
  `);
}

export function sentinelAudit(type?: string, risk?: string, days?: string, deadLetter?: boolean, retryId?: string, discardId?: string): void {
  const storage = tryLoadStorage();
  if (!storage) {
    console.log('No audit data found.');
    return;
  }
  const db = storage.getDatabase();

  if (deadLetter) {
    try {
      const rows = db.prepare('SELECT * FROM dead_letter_events ORDER BY failedAt DESC LIMIT 50').all() as Array<Record<string, unknown>>;
      if (rows.length === 0) {
        console.log('No dead letter events.');
        return;
      }
      console.log(`Dead Letter Events (${rows.length}):`);
      for (const row of rows) {
        console.log(`  [${row.id}] ${row.eventType} — retries: ${row.retryCount}, failed: ${row.failedAt}`);
      }
    } catch {
      console.log('Dead letter table not found.');
    }
    return;
  }

  if (retryId) {
    try {
      db.prepare("UPDATE event_outbox SET status = 'pending', retryCount = 0 WHERE id = ?").run(retryId);
      console.log(`Event ${retryId} re-queued for retry.`);
    } catch (err) {
      console.log(`Failed to retry: ${(err as Error).message}`);
    }
    return;
  }

  if (discardId) {
    try {
      db.prepare('DELETE FROM dead_letter_events WHERE id = ?').run(discardId);
      console.log(`Dead letter event ${discardId} discarded.`);
    } catch (err) {
      console.log(`Failed to discard: ${(err as Error).message}`);
    }
    return;
  }

  const daysNum = days ? parseInt(days, 10) : 7;
  const cutoff = new Date(Date.now() - daysNum * 86_400_000).toISOString();

  let query = 'SELECT * FROM audit_events WHERE createdAt >= ?';
  const params: unknown[] = [cutoff];

  if (type) {
    query += ' AND eventType = ?';
    params.push(type);
  }
  if (risk) {
    query += ' AND riskLevel = ?';
    params.push(risk.toUpperCase());
  }

  query += ' ORDER BY createdAt DESC LIMIT 50';

  try {
    const rows = db.prepare(query).all(...params) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      console.log('No audit events found.');
      return;
    }
    console.log(`Audit Events (${rows.length}):`);
    for (const row of rows) {
      const risk = row.riskLevel ?? '-';
      const outcome = row.outcome ?? '-';
      console.log(`  [${row.id}] ${row.eventType} | risk=${risk} | outcome=${outcome} | ${row.createdAt}`);
    }
  } catch (err) {
    console.log(`Query failed: ${(err as Error).message}`);
  }
}

export function sentinelApprove(id: string): void {
  if (!id) {
    console.log('Usage: vibe sentinel approve <confirmation-id>');
    return;
  }
  const storage = tryLoadStorage();
  if (!storage) {
    console.log('No database found.');
    return;
  }
  const db = storage.getDatabase();

  try {
    const row = db.prepare('SELECT * FROM confirmations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) {
      console.log(`Confirmation ${id} not found.`);
      return;
    }
    if (row.status !== 'pending') {
      console.log(`Confirmation ${id} is already ${row.status}.`);
      return;
    }
    db.prepare("UPDATE confirmations SET status = 'approved', ownerResponse = 'CLI approval', resolvedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
    console.log(`Confirmation ${id} approved.`);
  } catch (err) {
    console.log(`Failed: ${(err as Error).message}`);
  }
}

export function sentinelReject(id: string): void {
  if (!id) {
    console.log('Usage: vibe sentinel reject <confirmation-id>');
    return;
  }
  const storage = tryLoadStorage();
  if (!storage) {
    console.log('No database found.');
    return;
  }
  const db = storage.getDatabase();

  try {
    const row = db.prepare('SELECT * FROM confirmations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) {
      console.log(`Confirmation ${id} not found.`);
      return;
    }
    if (row.status !== 'pending') {
      console.log(`Confirmation ${id} is already ${row.status}.`);
      return;
    }
    db.prepare("UPDATE confirmations SET status = 'rejected', ownerResponse = 'CLI rejection', resolvedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
    console.log(`Confirmation ${id} rejected.`);
  } catch (err) {
    console.log(`Failed: ${(err as Error).message}`);
  }
}

export function sentinelPolicyList(): void {
  const storage = tryLoadStorage();
  if (!storage) {
    console.log('No policies found.');
    return;
  }
  const db = storage.getDatabase();

  try {
    const rows = db.prepare('SELECT name, description, action, priority, enabled FROM policies ORDER BY priority DESC').all() as Array<{
      name: string;
      description: string | null;
      action: string;
      priority: number;
      enabled: number;
    }>;
    if (rows.length === 0) {
      console.log('No policies configured.');
      return;
    }
    console.log('Sentinel Policies:');
    for (const row of rows) {
      const status = row.enabled ? 'ON' : 'OFF';
      console.log(`  [${status}] ${row.name} (priority: ${row.priority}, action: ${row.action})`);
      if (row.description) console.log(`        ${row.description}`);
    }
  } catch (err) {
    console.log(`Failed: ${(err as Error).message}`);
  }
}

export function sentinelPolicyToggle(name: string, enable: boolean): void {
  if (!name) {
    console.log(`Usage: vibe sentinel policy ${enable ? 'enable' : 'disable'} <policy-name>`);
    return;
  }
  const storage = tryLoadStorage();
  if (!storage) {
    console.log('No database found.');
    return;
  }
  const db = storage.getDatabase();

  try {
    const result = db.prepare('UPDATE policies SET enabled = ?, updatedAt = ? WHERE name = ?').run(enable ? 1 : 0, new Date().toISOString(), name) as unknown as { changes: number };
    if (result.changes === 0) {
      console.log(`Policy '${name}' not found.`);
    } else {
      console.log(`Policy '${name}' ${enable ? 'enabled' : 'disabled'}.`);
    }
  } catch (err) {
    console.log(`Failed: ${(err as Error).message}`);
  }
}

export function sentinelSuggestions(action?: string, id?: string): void {
  const storage = tryLoadStorage();
  if (!storage) {
    console.log('No suggestions found.');
    return;
  }
  const db = storage.getDatabase();

  if (action === 'accept' && id) {
    try {
      db.prepare("UPDATE suggestions SET status = 'accepted', resolvedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
      console.log(`Suggestion ${id} accepted.`);
    } catch (err) {
      console.log(`Failed: ${(err as Error).message}`);
    }
    return;
  }

  if (action === 'dismiss' && id) {
    try {
      db.prepare("UPDATE suggestions SET status = 'dismissed', resolvedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
      console.log(`Suggestion ${id} dismissed.`);
    } catch (err) {
      console.log(`Failed: ${(err as Error).message}`);
    }
    return;
  }

  // List pending suggestions
  try {
    const rows = db.prepare("SELECT id, type, title, priority, riskLevel FROM suggestions WHERE status = 'pending' ORDER BY priority ASC LIMIT 20").all() as Array<{
      id: string;
      type: string;
      title: string;
      priority: number;
      riskLevel: string;
    }>;
    if (rows.length === 0) {
      console.log('No pending suggestions.');
      return;
    }
    console.log(`Pending Suggestions (${rows.length}):`);
    for (const row of rows) {
      console.log(`  [P${row.priority}] ${row.type}: ${row.title} (risk: ${row.riskLevel}) — id: ${row.id}`);
    }
  } catch (err) {
    console.log(`Failed: ${(err as Error).message}`);
  }
}

export function sentinelHelp(): void {
  console.log(`
Sentinel Commands:
  vibe sentinel status                     Show sentinel status
  vibe sentinel audit [--type X] [--risk Y] [--days N]
                                           Query audit log
  vibe sentinel audit --dead-letter        List dead letter events
  vibe sentinel audit --retry <id>         Retry dead letter event
  vibe sentinel audit --discard <id>       Discard dead letter event
  vibe sentinel approve <id>               Approve confirmation
  vibe sentinel reject <id>                Reject confirmation
  vibe sentinel policy list                List policies
  vibe sentinel policy enable <name>       Enable policy
  vibe sentinel policy disable <name>      Disable policy
  vibe sentinel suggestions                List pending suggestions
  vibe sentinel suggestions accept <id>    Accept suggestion
  vibe sentinel suggestions dismiss <id>   Dismiss suggestion
  `);
}
