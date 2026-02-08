/**
 * Unit tests for WebServer
 */

import { describe, it, expect, vi } from 'vitest';
import type { InterfaceLogger } from '../../types.js';

describe('WebServer', () => {
  const mockLogger: InterfaceLogger = vi.fn();

  describe('constructor', () => {
    it('initializes with default config', async () => {
      const { WebServer } = await import('../WebServer.js');
      const server = new WebServer({}, mockLogger);
      expect(server.name).toBe('web');
      expect(server.channel).toBe('web');
      expect(server.getStatus()).toBe('disabled');
    });

    it('initializes with custom config', async () => {
      const { WebServer } = await import('../WebServer.js');
      const server = new WebServer({ port: 8080, host: '0.0.0.0' }, mockLogger);
      expect(server.name).toBe('web');
    });
  });

  describe('getAuthToken', () => {
    it('returns auth token', async () => {
      const { WebServer } = await import('../WebServer.js');
      const server = new WebServer({ authToken: 'test-token' }, mockLogger);
      expect(server.getAuthToken()).toBe('test-token');
    });

    it('generates token if not provided', async () => {
      const { WebServer } = await import('../WebServer.js');
      const server = new WebServer({}, mockLogger);
      const token = server.getAuthToken();
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(0);
    });
  });
});
