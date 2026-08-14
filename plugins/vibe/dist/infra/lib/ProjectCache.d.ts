import type { Project } from 'ts-morph';
export declare class ProjectCache {
    private static instance;
    private cache;
    private readonly MAX_CACHE_SIZE;
    private readonly CACHE_TTL;
    private readonly MAX_TOTAL_MEMORY_MB;
    private readonly MAX_PROJECT_MEMORY_MB;
    private constructor();
    static getInstance(): ProjectCache;
    getOrCreate(projectPath: string): Promise<Project>;
    invalidate(projectPath: string): void;
    clear(): void;
    getStats(): {
        size: number;
        totalMemoryMB: number;
        projects: Array<{
            path: string;
            files: number;
            memoryMB: number;
            age: number;
        }>;
    };
    private getTotalMemoryUsage;
    private removeExpired;
    private evictLRU;
}
//# sourceMappingURL=ProjectCache.d.ts.map