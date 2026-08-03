/**
 * vibe sentinel CLI commands
 * Security Sentinel 관리 명령어
 */
import { join } from 'path';
import { existsSync } from 'fs';
import { log } from '../utils.js';
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getProjectRoot() {
    return process.cwd();
}
function getStoragePath() {
    return join(getProjectRoot(), '.claude', 'vibe');
}
function tryLoadStorage() {
    try {
        const dbPath = join(getStoragePath(), 'memory.db');
        if (!existsSync(dbPath))
            return null;
        // Dynamic import to avoid compile-time dependency
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database = require('better-sqlite3');
        const db = new Database(dbPath, { readonly: true });
        return { getDatabase: () => db };
    }
    catch {
        return null;
    }
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Commands
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function sentinelStatus() {
    const storage = tryLoadStorage();
    if (!storage) {
        log('Sentinel: No database found. Run a session first.');
        return;
    }
    const db = storage.getDatabase();
    const policyCount = db.prepare('SELECT COUNT(*) as count FROM policies WHERE enabled = 1').get()?.count ?? 0;
    let pendingConfirmations = 0;
    try {
        pendingConfirmations = db.prepare("SELECT COUNT(*) as count FROM confirmations WHERE status = 'pending'").get()?.count ?? 0;
    }
    catch {
        // Table may not exist yet
    }
    const last24h = new Date(Date.now() - 86_400_000).toISOString();
    let totalActions = 0;
    let allowedActions = 0;
    let blockedActions = 0;
    try {
        totalActions = db.prepare('SELECT COUNT(*) as count FROM audit_events WHERE createdAt >= ?').get(last24h)?.count ?? 0;
        allowedActions = db.prepare("SELECT COUNT(*) as count FROM audit_events WHERE createdAt >= ? AND outcome = 'allowed'").get(last24h)?.count ?? 0;
        blockedActions = db.prepare("SELECT COUNT(*) as count FROM audit_events WHERE createdAt >= ? AND outcome = 'blocked'").get(last24h)?.count ?? 0;
    }
    catch {
        // Table may not exist
    }
    let pendingSuggestions = 0;
    try {
        pendingSuggestions = db.prepare("SELECT COUNT(*) as count FROM suggestions WHERE status = 'pending'").get()?.count ?? 0;
    }
    catch {
        // Table may not exist
    }
    log(`
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
export function sentinelAudit(options = {}) {
    const { type, risk, days, deadLetter, retryId, discardId } = options;
    const storage = tryLoadStorage();
    if (!storage) {
        log('No audit data found.');
        return;
    }
    const db = storage.getDatabase();
    if (deadLetter) {
        try {
            const rows = db.prepare('SELECT * FROM dead_letter_events ORDER BY failedAt DESC LIMIT 50').all();
            if (rows.length === 0) {
                log('No dead letter events.');
                return;
            }
            log(`Dead Letter Events (${rows.length}):`);
            for (const row of rows) {
                log(`  [${row.id}] ${row.eventType} — retries: ${row.retryCount}, failed: ${row.failedAt}`);
            }
        }
        catch {
            log('Dead letter table not found.');
        }
        return;
    }
    if (retryId) {
        try {
            db.prepare("UPDATE event_outbox SET status = 'pending', retryCount = 0 WHERE id = ?").run(retryId);
            log(`Event ${retryId} re-queued for retry.`);
        }
        catch (err) {
            log(`Failed to retry: ${err.message}`);
        }
        return;
    }
    if (discardId) {
        try {
            db.prepare('DELETE FROM dead_letter_events WHERE id = ?').run(discardId);
            log(`Dead letter event ${discardId} discarded.`);
        }
        catch (err) {
            log(`Failed to discard: ${err.message}`);
        }
        return;
    }
    const daysNum = days ? parseInt(days, 10) : 7;
    const cutoff = new Date(Date.now() - daysNum * 86_400_000).toISOString();
    let query = 'SELECT * FROM audit_events WHERE createdAt >= ?';
    const params = [cutoff];
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
        const rows = db.prepare(query).all(...params);
        if (rows.length === 0) {
            log('No audit events found.');
            return;
        }
        log(`Audit Events (${rows.length}):`);
        for (const row of rows) {
            const risk = row.riskLevel ?? '-';
            const outcome = row.outcome ?? '-';
            log(`  [${row.id}] ${row.eventType} | risk=${risk} | outcome=${outcome} | ${row.createdAt}`);
        }
    }
    catch (err) {
        log(`Query failed: ${err.message}`);
    }
}
export function sentinelApprove(id) {
    if (!id) {
        log('Usage: vibe sentinel approve <confirmation-id>');
        return;
    }
    const storage = tryLoadStorage();
    if (!storage) {
        log('No database found.');
        return;
    }
    const db = storage.getDatabase();
    try {
        const row = db.prepare('SELECT * FROM confirmations WHERE id = ?').get(id);
        if (!row) {
            log(`Confirmation ${id} not found.`);
            return;
        }
        if (row.status !== 'pending') {
            log(`Confirmation ${id} is already ${row.status}.`);
            return;
        }
        db.prepare("UPDATE confirmations SET status = 'approved', ownerResponse = 'CLI approval', resolvedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
        log(`Confirmation ${id} approved.`);
    }
    catch (err) {
        log(`Failed: ${err.message}`);
    }
}
export function sentinelReject(id) {
    if (!id) {
        log('Usage: vibe sentinel reject <confirmation-id>');
        return;
    }
    const storage = tryLoadStorage();
    if (!storage) {
        log('No database found.');
        return;
    }
    const db = storage.getDatabase();
    try {
        const row = db.prepare('SELECT * FROM confirmations WHERE id = ?').get(id);
        if (!row) {
            log(`Confirmation ${id} not found.`);
            return;
        }
        if (row.status !== 'pending') {
            log(`Confirmation ${id} is already ${row.status}.`);
            return;
        }
        db.prepare("UPDATE confirmations SET status = 'rejected', ownerResponse = 'CLI rejection', resolvedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
        log(`Confirmation ${id} rejected.`);
    }
    catch (err) {
        log(`Failed: ${err.message}`);
    }
}
export function sentinelPolicyList() {
    const storage = tryLoadStorage();
    if (!storage) {
        log('No policies found.');
        return;
    }
    const db = storage.getDatabase();
    try {
        const rows = db.prepare('SELECT name, description, action, priority, enabled FROM policies ORDER BY priority DESC').all();
        if (rows.length === 0) {
            log('No policies configured.');
            return;
        }
        log('Sentinel Policies:');
        for (const row of rows) {
            const status = row.enabled ? 'ON' : 'OFF';
            log(`  [${status}] ${row.name} (priority: ${row.priority}, action: ${row.action})`);
            if (row.description)
                log(`        ${row.description}`);
        }
    }
    catch (err) {
        log(`Failed: ${err.message}`);
    }
}
export function sentinelPolicyToggle(name, enable) {
    if (!name) {
        log(`Usage: vibe sentinel policy ${enable ? 'enable' : 'disable'} <policy-name>`);
        return;
    }
    const storage = tryLoadStorage();
    if (!storage) {
        log('No database found.');
        return;
    }
    const db = storage.getDatabase();
    try {
        const result = db.prepare('UPDATE policies SET enabled = ?, updatedAt = ? WHERE name = ?').run(enable ? 1 : 0, new Date().toISOString(), name);
        if (result.changes === 0) {
            log(`Policy '${name}' not found.`);
        }
        else {
            log(`Policy '${name}' ${enable ? 'enabled' : 'disabled'}.`);
        }
    }
    catch (err) {
        log(`Failed: ${err.message}`);
    }
}
export function sentinelSuggestions(action, id) {
    const storage = tryLoadStorage();
    if (!storage) {
        log('No suggestions found.');
        return;
    }
    const db = storage.getDatabase();
    if (action === 'accept' && id) {
        try {
            db.prepare("UPDATE suggestions SET status = 'accepted', resolvedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
            log(`Suggestion ${id} accepted.`);
        }
        catch (err) {
            log(`Failed: ${err.message}`);
        }
        return;
    }
    if (action === 'dismiss' && id) {
        try {
            db.prepare("UPDATE suggestions SET status = 'dismissed', resolvedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
            log(`Suggestion ${id} dismissed.`);
        }
        catch (err) {
            log(`Failed: ${err.message}`);
        }
        return;
    }
    // List pending suggestions
    try {
        const rows = db.prepare("SELECT id, type, title, priority, riskLevel FROM suggestions WHERE status = 'pending' ORDER BY priority ASC LIMIT 20").all();
        if (rows.length === 0) {
            log('No pending suggestions.');
            return;
        }
        log(`Pending Suggestions (${rows.length}):`);
        for (const row of rows) {
            log(`  [P${row.priority}] ${row.type}: ${row.title} (risk: ${row.riskLevel}) — id: ${row.id}`);
        }
    }
    catch (err) {
        log(`Failed: ${err.message}`);
    }
}
export function sentinelHelp() {
    log(`
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
//# sourceMappingURL=sentinel.js.map