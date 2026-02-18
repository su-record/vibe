import { describe, it, expect } from 'vitest';

describe('Memory barrel file exports', () => {
  it('should export existing memory classes', async () => {
    const memory = await import('./index.js');

    expect(memory.MemoryStorage).toBeDefined();
    expect(memory.KnowledgeGraph).toBeDefined();
    expect(memory.MemorySearch).toBeDefined();
    expect(memory.ObservationStore).toBeDefined();
  });

  it('should export SessionRAG classes', async () => {
    const memory = await import('./index.js');

    expect(memory.SessionRAGStore).toBeDefined();
    expect(memory.SessionRAGRetriever).toBeDefined();
    expect(memory.SessionSummarizer).toBeDefined();
  });

  it('should export all SessionRAG classes as constructable functions', async () => {
    const memory = await import('./index.js');

    expect(typeof memory.SessionRAGStore).toBe('function');
    expect(typeof memory.SessionRAGRetriever).toBe('function');
    expect(typeof memory.SessionSummarizer).toBe('function');
  });
});
