import { InsightStore } from './InsightStore.js';
export declare class AgentAnalyzer {
    private insightStore;
    private agentDb;
    constructor(insightStore: InsightStore, agentRegistryDbPath?: string);
    /**
     * Analyze agent execution stats and generate optimization insights
     */
    analyze(): {
        newInsights: string[];
        agentsAnalyzed: number;
    };
    close(): void;
}
//# sourceMappingURL=AgentAnalyzer.d.ts.map