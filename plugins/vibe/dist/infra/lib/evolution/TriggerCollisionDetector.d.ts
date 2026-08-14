export interface CollisionResult {
    hasCollision: boolean;
    type: 'exact' | 'prefix' | 'circular' | 'none';
    collidingWith?: string;
    message?: string;
}
interface SkillTrigger {
    name: string;
    triggers: string[];
}
export declare class TriggerCollisionDetector {
    /**
     * Check if new triggers collide with existing skills
     */
    checkCollision(newTriggers: string[], existingSkills: SkillTrigger[]): CollisionResult;
    /**
     * Detect circular trigger chains using DFS
     * @param skills All active skills with their trigger patterns and content
     */
    detectCircularChain(skills: Array<{
        name: string;
        triggers: string[];
        content: string;
    }>): string[][];
}
export {};
//# sourceMappingURL=TriggerCollisionDetector.d.ts.map