import type { MemoryItem } from './MemoryStorage.js';
import type { IMemoryStorage } from './IMemoryStorage.js';

export class InMemoryStorage implements IMemoryStorage {
  private readonly store = new Map<string, MemoryItem>();

  public save(key: string, value: string, category: string = 'general', priority: number = 0): void {
    const timestamp = new Date().toISOString();
    this.store.set(key, { key, value, category, timestamp, lastAccessed: timestamp, priority });
  }

  public recall(key: string): MemoryItem | null {
    const item = this.store.get(key);
    if (!item) return null;
    const updated: MemoryItem = { ...item, lastAccessed: new Date().toISOString() };
    this.store.set(key, updated);
    return updated;
  }

  public update(key: string, value: string): boolean {
    const item = this.store.get(key);
    if (!item) return false;
    const timestamp = new Date().toISOString();
    this.store.set(key, { ...item, value, timestamp, lastAccessed: timestamp });
    return true;
  }

  public delete(key: string): boolean {
    return this.store.delete(key);
  }

  public list(category?: string): MemoryItem[] {
    const items = Array.from(this.store.values());
    const filtered = category ? items.filter(i => i.category === category) : items;
    return filtered.sort((a, b) => {
      const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp.localeCompare(a.timestamp);
    });
  }

  public search(query: string): MemoryItem[] {
    const lower = query.toLowerCase();
    return Array.from(this.store.values()).filter(
      item => item.key.toLowerCase().includes(lower) || item.value.toLowerCase().includes(lower)
    );
  }

  public close(): void {
    this.store.clear();
  }
}
