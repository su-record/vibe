import { Insight } from '../InsightStore.js';
interface GeneratedAgent {
    name: string;
    content: string;
}
export declare class AgentGenerator {
    /**
     * Generate an agent definition from a complex insight
     * Only generates agents for insights with 5+ evidence and 500+ char description
     */
    generate(insight: Insight): GeneratedAgent | null;
}
export {};
//# sourceMappingURL=AgentGenerator.d.ts.map