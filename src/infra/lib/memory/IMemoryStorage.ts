/**
 * IMemoryStorage — Store interface abstraction
 * Inspired by Agent-Lightning's LightningStore pattern.
 * Enables in-memory implementations for testing.
 */

import type { MemoryItem } from './MemoryStorage.js';

export interface IMemoryStorage {
  save(key: string, value: string, category?: string, priority?: number): void;
  recall(key: string): MemoryItem | null;
  update(key: string, value: string): boolean;
  delete(key: string): boolean;
  list(category?: string): MemoryItem[];
  search(query: string): MemoryItem[];
  close(): void;
}
