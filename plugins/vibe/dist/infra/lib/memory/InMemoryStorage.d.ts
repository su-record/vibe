import type { MemoryItem } from './MemoryStorage.js';
import type { IMemoryStorage } from './IMemoryStorage.js';
export declare class InMemoryStorage implements IMemoryStorage {
    private readonly store;
    save(key: string, value: string, category?: string, priority?: number): void;
    recall(key: string): MemoryItem | null;
    update(key: string, value: string): boolean;
    delete(key: string): boolean;
    list(category?: string): MemoryItem[];
    search(query: string): MemoryItem[];
    close(): void;
}
//# sourceMappingURL=InMemoryStorage.d.ts.map