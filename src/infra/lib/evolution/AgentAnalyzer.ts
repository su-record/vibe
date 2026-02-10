// Agent Performance Analysis for self-evolution Phase 2
// Analyzes agent execution stats to find optimization opportunities

import Database from 'better-sqlite3';
import { InsightStore } from './InsightStore.js';

interface AgentStats {
  agentName: string;
  totalRuns: number;
  failedRuns: number;
  failureRate: number;
  avgDuration: number;
}

export class AgentAnalyzer {
  private insightStore: InsightStore;
  private agentDb: Database.Database | null = null;

  constructor(insightStore: InsightStore, agentRegistryDbPath?: string) {
    this.insightStore = insightStore;
    if (agentRegistryDbPath) {
      try {
        this.agentDb = new Database(agentRegistryDbPath, { readonly: true });
      } catch {
        this.agentDb = null;
      }
    }
  }

  /**
   * Analyze agent execution stats and generate optimization insights
   */
  public analyze(): { newInsights: string[]; agentsAnalyzed: number } {
    const result = { newInsights: [] as string[], agentsAnalyzed: 0 };

    if (!this.agentDb) return result;

    try {
      const stats = this.agentDb.prepare(`
        SELECT
          agentName,
          COUNT(*) as totalRuns,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedRuns,
          AVG(duration) as avgDuration
        FROM agent_executions
        WHERE createdAt > datetime('now', '-7 days')
        GROUP BY agentName
        HAVING totalRuns >= 5
      `).all() as AgentStats[];

      result.agentsAnalyzed = stats.length;

      for (const stat of stats) {
        const failureRate = stat.totalRuns > 0 ? stat.failedRuns / stat.totalRuns : 0;

        // High failure rate agent
        if (failureRate > 0.3) {
          const existingId = this.insightStore.findAndMergeDuplicate(
            `High failure rate: ${stat.agentName}`,
            ''
          );
          if (!existingId) {
            const id = this.insightStore.save({
              type: 'optimization',
              title: `High failure rate: ${stat.agentName}`,
              description: `Agent ${stat.agentName} has ${(failureRate * 100).toFixed(0)}% failure rate (${stat.failedRuns}/${stat.totalRuns} runs)`,
              confidence: Math.min(1.0, failureRate),
              tags: ['agent', 'performance', stat.agentName],
              generatedFrom: 'agent_stats',
            });
            result.newInsights.push(id);
          }
        }

        // Slow agent (> 60 seconds average)
        if (stat.avgDuration > 60000) {
          const existingId = this.insightStore.findAndMergeDuplicate(
            `Slow agent: ${stat.agentName}`,
            ''
          );
          if (!existingId) {
            const id = this.insightStore.save({
              type: 'optimization',
              title: `Slow agent: ${stat.agentName}`,
              description: `Agent ${stat.agentName} averages ${(stat.avgDuration / 1000).toFixed(1)}s per execution`,
              confidence: 0.6,
              tags: ['agent', 'performance', stat.agentName],
              generatedFrom: 'agent_stats',
            });
            result.newInsights.push(id);
          }
        }
      }
    } catch {
      // AgentRegistry query failed, skip
    }

    return result;
  }

  public close(): void {
    if (this.agentDb) {
      this.agentDb.close();
      this.agentDb = null;
    }
  }
}
