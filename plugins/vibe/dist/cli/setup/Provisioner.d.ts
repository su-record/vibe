/**
 * Provisioner - Post-init step for project-specific agent recommendations
 * Generates recommended agents and SPEC template based on detected tech stacks
 */
import type { DetectedStack, StackDetails } from '../types.js';
export interface RecommendedAgent {
    name: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
    rationale: string;
}
export interface RecommendedAgentsConfig {
    generatedAt: string;
    projectStacks: string[];
    agents: RecommendedAgent[];
}
export interface ProvisionResult {
    configEnhanced: boolean;
    agentsGenerated: boolean;
    specTemplateGenerated: boolean;
}
export declare class Provisioner {
    private constructor();
    static provision(projectRoot: string, detectedStacks: DetectedStack[], stackDetails: StackDetails): ProvisionResult;
    static generateRecommendedAgents(stacks: string[]): RecommendedAgent[];
    static generateSpecTemplate(stacks: string[], details: StackDetails): string;
}
//# sourceMappingURL=Provisioner.d.ts.map