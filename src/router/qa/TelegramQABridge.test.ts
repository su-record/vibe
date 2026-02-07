/**
 * TelegramQABridge Tests
 * Auto-approve, manual approve, timeout behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramQABridge } from './TelegramQABridge.js';
import { PermissionRequest } from '../../interface/types.js';
import { QAConfig, RouteServices } from '../types.js';

const mockLogger = vi.fn();

function createConfig(overrides?: Partial<QAConfig>): QAConfig {
  return {
    autoApproveTools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Ls'],
    maxWaitSeconds: 1, // Short timeout for tests
    readOnTimeout: 'approve',
    writeOnTimeout: 'deny',
    ...overrides,
  };
}

function createRequest(tool: string, description: string = 'test operation'): PermissionRequest {
  return {
    jobId: 'job-1',
    sessionId: 'session-1',
    tool,
    description,
    timestamp: new Date().toISOString(),
  };
}

function createMockServices(): RouteServices {
  return {
    logger: mockLogger,
    sendTelegram: vi.fn().mockResolvedValue(undefined),
    sendTelegramInlineKeyboard: vi.fn().mockResolvedValue(123),
    router: {
      handleMessage: vi.fn(),
      getSmartRouter: vi.fn(),
    },
    config: {
      repos: { aliases: {}, basePaths: [] },
      qa: createConfig(),
      notifications: { quietHoursStart: 23, quietHoursEnd: 7, minIntervalMs: 10000 },
    },
  };
}

describe('TelegramQABridge', () => {
  let bridge: TelegramQABridge;

  beforeEach(() => {
    mockLogger.mockClear();
  });

  describe('Auto-approve (read-only tools)', () => {
    it('should auto-approve Read tool', async () => {
      bridge = new TelegramQABridge(mockLogger, createConfig(), 'chat-1');
      const result = await bridge.handlePermissionRequest(createRequest('Read'));
      expect(result).toBe(true);
    });

    it('should auto-approve Glob tool', async () => {
      bridge = new TelegramQABridge(mockLogger, createConfig(), 'chat-1');
      const result = await bridge.handlePermissionRequest(createRequest('Glob'));
      expect(result).toBe(true);
    });

    it('should auto-approve Grep tool', async () => {
      bridge = new TelegramQABridge(mockLogger, createConfig(), 'chat-1');
      const result = await bridge.handlePermissionRequest(createRequest('Grep'));
      expect(result).toBe(true);
    });

    it('should auto-approve WebSearch tool', async () => {
      bridge = new TelegramQABridge(mockLogger, createConfig(), 'chat-1');
      const result = await bridge.handlePermissionRequest(createRequest('WebSearch'));
      expect(result).toBe(true);
    });
  });

  describe('Manual approve (write tools)', () => {
    it('should send inline keyboard for Edit tool', async () => {
      const config = createConfig({ maxWaitSeconds: 5 });
      bridge = new TelegramQABridge(mockLogger, config, 'chat-1');
      const services = createMockServices();
      bridge.setServices(services);

      // Start the permission request but handle it immediately
      const promise = bridge.handlePermissionRequest(createRequest('Edit'));

      // Simulate user clicking approve
      await new Promise((r) => setTimeout(r, 100));
      bridge.handleCallbackResponse('approve');

      const result = await promise;
      expect(result).toBe(true);
    });

    it('should deny when user clicks deny button', async () => {
      const config = createConfig({ maxWaitSeconds: 5 });
      bridge = new TelegramQABridge(mockLogger, config, 'chat-1');
      const services = createMockServices();
      bridge.setServices(services);

      const promise = bridge.handlePermissionRequest(createRequest('Write'));

      await new Promise((r) => setTimeout(r, 100));
      bridge.handleCallbackResponse('deny');

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe('Timeout behavior', () => {
    it('should deny on timeout for write tools (default)', async () => {
      const config = createConfig({ maxWaitSeconds: 1, writeOnTimeout: 'deny' });
      bridge = new TelegramQABridge(mockLogger, config, 'chat-1');
      const services = createMockServices();
      bridge.setServices(services);

      const result = await bridge.handlePermissionRequest(createRequest('Write'));
      expect(result).toBe(false);
    }, 3000);

    it('should auto-decide on timeout when ai_decide is configured', async () => {
      const config = createConfig({
        maxWaitSeconds: 1,
        writeOnTimeout: 'ai_decide',
      });
      bridge = new TelegramQABridge(mockLogger, config, 'chat-1');
      const services = createMockServices();
      bridge.setServices(services);

      const result = await bridge.handlePermissionRequest(createRequest('Edit', 'editing a file'));
      expect(result).toBe(true);
    }, 3000);

    it('should deny destructive commands even with ai_decide', async () => {
      const config = createConfig({
        maxWaitSeconds: 1,
        writeOnTimeout: 'ai_decide',
      });
      bridge = new TelegramQABridge(mockLogger, config, 'chat-1');
      const services = createMockServices();
      bridge.setServices(services);

      const result = await bridge.handlePermissionRequest(
        createRequest('Bash', 'rm -rf /'),
      );
      expect(result).toBe(false);
    }, 3000);
  });

  describe('Cleanup', () => {
    it('should deny all pending requests on cleanup', async () => {
      const config = createConfig({ maxWaitSeconds: 60 });
      bridge = new TelegramQABridge(mockLogger, config, 'chat-1');
      const services = createMockServices();
      bridge.setServices(services);

      const promise = bridge.handlePermissionRequest(createRequest('Write'));

      await new Promise((r) => setTimeout(r, 50));
      bridge.cleanup();

      const result = await promise;
      expect(result).toBe(false);
    });
  });
});
