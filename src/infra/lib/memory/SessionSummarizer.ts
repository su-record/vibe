// Session summarization and rich context injection
// Generates session summaries from observations and provides context for next session

import Database from 'better-sqlite3';
import { MemoryStorage } from './MemoryStorage.js';
import { ObservationStore, Observation } from './ObservationStore.js';

export interface SessionSummary {
  id: number;
  sessionId: string;
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  nextSteps: string | null;
  filesRead: string[];
  filesEdited: string[];
  timestamp: string;
}

interface SessionSummaryRow {
  id: number;
  sessionId: string;
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  nextSteps: string | null;
  filesRead: string | null;
  filesEdited: string | null;
  timestamp: string;
}

export interface SessionSummaryInput {
  sessionId: string;
  request?: string;
  investigated?: string;
  learned?: string;
  completed?: string;
  nextSteps?: string;
  filesRead?: string[];
  filesEdited?: string[];
}

export class SessionSummarizer {
  private db: Database.Database;
  private observations: ObservationStore;

  constructor(storage: MemoryStorage) {
    this.db = storage.getDatabase();
    this.observations = new ObservationStore(storage);
  }

  /**
   * Save or update a session summary
   */
  public saveSummary(input: SessionSummaryInput): number {
    const timestamp = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO session_summaries
        (sessionId, request, investigated, learned, completed, nextSteps, filesRead, filesEdited, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.sessionId,
      input.request || null,
      input.investigated || null,
      input.learned || null,
      input.completed || null,
      input.nextSteps || null,
      input.filesRead ? JSON.stringify(input.filesRead) : null,
      input.filesEdited ? JSON.stringify(input.filesEdited) : null,
      timestamp
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get recent session summaries
   */
  public getRecentSummaries(limit: number = 3): SessionSummary[] {
    const rows = this.db.prepare(`
      SELECT * FROM session_summaries
      ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as SessionSummaryRow[];

    return rows.map(this.rowToSummary);
  }

  /**
   * Get summary for a specific session
   */
  public getSummary(sessionId: string): SessionSummary | null {
    const row = this.db.prepare(`
      SELECT * FROM session_summaries WHERE sessionId = ?
    `).get(sessionId) as SessionSummaryRow | undefined;

    return row ? this.rowToSummary(row) : null;
  }

  /**
   * Auto-generate a session summary from observations
   */
  public generateSummaryFromObservations(sessionId: string): SessionSummaryInput {
    const observations = this.observations.getBySession(sessionId, 50);

    if (observations.length === 0) {
      return { sessionId };
    }

    const decisions = observations.filter(o => o.type === 'decision');
    const discoveries = observations.filter(o => o.type === 'discovery');
    const features = observations.filter(o => o.type === 'feature');
    const bugfixes = observations.filter(o => o.type === 'bugfix');
    const refactors = observations.filter(o => o.type === 'refactor');

    const allFiles = new Set<string>();
    observations.forEach(o => o.filesModified.forEach(f => allFiles.add(f)));

    const learned = [
      ...decisions.map(o => o.title),
      ...discoveries.map(o => o.title),
    ].slice(0, 5).join('; ');

    const completed = [
      ...features.map(o => o.title),
      ...bugfixes.map(o => o.title),
      ...refactors.map(o => o.title),
    ].slice(0, 5).join('; ');

    return {
      sessionId,
      learned: learned || undefined,
      completed: completed || undefined,
      filesEdited: Array.from(allFiles).slice(0, 10),
    };
  }

  /**
   * Generate rich context markdown for session start
   */
  public generateSessionContext(tokenBudget: number = 2000): string {
    const charBudget = tokenBudget * 4; // ~4 chars per token
    let context = '';

    // 1. Recent session summaries (최근 3개)
    const summaries = this.getRecentSummaries(3);
    if (summaries.length > 0) {
      context += '\n## Previous Sessions\n';
      for (const s of summaries) {
        const date = new Date(s.timestamp).toLocaleDateString();
        context += `\n### ${date}`;
        if (s.completed) context += `\n- Completed: ${s.completed}`;
        if (s.learned) context += `\n- Learned: ${s.learned}`;
        if (s.nextSteps) context += `\n- Next: ${s.nextSteps}`;
        if (s.filesEdited.length > 0) {
          context += `\n- Files: ${s.filesEdited.slice(0, 5).join(', ')}`;
        }
      }
      context += '\n';
    }

    // 2. Key observations (decision/discovery 우선, 최근 5개)
    if (context.length < charBudget) {
      const keyObs = [
        ...this.observations.getRecent(3, 'decision'),
        ...this.observations.getRecent(3, 'discovery'),
      ].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);

      if (keyObs.length > 0) {
        context += '\n## Key Observations\n';
        for (const obs of keyObs) {
          context += `- [${obs.type}] ${obs.title}`;
          if (obs.facts.length > 0) {
            context += `: ${obs.facts[0]}`;
          }
          context += '\n';
        }
      }
    }

    // 3. Recently modified files map
    if (context.length < charBudget) {
      const recentObs = this.observations.getRecent(20);
      const fileMap = new Map<string, number>();
      for (const obs of recentObs) {
        for (const f of obs.filesModified) {
          fileMap.set(f, (fileMap.get(f) || 0) + 1);
        }
      }

      if (fileMap.size > 0) {
        const sortedFiles = Array.from(fileMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);

        context += '\n## Recently Modified Files\n';
        for (const [file, count] of sortedFiles) {
          const shortName = file.split(/[\\/]/).slice(-2).join('/');
          context += `- ${shortName} (${count}x)\n`;
        }
      }
    }

    // Truncate if over budget
    if (context.length > charBudget) {
      context = context.substring(0, charBudget) + '\n...(truncated)';
    }

    return context;
  }

  private rowToSummary(row: SessionSummaryRow): SessionSummary {
    return {
      id: row.id,
      sessionId: row.sessionId,
      request: row.request,
      investigated: row.investigated,
      learned: row.learned,
      completed: row.completed,
      nextSteps: row.nextSteps,
      filesRead: row.filesRead ? JSON.parse(row.filesRead) : [],
      filesEdited: row.filesEdited ? JSON.parse(row.filesEdited) : [],
      timestamp: row.timestamp,
    };
  }
}
