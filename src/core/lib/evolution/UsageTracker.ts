// Usage Tracker for self-evolution Phase 4
// Records usage events for auto-generated artifacts

import { randomUUID } from 'crypto';
import { MemoryStorage } from '../memory/MemoryStorage.js';
import { GenerationRegistry } from './GenerationRegistry.js';

export type FeedbackType = 'positive' | 'negative' | 'neutral';

export interface UsageEvent {
  id: string;
  generationId: string;
  sessionId: string | null;
  matchedPrompt: string | null;
  feedback: FeedbackType | null;
  createdAt: string;
}

interface UsageEventRow {
  id: string;
  generationId: string;
  sessionId: string | null;
  matchedPrompt: string | null;
  feedback: string | null;
  createdAt: string;
}

export class UsageTracker {
  private db: ReturnType<MemoryStorage['getDatabase']>;
  private registry: GenerationRegistry;

  constructor(storage: MemoryStorage) {
    this.db = storage.getDatabase();
    this.registry = new GenerationRegistry(storage);
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_events (
        id TEXT PRIMARY KEY,
        generationId TEXT NOT NULL,
        sessionId TEXT,
        matchedPrompt TEXT,
        feedback TEXT CHECK(feedback IN ('positive','negative','neutral') OR feedback IS NULL),
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ue_gen ON usage_events(generationId);
      CREATE INDEX IF NOT EXISTS idx_ue_session ON usage_events(sessionId);
      CREATE INDEX IF NOT EXISTS idx_ue_feedback ON usage_events(feedback);
      CREATE INDEX IF NOT EXISTS idx_ue_created ON usage_events(createdAt);
    `);
  }

  /**
   * Record a usage event when an auto-generated skill is injected
   */
  public recordUsage(generationId: string, sessionId?: string, matchedPrompt?: string): string {
    const id = `ue-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO usage_events (id, generationId, sessionId, matchedPrompt, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, generationId, sessionId || null, matchedPrompt || null, now);

    // Also increment usage count in generations table
    this.registry.incrementUsage(generationId);

    return id;
  }

  /**
   * Record explicit user feedback for a usage event
   */
  public setFeedback(eventId: string, feedback: FeedbackType): boolean {
    const result = this.db.prepare(`
      UPDATE usage_events SET feedback = ? WHERE id = ?
    `).run(feedback, eventId);
    return result.changes > 0;
  }

  /**
   * Record explicit feedback for a generation (latest event)
   */
  public setFeedbackForGeneration(generationId: string, feedback: FeedbackType): boolean {
    const event = this.db.prepare(`
      SELECT id FROM usage_events WHERE generationId = ? ORDER BY createdAt DESC LIMIT 1
    `).get(generationId) as { id: string } | undefined;

    if (!event) return false;
    return this.setFeedback(event.id, feedback);
  }

  /**
   * Apply implicit feedback based on session goals completion
   */
  public applyImplicitFeedback(sessionId: string, goalsCompletionRatio: number): number {
    let feedback: FeedbackType;
    if (goalsCompletionRatio >= 0.8) {
      feedback = 'positive';
    } else if (goalsCompletionRatio < 0.3) {
      feedback = 'negative';
    } else {
      feedback = 'neutral';
    }

    // Only apply to events without explicit feedback
    const result = this.db.prepare(`
      UPDATE usage_events SET feedback = ?
      WHERE sessionId = ? AND feedback IS NULL
    `).run(feedback, sessionId);

    return result.changes;
  }

  /**
   * Get usage events for a generation
   */
  public getByGeneration(generationId: string): UsageEvent[] {
    const rows = this.db.prepare(`
      SELECT * FROM usage_events WHERE generationId = ? ORDER BY createdAt DESC
    `).all(generationId) as UsageEventRow[];
    return rows.map(this.rowToEvent);
  }

  /**
   * Get feedback stats for a generation (weighted)
   */
  public getFeedbackStats(generationId: string): {
    totalEvents: number;
    weightedNegativeRatio: number;
    explicitPositive: number;
    explicitNegative: number;
    implicitPositive: number;
    implicitNegative: number;
  } {
    const events = this.getByGeneration(generationId);
    const totalEvents = events.length;

    // Separate explicit (events with feedback set before implicit) vs implicit
    // For simplicity: events with feedback are counted; we use a heuristic:
    // events where feedback was set on the same event are explicit if set individually
    // For now, treat all feedback equally but weight explicit 2x
    // This is simplified - in practice explicit vs implicit would need a source column

    let explicitPos = 0, explicitNeg = 0, implicitPos = 0, implicitNeg = 0;

    for (const event of events) {
      if (!event.feedback || event.feedback === 'neutral') continue;
      // Heuristic: if matchedPrompt is null, likely implicit feedback
      const isExplicit = event.matchedPrompt !== null;
      if (event.feedback === 'positive') {
        if (isExplicit) explicitPos++;
        else implicitPos++;
      } else if (event.feedback === 'negative') {
        if (isExplicit) explicitNeg++;
        else implicitNeg++;
      }
    }

    const weightedNeg = explicitNeg * 2 + implicitNeg;
    const weightedPos = explicitPos * 2 + implicitPos;
    const totalWeighted = weightedNeg + weightedPos;
    const weightedNegativeRatio = totalWeighted > 0 ? weightedNeg / totalWeighted : 0;

    return {
      totalEvents,
      weightedNegativeRatio,
      explicitPositive: explicitPos,
      explicitNegative: explicitNeg,
      implicitPositive: implicitPos,
      implicitNegative: implicitNeg,
    };
  }

  /**
   * Get total usage count for a generation
   */
  public getUsageCount(generationId: string): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM usage_events WHERE generationId = ?
    `).get(generationId) as { cnt: number };
    return result.cnt;
  }

  private rowToEvent(row: UsageEventRow): UsageEvent {
    return {
      id: row.id,
      generationId: row.generationId,
      sessionId: row.sessionId,
      matchedPrompt: row.matchedPrompt,
      feedback: row.feedback as FeedbackType | null,
      createdAt: row.createdAt,
    };
  }
}
