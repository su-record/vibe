// Session RAG Store - Structured session context storage
// Manages Decisions, Constraints, Goals, Evidence with FTS5 search
import { MemoryStorage } from './MemoryStorage.js';
// ============================================================================
// SessionRAGStore
// ============================================================================
export class SessionRAGStore {
    db;
    fts5Available = false;
    constructor(storage) {
        this.db = storage.getDatabase();
        this.fts5Available = storage.isFTS5Available();
        this.initializeTables();
    }
    // ==========================================================================
    // Schema Initialization
    // ==========================================================================
    initializeTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT,
        title TEXT NOT NULL,
        description TEXT,
        rationale TEXT,
        alternatives TEXT,
        impact TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','superseded','cancelled')),
        priority INTEGER DEFAULT 1,
        relatedFiles TEXT,
        tags TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sdec_session ON session_decisions(sessionId);
      CREATE INDEX IF NOT EXISTS idx_sdec_status ON session_decisions(status);
      CREATE INDEX IF NOT EXISTS idx_sdec_priority ON session_decisions(priority);
      CREATE INDEX IF NOT EXISTS idx_sdec_timestamp ON session_decisions(timestamp);
    `);
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_constraints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL CHECK(type IN ('technical','business','resource','quality')),
        severity TEXT DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
        scope TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_scon_session ON session_constraints(sessionId);
      CREATE INDEX IF NOT EXISTS idx_scon_type ON session_constraints(type);
      CREATE INDEX IF NOT EXISTS idx_scon_severity ON session_constraints(severity);
    `);
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT,
        parentId INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','blocked','cancelled')),
        priority INTEGER DEFAULT 1,
        progressPercent INTEGER DEFAULT 0 CHECK(progressPercent >= 0 AND progressPercent <= 100),
        successCriteria TEXT,
        timestamp TEXT NOT NULL,
        completedAt TEXT,
        FOREIGN KEY(parentId) REFERENCES session_goals(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sgoal_session ON session_goals(sessionId);
      CREATE INDEX IF NOT EXISTS idx_sgoal_status ON session_goals(status);
      CREATE INDEX IF NOT EXISTS idx_sgoal_priority ON session_goals(priority);
      CREATE INDEX IF NOT EXISTS idx_sgoal_parent ON session_goals(parentId);
    `);
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_evidence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT,
        type TEXT NOT NULL CHECK(type IN ('test','build','lint','coverage','hud','review')),
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pass','fail','warning','info')),
        details TEXT,
        metrics TEXT,
        relatedGoals TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sevi_session ON session_evidence(sessionId);
      CREATE INDEX IF NOT EXISTS idx_sevi_type ON session_evidence(type);
      CREATE INDEX IF NOT EXISTS idx_sevi_status ON session_evidence(status);
      CREATE INDEX IF NOT EXISTS idx_sevi_timestamp ON session_evidence(timestamp);
    `);
        // Phase 5: Conversation history table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chatId TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_conv_chat_time ON conversation_history(chatId, timestamp);
    `);
        // Schema migration: add taskId column to all session tables
        const tables = [
            'session_decisions',
            'session_constraints',
            'session_goals',
            'session_evidence',
        ];
        for (const table of tables) {
            try {
                this.db.exec(`ALTER TABLE ${table} ADD COLUMN taskId TEXT`);
            }
            catch {
                // Column already exists — idempotent
            }
        }
        this.initializeFTS5();
    }
    initializeFTS5() {
        if (!this.fts5Available)
            return;
        try {
            // Decisions FTS
            this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS session_decisions_fts
          USING fts5(title, description, rationale, content=session_decisions, content_rowid=id);

        CREATE TRIGGER IF NOT EXISTS sdec_fts_ai AFTER INSERT ON session_decisions BEGIN
          INSERT INTO session_decisions_fts(rowid, title, description, rationale)
            VALUES (new.id, new.title, new.description, new.rationale);
        END;
        CREATE TRIGGER IF NOT EXISTS sdec_fts_ad AFTER DELETE ON session_decisions BEGIN
          INSERT INTO session_decisions_fts(session_decisions_fts, rowid, title, description, rationale)
            VALUES('delete', old.id, old.title, old.description, old.rationale);
        END;
        CREATE TRIGGER IF NOT EXISTS sdec_fts_au AFTER UPDATE ON session_decisions BEGIN
          INSERT INTO session_decisions_fts(session_decisions_fts, rowid, title, description, rationale)
            VALUES('delete', old.id, old.title, old.description, old.rationale);
          INSERT INTO session_decisions_fts(rowid, title, description, rationale)
            VALUES (new.id, new.title, new.description, new.rationale);
        END;
      `);
            // Constraints FTS
            this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS session_constraints_fts
          USING fts5(title, description, content=session_constraints, content_rowid=id);

        CREATE TRIGGER IF NOT EXISTS scon_fts_ai AFTER INSERT ON session_constraints BEGIN
          INSERT INTO session_constraints_fts(rowid, title, description)
            VALUES (new.id, new.title, new.description);
        END;
        CREATE TRIGGER IF NOT EXISTS scon_fts_ad AFTER DELETE ON session_constraints BEGIN
          INSERT INTO session_constraints_fts(session_constraints_fts, rowid, title, description)
            VALUES('delete', old.id, old.title, old.description);
        END;
        CREATE TRIGGER IF NOT EXISTS scon_fts_au AFTER UPDATE ON session_constraints BEGIN
          INSERT INTO session_constraints_fts(session_constraints_fts, rowid, title, description)
            VALUES('delete', old.id, old.title, old.description);
          INSERT INTO session_constraints_fts(rowid, title, description)
            VALUES (new.id, new.title, new.description);
        END;
      `);
            // Goals FTS
            this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS session_goals_fts
          USING fts5(title, description, content=session_goals, content_rowid=id);

        CREATE TRIGGER IF NOT EXISTS sgoal_fts_ai AFTER INSERT ON session_goals BEGIN
          INSERT INTO session_goals_fts(rowid, title, description)
            VALUES (new.id, new.title, new.description);
        END;
        CREATE TRIGGER IF NOT EXISTS sgoal_fts_ad AFTER DELETE ON session_goals BEGIN
          INSERT INTO session_goals_fts(session_goals_fts, rowid, title, description)
            VALUES('delete', old.id, old.title, old.description);
        END;
        CREATE TRIGGER IF NOT EXISTS sgoal_fts_au AFTER UPDATE ON session_goals BEGIN
          INSERT INTO session_goals_fts(session_goals_fts, rowid, title, description)
            VALUES('delete', old.id, old.title, old.description);
          INSERT INTO session_goals_fts(rowid, title, description)
            VALUES (new.id, new.title, new.description);
        END;
      `);
            // Evidence FTS
            this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS session_evidence_fts
          USING fts5(title, details, content=session_evidence, content_rowid=id);

        CREATE TRIGGER IF NOT EXISTS sevi_fts_ai AFTER INSERT ON session_evidence BEGIN
          INSERT INTO session_evidence_fts(rowid, title, details)
            VALUES (new.id, new.title, new.details);
        END;
        CREATE TRIGGER IF NOT EXISTS sevi_fts_ad AFTER DELETE ON session_evidence BEGIN
          INSERT INTO session_evidence_fts(session_evidence_fts, rowid, title, details)
            VALUES('delete', old.id, old.title, old.details);
        END;
        CREATE TRIGGER IF NOT EXISTS sevi_fts_au AFTER UPDATE ON session_evidence BEGIN
          INSERT INTO session_evidence_fts(session_evidence_fts, rowid, title, details)
            VALUES('delete', old.id, old.title, old.details);
          INSERT INTO session_evidence_fts(rowid, title, details)
            VALUES (new.id, new.title, new.details);
        END;
      `);
        }
        catch {
            // FTS5 initialization failed for session RAG tables - non-critical
        }
    }
    // ==========================================================================
    // Decisions
    // ==========================================================================
    addDecision(input) {
        const timestamp = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO session_decisions (sessionId, taskId, title, description, rationale, alternatives, impact, status, priority, relatedFiles, tags, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(input.sessionId || null, input.taskId || null, input.title, input.description || null, input.rationale || null, input.alternatives ? JSON.stringify(input.alternatives) : null, input.impact || null, input.status || 'active', input.priority ?? 1, input.relatedFiles ? JSON.stringify(input.relatedFiles) : null, input.tags ? JSON.stringify(input.tags) : null, timestamp);
        return result.lastInsertRowid;
    }
    getDecision(id) {
        const row = this.db.prepare(`SELECT * FROM session_decisions WHERE id = ?`).get(id);
        return row ? this.rowToDecision(row) : null;
    }
    updateDecision(id, updates) {
        const fields = [];
        const values = [];
        if (updates.title !== undefined) {
            fields.push('title = ?');
            values.push(updates.title);
        }
        if (updates.description !== undefined) {
            fields.push('description = ?');
            values.push(updates.description);
        }
        if (updates.rationale !== undefined) {
            fields.push('rationale = ?');
            values.push(updates.rationale);
        }
        if (updates.alternatives !== undefined) {
            fields.push('alternatives = ?');
            values.push(JSON.stringify(updates.alternatives));
        }
        if (updates.impact !== undefined) {
            fields.push('impact = ?');
            values.push(updates.impact);
        }
        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.priority !== undefined) {
            fields.push('priority = ?');
            values.push(updates.priority);
        }
        if (updates.relatedFiles !== undefined) {
            fields.push('relatedFiles = ?');
            values.push(JSON.stringify(updates.relatedFiles));
        }
        if (updates.tags !== undefined) {
            fields.push('tags = ?');
            values.push(JSON.stringify(updates.tags));
        }
        if (fields.length === 0)
            return false;
        values.push(id);
        const result = this.db.prepare(`UPDATE session_decisions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return result.changes > 0;
    }
    listDecisions(sessionId, status, limit = 50) {
        let sql = 'SELECT * FROM session_decisions WHERE 1=1';
        const params = [];
        if (sessionId) {
            sql += ' AND sessionId = ?';
            params.push(sessionId);
        }
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        sql += ' ORDER BY priority DESC, timestamp DESC LIMIT ?';
        params.push(limit);
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(this.rowToDecision);
    }
    searchDecisions(query, limit = 20) {
        if (this.fts5Available) {
            try {
                const rows = this.db.prepare(`
          SELECT d.*, bm25(session_decisions_fts) as rank
          FROM session_decisions_fts fts
          JOIN session_decisions d ON d.id = fts.rowid
          WHERE session_decisions_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `).all(MemoryStorage.sanitizeFTS5Query(query), limit);
                return rows.map(this.rowToDecision);
            }
            catch {
                // FTS5 query failed, fall through to LIKE
            }
        }
        const pattern = `%${query}%`;
        const rows = this.db.prepare(`
      SELECT * FROM session_decisions
      WHERE title LIKE ? OR description LIKE ? OR rationale LIKE ?
      ORDER BY priority DESC, timestamp DESC LIMIT ?
    `).all(pattern, pattern, pattern, limit);
        return rows.map(this.rowToDecision);
    }
    deleteDecision(id) {
        const result = this.db.prepare('DELETE FROM session_decisions WHERE id = ?').run(id);
        return result.changes > 0;
    }
    rowToDecision(row) {
        return {
            id: row.id,
            sessionId: row.sessionId,
            title: row.title,
            description: row.description,
            rationale: row.rationale,
            alternatives: row.alternatives ? JSON.parse(row.alternatives) : [],
            impact: row.impact,
            status: row.status,
            priority: row.priority,
            relatedFiles: row.relatedFiles ? JSON.parse(row.relatedFiles) : [],
            tags: row.tags ? JSON.parse(row.tags) : [],
            timestamp: row.timestamp,
        };
    }
    // ==========================================================================
    // Constraints
    // ==========================================================================
    addConstraint(input) {
        const timestamp = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO session_constraints (sessionId, taskId, title, description, type, severity, scope, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(input.sessionId || null, input.taskId || null, input.title, input.description || null, input.type, input.severity || 'medium', input.scope || null, timestamp);
        return result.lastInsertRowid;
    }
    getConstraint(id) {
        const row = this.db.prepare('SELECT * FROM session_constraints WHERE id = ?').get(id);
        return row ? this.rowToConstraint(row) : null;
    }
    updateConstraint(id, updates) {
        const fields = [];
        const values = [];
        if (updates.title !== undefined) {
            fields.push('title = ?');
            values.push(updates.title);
        }
        if (updates.description !== undefined) {
            fields.push('description = ?');
            values.push(updates.description);
        }
        if (updates.type !== undefined) {
            fields.push('type = ?');
            values.push(updates.type);
        }
        if (updates.severity !== undefined) {
            fields.push('severity = ?');
            values.push(updates.severity);
        }
        if (updates.scope !== undefined) {
            fields.push('scope = ?');
            values.push(updates.scope);
        }
        if (fields.length === 0)
            return false;
        values.push(id);
        const result = this.db.prepare(`UPDATE session_constraints SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return result.changes > 0;
    }
    listConstraints(sessionId, type, severity, limit = 50) {
        let sql = 'SELECT * FROM session_constraints WHERE 1=1';
        const params = [];
        if (sessionId) {
            sql += ' AND sessionId = ?';
            params.push(sessionId);
        }
        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }
        if (severity) {
            sql += ' AND severity = ?';
            params.push(severity);
        }
        sql += ' ORDER BY CASE severity WHEN \'critical\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 WHEN \'low\' THEN 3 END, timestamp DESC LIMIT ?';
        params.push(limit);
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(this.rowToConstraint);
    }
    searchConstraints(query, limit = 20) {
        if (this.fts5Available) {
            try {
                const rows = this.db.prepare(`
          SELECT c.*, bm25(session_constraints_fts) as rank
          FROM session_constraints_fts fts
          JOIN session_constraints c ON c.id = fts.rowid
          WHERE session_constraints_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `).all(MemoryStorage.sanitizeFTS5Query(query), limit);
                return rows.map(this.rowToConstraint);
            }
            catch {
                // Fall through to LIKE
            }
        }
        const pattern = `%${query}%`;
        const rows = this.db.prepare(`
      SELECT * FROM session_constraints
      WHERE title LIKE ? OR description LIKE ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(pattern, pattern, limit);
        return rows.map(this.rowToConstraint);
    }
    deleteConstraint(id) {
        const result = this.db.prepare('DELETE FROM session_constraints WHERE id = ?').run(id);
        return result.changes > 0;
    }
    rowToConstraint(row) {
        return {
            id: row.id,
            sessionId: row.sessionId,
            title: row.title,
            description: row.description,
            type: row.type,
            severity: row.severity,
            scope: row.scope,
            timestamp: row.timestamp,
        };
    }
    // ==========================================================================
    // Goals
    // ==========================================================================
    addGoal(input) {
        const timestamp = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO session_goals (sessionId, taskId, parentId, title, description, status, priority, progressPercent, successCriteria, timestamp, completedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(input.sessionId || null, input.taskId || null, input.parentId || null, input.title, input.description || null, input.status || 'active', input.priority ?? 1, input.progressPercent ?? 0, input.successCriteria ? JSON.stringify(input.successCriteria) : null, timestamp, null);
        return result.lastInsertRowid;
    }
    getGoal(id) {
        const row = this.db.prepare('SELECT * FROM session_goals WHERE id = ?').get(id);
        return row ? this.rowToGoal(row) : null;
    }
    updateGoal(id, updates) {
        const fields = [];
        const values = [];
        if (updates.title !== undefined) {
            fields.push('title = ?');
            values.push(updates.title);
        }
        if (updates.description !== undefined) {
            fields.push('description = ?');
            values.push(updates.description);
        }
        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
            if (updates.status === 'completed') {
                fields.push('completedAt = ?');
                values.push(new Date().toISOString());
            }
        }
        if (updates.priority !== undefined) {
            fields.push('priority = ?');
            values.push(updates.priority);
        }
        if (updates.progressPercent !== undefined) {
            fields.push('progressPercent = ?');
            values.push(updates.progressPercent);
        }
        if (updates.successCriteria !== undefined) {
            fields.push('successCriteria = ?');
            values.push(JSON.stringify(updates.successCriteria));
        }
        if (updates.parentId !== undefined) {
            fields.push('parentId = ?');
            values.push(updates.parentId);
        }
        if (fields.length === 0)
            return false;
        values.push(id);
        const result = this.db.prepare(`UPDATE session_goals SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return result.changes > 0;
    }
    listGoals(sessionId, status, limit = 50) {
        let sql = 'SELECT * FROM session_goals WHERE 1=1';
        const params = [];
        if (sessionId) {
            sql += ' AND sessionId = ?';
            params.push(sessionId);
        }
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        sql += ' ORDER BY priority DESC, timestamp DESC LIMIT ?';
        params.push(limit);
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(this.rowToGoal);
    }
    getActiveGoals(limit = 10) {
        const rows = this.db.prepare(`
      SELECT * FROM session_goals
      WHERE status = 'active'
      ORDER BY priority DESC, timestamp DESC
      LIMIT ?
    `).all(limit);
        return rows.map(this.rowToGoal);
    }
    getGoalHierarchy(rootId) {
        if (rootId) {
            // Get root + all descendants (max 3 levels)
            const rows = this.db.prepare(`
        SELECT * FROM session_goals
        WHERE id = ? OR parentId = ?
        ORDER BY parentId NULLS FIRST, priority DESC
      `).all(rootId, rootId);
            return rows.map(this.rowToGoal);
        }
        // Get all top-level goals with children
        const rows = this.db.prepare(`
      SELECT * FROM session_goals
      ORDER BY parentId NULLS FIRST, priority DESC, timestamp DESC
    `).all();
        return rows.map(this.rowToGoal);
    }
    searchGoals(query, limit = 20) {
        if (this.fts5Available) {
            try {
                const rows = this.db.prepare(`
          SELECT g.*, bm25(session_goals_fts) as rank
          FROM session_goals_fts fts
          JOIN session_goals g ON g.id = fts.rowid
          WHERE session_goals_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `).all(MemoryStorage.sanitizeFTS5Query(query), limit);
                return rows.map(this.rowToGoal);
            }
            catch {
                // Fall through to LIKE
            }
        }
        const pattern = `%${query}%`;
        const rows = this.db.prepare(`
      SELECT * FROM session_goals
      WHERE title LIKE ? OR description LIKE ?
      ORDER BY priority DESC, timestamp DESC LIMIT ?
    `).all(pattern, pattern, limit);
        return rows.map(this.rowToGoal);
    }
    deleteGoal(id) {
        const result = this.db.prepare('DELETE FROM session_goals WHERE id = ?').run(id);
        return result.changes > 0;
    }
    rowToGoal(row) {
        return {
            id: row.id,
            sessionId: row.sessionId,
            parentId: row.parentId,
            title: row.title,
            description: row.description,
            status: row.status,
            priority: row.priority,
            progressPercent: row.progressPercent,
            successCriteria: row.successCriteria ? JSON.parse(row.successCriteria) : [],
            timestamp: row.timestamp,
            completedAt: row.completedAt,
        };
    }
    // ==========================================================================
    // Evidence
    // ==========================================================================
    addEvidence(input) {
        const timestamp = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO session_evidence (sessionId, taskId, type, title, status, details, metrics, relatedGoals, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(input.sessionId || null, input.taskId || null, input.type, input.title, input.status, input.details ? JSON.stringify(input.details) : null, input.metrics ? JSON.stringify(input.metrics) : null, input.relatedGoals ? JSON.stringify(input.relatedGoals) : null, timestamp);
        return result.lastInsertRowid;
    }
    getEvidence(id) {
        const row = this.db.prepare('SELECT * FROM session_evidence WHERE id = ?').get(id);
        return row ? this.rowToEvidence(row) : null;
    }
    listEvidence(sessionId, type, status, limit = 50) {
        let sql = 'SELECT * FROM session_evidence WHERE 1=1';
        const params = [];
        if (sessionId) {
            sql += ' AND sessionId = ?';
            params.push(sessionId);
        }
        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        sql += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(this.rowToEvidence);
    }
    getRecentEvidence(limit = 10) {
        const rows = this.db.prepare(`
      SELECT * FROM session_evidence
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit);
        return rows.map(this.rowToEvidence);
    }
    searchEvidence(query, limit = 20) {
        if (this.fts5Available) {
            try {
                const rows = this.db.prepare(`
          SELECT e.*, bm25(session_evidence_fts) as rank
          FROM session_evidence_fts fts
          JOIN session_evidence e ON e.id = fts.rowid
          WHERE session_evidence_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `).all(MemoryStorage.sanitizeFTS5Query(query), limit);
                return rows.map(this.rowToEvidence);
            }
            catch {
                // Fall through to LIKE
            }
        }
        const pattern = `%${query}%`;
        const rows = this.db.prepare(`
      SELECT * FROM session_evidence
      WHERE title LIKE ? OR details LIKE ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(pattern, pattern, limit);
        return rows.map(this.rowToEvidence);
    }
    deleteEvidence(id) {
        const result = this.db.prepare('DELETE FROM session_evidence WHERE id = ?').run(id);
        return result.changes > 0;
    }
    rowToEvidence(row) {
        return {
            id: row.id,
            sessionId: row.sessionId,
            type: row.type,
            title: row.title,
            status: row.status,
            details: row.details ? JSON.parse(row.details) : null,
            metrics: row.metrics ? JSON.parse(row.metrics) : null,
            relatedGoals: row.relatedGoals ? JSON.parse(row.relatedGoals) : [],
            timestamp: row.timestamp,
        };
    }
    // ==========================================================================
    // Task-scoped cleanup
    // ==========================================================================
    deleteByTaskId(taskId) {
        const tables = [
            'session_decisions',
            'session_constraints',
            'session_goals',
            'session_evidence',
        ];
        for (const table of tables) {
            try {
                this.db.prepare(`DELETE FROM ${table} WHERE taskId = ?`).run(taskId);
            }
            catch {
                // Column may not exist yet — idempotent
            }
        }
    }
    // ==========================================================================
    // Stats
    // ==========================================================================
    getStats() {
        const decStatuses = this.db.prepare('SELECT status, COUNT(*) as count FROM session_decisions GROUP BY status').all();
        const conTypes = this.db.prepare('SELECT type, COUNT(*) as count FROM session_constraints GROUP BY type').all();
        const goalStatuses = this.db.prepare('SELECT status, COUNT(*) as count FROM session_goals GROUP BY status').all();
        const eviTypes = this.db.prepare('SELECT type, COUNT(*) as count FROM session_evidence GROUP BY type').all();
        const toRecord = (rows, keyField) => {
            const record = {};
            let total = 0;
            for (const row of rows) {
                const key = row[keyField];
                const count = row.count;
                record[key] = count;
                total += count;
            }
            return { total, record };
        };
        const dec = toRecord(decStatuses, 'status');
        const con = toRecord(conTypes, 'type');
        const goal = toRecord(goalStatuses, 'status');
        const evi = toRecord(eviTypes, 'type');
        return {
            decisions: { total: dec.total, byStatus: dec.record },
            constraints: { total: con.total, byType: con.record },
            goals: { total: goal.total, byStatus: goal.record },
            evidence: { total: evi.total, byType: evi.record },
        };
    }
    // ==========================================================================
    // Phase 5: Conversation History
    // ==========================================================================
    /** Save a conversation entry (user or assistant) */
    saveConversationEntry(chatId, role, content, timestamp) {
        try {
            const ts = timestamp ?? new Date().toISOString();
            const stmt = this.db.prepare('INSERT INTO conversation_history (chatId, role, content, timestamp) VALUES (?, ?, ?, ?)');
            stmt.run(chatId, role, content, ts);
        }
        catch {
            // DB write failure must not break main flow
        }
    }
    /** Get recent conversation history (default 24h, max 8000 chars) */
    getRecentConversationHistory(chatId, hoursBack = 24, maxChars = 8000) {
        try {
            const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
            const rows = this.db.prepare('SELECT role, content, timestamp FROM conversation_history WHERE chatId = ? AND timestamp > ? ORDER BY timestamp ASC').all(chatId, cutoff);
            // Apply max chars limit (oldest first removed)
            let totalChars = 0;
            const result = [];
            for (let i = rows.length - 1; i >= 0; i--) {
                totalChars += rows[i].content.length;
                if (totalChars > maxChars)
                    break;
                result.unshift(rows[i]);
            }
            return result;
        }
        catch {
            return [];
        }
    }
    /** Delete conversation entries older than specified hours */
    cleanupOldConversationHistory(olderThanHours = 48) {
        try {
            const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
            this.db.prepare('DELETE FROM conversation_history WHERE timestamp < ?').run(cutoff);
        }
        catch {
            // Cleanup failure is not critical
        }
    }
}
//# sourceMappingURL=SessionRAGStore.js.map