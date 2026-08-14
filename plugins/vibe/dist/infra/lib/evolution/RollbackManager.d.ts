import { MemoryStorage } from '../memory/MemoryStorage.js';
export declare class RollbackManager {
    private db;
    private registry;
    constructor(storage: MemoryStorage);
    /**
     * Disable a single generation: DB status → 'disabled', file → .md.disabled
     */
    disable(generationId: string): void;
    /**
     * Rollback to previous version: disable current, restore parent
     */
    rollback(generationId: string): void;
    /**
     * Emergency: disable ALL auto-generated artifacts
     */
    emergencyDisableAll(): {
        disabled: number;
        errors: string[];
    };
    /**
     * Re-enable a disabled generation
     */
    enable(generationId: string): void;
}
//# sourceMappingURL=RollbackManager.d.ts.map