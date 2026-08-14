import { Insight } from '../InsightStore.js';
interface GeneratedRule {
    name: string;
    content: string;
}
export declare class RuleGenerator {
    /**
     * Generate a rule definition from an insight
     */
    generate(insight: Insight): GeneratedRule | null;
}
export {};
//# sourceMappingURL=RuleGenerator.d.ts.map