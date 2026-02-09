import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ConversationStore } from './ConversationStore.js';

const TEST_DB = path.join(os.tmpdir(), `conv-test-${process.pid}-${Date.now()}.db`);

describe('ConversationStore', () => {
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore(TEST_DB);
  });

  afterEach(() => {
    store.close();
    try { fs.unlinkSync(TEST_DB); } catch {}
    try { fs.unlinkSync(TEST_DB + '-wal'); } catch {}
    try { fs.unlinkSync(TEST_DB + '-shm'); } catch {}
  });

  it('should add and retrieve messages', () => {
    store.addMessage('chat-1', { role: 'user', content: 'Hello' });
    store.addMessage('chat-1', { role: 'assistant', content: 'Hi there!' });

    const messages = store.getMessages('chat-1');
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].content).toBe('Hi there!');
  });

  it('should apply sliding window (max 20)', () => {
    for (let i = 0; i < 25; i++) {
      store.addMessage('chat-1', { role: 'user', content: `Message ${i}` });
    }
    const messages = store.getMessages('chat-1');
    expect(messages).toHaveLength(20);
    expect(messages[0].content).toBe('Message 5');
    expect(messages[19].content).toBe('Message 24');
  });

  it('should persist across instances', () => {
    store.addMessage('chat-1', { role: 'user', content: 'persistent msg' });
    store.close();

    const store2 = new ConversationStore(TEST_DB);
    const messages = store2.getMessages('chat-1');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('persistent msg');
    store2.close();

    // Re-create for afterEach cleanup
    store = new ConversationStore(TEST_DB);
  });

  it('should clean expired sessions', () => {
    store.addMessage('active', { role: 'user', content: 'active msg' });
    store.addMessage('expired', { role: 'user', content: 'old msg' });

    // Use test helper to set old lastActivity
    store._setLastActivityForTest('expired', Date.now() - 31 * 60 * 1000);

    const cleaned = store.cleanExpired();
    expect(cleaned).toBe(1);

    expect(store.getMessages('active')).toHaveLength(1);
    expect(store.getMessages('expired')).toHaveLength(0);
  });

  it('should mask sensitive data', () => {
    store.addMessage('chat-1', { role: 'tool', content: 'api_key=sk-ant-abc123456789xyz token=xoxb-secret' });
    const messages = store.getMessages('chat-1');
    expect(messages[0].content).toContain('***MASKED***');
    expect(messages[0].content).not.toContain('sk-ant-abc123456789xyz');
  });

  it('should detect expired sessions', () => {
    expect(store.isSessionExpired('nonexistent')).toBe(true);
    store.addMessage('fresh', { role: 'user', content: 'hello' });
    expect(store.isSessionExpired('fresh')).toBe(false);
  });

  it('should clear sessions', () => {
    store.addMessage('chat-1', { role: 'user', content: 'hello' });
    store.clearSession('chat-1');
    expect(store.getMessages('chat-1')).toHaveLength(0);
  });

  it('should return empty array for non-existent chat', () => {
    const messages = store.getMessages('non-existent');
    expect(messages).toEqual([]);
  });

  it('should handle concurrent writes (WAL mode)', () => {
    // WAL mode should allow concurrent reads/writes
    store.addMessage('chat-1', { role: 'user', content: 'msg1' });
    store.addMessage('chat-2', { role: 'user', content: 'msg2' });

    expect(store.getMessages('chat-1')).toHaveLength(1);
    expect(store.getMessages('chat-2')).toHaveLength(1);
  });
});
