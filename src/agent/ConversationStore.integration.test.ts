/**
 * Integration test: AgentLoop with ConversationStore
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AgentLoop } from './AgentLoop.js';
import { ConversationStore } from './ConversationStore.js';
import { HeadModelSelector } from './HeadModelSelector.js';
import type { HeadModelProvider, HeadModelResponse, AgentMessage, AgentToolDefinition, ToolDefinition } from './types.js';
import type { ExternalMessage } from '../interface/types.js';
import type { RouteServices, RouterConfig, ModelARouterInterface } from '../router/types.js';

const TEST_DB = path.join(os.tmpdir(), `conv-integration-test-${process.pid}-${Date.now()}.db`);

// Mock head model provider
class MockHeadModel implements HeadModelProvider {
  readonly provider = 'gpt' as const;
  readonly model = 'gpt-4';

  async chat(_messages: AgentMessage[], _tools?: AgentToolDefinition[]): Promise<HeadModelResponse> {
    return {
      content: 'Mock response',
      finishReason: 'stop',
      model: this.model,
    };
  }
}

// Create mock services
function createMockServices(): RouteServices {
  return {
    logger: () => {},
    sendTelegram: async () => {},
    sendTelegramInlineKeyboard: async () => undefined,
    registerCallbackHandler: () => {},
    unregisterCallbackHandler: () => {},
    router: {} as ModelARouterInterface,
    config: {
      repos: { aliases: {}, basePaths: [] },
      qa: { autoApproveTools: [], maxWaitSeconds: 30, readOnTimeout: 'approve', writeOnTimeout: 'deny' },
      notifications: { quietHoursStart: 0, quietHoursEnd: 0, minIntervalMs: 0 },
    } as RouterConfig,
  };
}

describe('AgentLoop + ConversationStore Integration', () => {
  let store: ConversationStore;
  let agentLoop: AgentLoop;

  beforeEach(() => {
    store = new ConversationStore(TEST_DB);

    const selector = new HeadModelSelector();

    const tools: ToolDefinition[] = [];

    agentLoop = new AgentLoop({
      headSelector: selector,
      tools,
      conversationStore: store,
    });
  });

  afterEach(() => {
    store.close();
    try { fs.unlinkSync(TEST_DB); } catch {}
    try { fs.unlinkSync(TEST_DB + '-wal'); } catch {}
    try { fs.unlinkSync(TEST_DB + '-shm'); } catch {}
  });

  it('should persist conversation across AgentLoop calls', async () => {
    const chatId = 'test-chat-1';
    const message: ExternalMessage = {
      id: 'msg-1',
      chatId,
      userId: 'user-1',
      channel: 'telegram',
      type: 'text',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    };

    const services = createMockServices();

    // First call
    await agentLoop.process(message, services);

    // Check that messages were persisted
    const messages1 = store.getMessages(chatId);
    expect(messages1.length).toBeGreaterThan(0);

    // Second call with same chatId
    const message2: ExternalMessage = {
      id: 'msg-2',
      chatId,
      userId: 'user-1',
      channel: 'telegram',
      type: 'text',
      content: 'Second message',
      timestamp: new Date().toISOString(),
    };

    await agentLoop.process(message2, services);

    // Check that both conversations are persisted
    const messages2 = store.getMessages(chatId);
    expect(messages2.length).toBeGreaterThan(messages1.length);
  });

  it('should restore conversation after AgentLoop restart', async () => {
    const chatId = 'test-chat-2';
    const message: ExternalMessage = {
      id: 'msg-1',
      chatId,
      userId: 'user-1',
      channel: 'telegram',
      type: 'text',
      content: 'Persistent message',
      timestamp: new Date().toISOString(),
    };

    const services = createMockServices();

    await agentLoop.process(message, services);

    const messages1 = store.getMessages(chatId);
    const messageCount = messages1.length;

    // Create new AgentLoop with same store
    const selector = new HeadModelSelector();
    const newAgentLoop = new AgentLoop({
      headSelector: selector,
      tools: [],
      conversationStore: store,
    });

    const message2: ExternalMessage = {
      id: 'msg-2',
      chatId,
      userId: 'user-1',
      channel: 'telegram',
      type: 'text',
      content: 'After restart',
      timestamp: new Date().toISOString(),
    };

    await newAgentLoop.process(message2, services);

    // Should have previous messages + new ones
    const messages2 = store.getMessages(chatId);
    expect(messages2.length).toBeGreaterThan(messageCount);
  });

  it('should fall back to in-memory state when conversationStore is not provided', async () => {
    // Create AgentLoop without conversationStore
    const selector = new HeadModelSelector();
    const inMemoryLoop = new AgentLoop({
      headSelector: selector,
      tools: [],
      // conversationStore not provided
    });

    const chatId = 'test-chat-3';
    const message: ExternalMessage = {
      id: 'msg-1',
      chatId,
      userId: 'user-1',
      channel: 'telegram',
      type: 'text',
      content: 'In-memory message',
      timestamp: new Date().toISOString(),
    };

    const services = createMockServices();

    // Should not throw
    await expect(inMemoryLoop.process(message, services)).resolves.not.toThrow();

    // ConversationState is used, not persisted to DB
    const messages = store.getMessages(chatId);
    expect(messages).toHaveLength(0);
  });
});
