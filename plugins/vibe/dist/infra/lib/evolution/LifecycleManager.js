// Lifecycle Manager for self-evolution Phase 4
// Manages state transitions: draft → testing → active → disabled → deleted
import { GenerationRegistry } from './GenerationRegistry.js';
import { UsageTracker } from './UsageTracker.js';
import { RollbackManager } from './RollbackManager.js';
const TTL_DAYS = 7;
const PROMOTION_MIN_USAGE = 3;
const PROMOTION_MAX_NEG_RATIO = 0.3;
const DEMOTION_NEG_RATIO = 0.5;
export class LifecycleManager {
    registry;
    tracker;
    rollback;
    constructor(storage) {
        this.registry = new GenerationRegistry(storage);
        this.tracker = new UsageTracker(storage);
        this.rollback = new RollbackManager(storage);
    }
    /**
     * Run full lifecycle check: promotions + demotions + TTL cleanup + deletion
     */
    cleanup() {
        const result = { promoted: [], demoted: [], deleted: [], errors: [] };
        // 1. Check promotions (testing → active)
        const promotions = this.checkPromotions();
        result.promoted.push(...promotions);
        // 2. Check demotions (active → disabled) based on negative feedback
        const demotions = this.checkDemotions();
        result.demoted.push(...demotions);
        // 3. TTL expiration (active → disabled for unused)
        const ttlExpired = this.checkTTLExpiration();
        result.demoted.push(...ttlExpired);
        // 4. Delete long-disabled (disabled → deleted after additional 7 days)
        const deletions = this.checkDeletions();
        result.deleted.push(...deletions);
        return result;
    }
    /**
     * testing → active: 3+ usage + weighted negative ratio < 30%
     */
    checkPromotions() {
        const promoted = [];
        const testing = this.registry.getByStatus('testing');
        for (const gen of testing) {
            const usageCount = this.tracker.getUsageCount(gen.id);
            if (usageCount < PROMOTION_MIN_USAGE)
                continue;
            const stats = this.tracker.getFeedbackStats(gen.id);
            if (stats.weightedNegativeRatio < PROMOTION_MAX_NEG_RATIO) {
                this.registry.updateStatus(gen.id, 'active');
                promoted.push(gen.id);
            }
        }
        return promoted;
    }
    /**
     * active → disabled: weighted negative ratio > 50%
     */
    checkDemotions() {
        const demoted = [];
        const active = this.registry.getByStatus('active');
        for (const gen of active) {
            const stats = this.tracker.getFeedbackStats(gen.id);
            if (stats.totalEvents > 0 && stats.weightedNegativeRatio > DEMOTION_NEG_RATIO) {
                try {
                    this.rollback.disable(gen.id);
                    demoted.push(gen.id);
                }
                catch (error) {
                    process.stderr.write(`[Lifecycle] Demotion failed for ${gen.id}: ${error instanceof Error ? error.message : 'Unknown'}\n`);
                }
            }
        }
        return demoted;
    }
    /**
     * active → disabled: no usage for TTL_DAYS
     */
    checkTTLExpiration() {
        const expired = [];
        const active = this.registry.getByStatus('active');
        const ttlMs = TTL_DAYS * 24 * 60 * 60 * 1000;
        const now = Date.now();
        for (const gen of active) {
            const lastUsed = gen.lastUsedAt ? new Date(gen.lastUsedAt).getTime() : new Date(gen.createdAt).getTime();
            if (now - lastUsed > ttlMs) {
                try {
                    this.rollback.disable(gen.id);
                    expired.push(gen.id);
                }
                catch (error) {
                    process.stderr.write(`[Lifecycle] TTL disable failed for ${gen.id}: ${error instanceof Error ? error.message : 'Unknown'}\n`);
                }
            }
        }
        return expired;
    }
    /**
     * disabled → deleted: disabled for additional TTL_DAYS with no recovery
     */
    checkDeletions() {
        const deleted = [];
        const disabled = this.registry.getByStatus('disabled');
        const ttlMs = TTL_DAYS * 24 * 60 * 60 * 1000;
        const now = Date.now();
        for (const gen of disabled) {
            const updatedAt = new Date(gen.updatedAt).getTime();
            if (now - updatedAt > ttlMs) {
                this.registry.updateStatus(gen.id, 'deleted');
                deleted.push(gen.id);
            }
        }
        return deleted;
    }
    /**
     * Approve a draft generation (draft → testing)
     */
    approve(generationId) {
        const gen = this.registry.getById(generationId);
        if (!gen || gen.status !== 'draft')
            return false;
        return this.registry.updateStatus(generationId, 'testing');
    }
    /**
     * Reject a draft generation (draft → deleted)
     */
    reject(generationId) {
        const gen = this.registry.getById(generationId);
        if (!gen || gen.status !== 'draft')
            return false;
        return this.registry.updateStatus(generationId, 'deleted');
    }
}
//# sourceMappingURL=LifecycleManager.js.map