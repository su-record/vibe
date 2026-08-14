import { Insight } from '../InsightStore.js';
interface GeneratedSkill {
    name: string;
    content: string;
    triggerPatterns: string[];
}
export declare class SkillGenerator {
    /**
     * Generate a skill definition from an insight
     */
    generate(insight: Insight): GeneratedSkill | null;
    private extractTriggers;
}
export {};
//# sourceMappingURL=SkillGenerator.d.ts.map