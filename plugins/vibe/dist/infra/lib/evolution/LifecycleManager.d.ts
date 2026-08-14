import { MemoryStorage } from '../memory/MemoryStorage.js';
interface TransitionResult {
    promoted: string[];
    demoted: string[];
    deleted: string[];
    errors: string[];
}
export declare class LifecycleManager {
    private registry;
    private tracker;
    private rollback;
    constructor(storage: MemoryStorage);
    /**
     * Run full lifecycle check: promotions + demotions + TTL cleanup + deletion
     */
    cleanup(): TransitionResult;
    /**
     * testing → active: 3+ usage + weighted negative ratio < 30%
     */
    checkPromotions(): string[];
    /**
     * active → disabled: weighted negative ratio > 50%
     */
    checkDemotions(): string[];
    /**
     * active → disabled: no usage for TTL_DAYS
     */
    checkTTLExpiration(): string[];
    /**
     * disabled → deleted: disabled for additional TTL_DAYS with no recovery
     */
    checkDeletions(): string[];
    /**
     * Approve a draft generation (draft → testing)
     */
    approve(generationId: string): boolean;
    /**
     * Reject a draft generation (draft → deleted)
     */
    reject(generationId: string): boolean;
}
export {};
//# sourceMappingURL=LifecycleManager.d.ts.map