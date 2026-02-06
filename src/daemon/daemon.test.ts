/**
 * Phase 1: Agent Engine Tests
 * Tests for VibeDaemon, DaemonIPC, and SessionPool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { VibeDaemon } from './VibeDaemon.js';
import { DaemonIPC } from './DaemonIPC.js';
import { SessionPool } from './SessionPool.js';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  RPC_ERROR_CODES,
  DaemonConfig,
  LogLevel,
} from './types.js';

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_DIR = path.join(os.tmpdir(), `vibe-daemon-test-${process.pid}`);

function makeTestConfig(): DaemonConfig {
  const id = crypto.randomBytes(4).toString('hex');
  return {
    socketPath: path.join(TEST_DIR, `test-${id}.sock`),
    pidFile: path.join(TEST_DIR, `test-${id}.pid`),
    tokenFile: path.join(TEST_DIR, `test-${id}.token`),
    logDir: path.join(TEST_DIR, 'logs'),
    logFile: path.join(TEST_DIR, 'logs', `test-${id}.log`),
    maxPayloadBytes: 1024 * 1024,
    ipcTimeoutMs: 5000,
    gracefulShutdownMs: 3000,
    maxGlobalSessions: 5,
    maxSessionsPerProject: 1,
    idleSessionTimeoutMs: 30 * 60 * 1000,
    sessionReconnectMaxRetries: 3,
  };
}

const noopLogger = (_level: LogLevel, _msg: string, _data?: unknown): void => {};

function sendRawRequest(
  socketPath: string,
  data: string,
  timeout = 3000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Timeout'));
    }, timeout);

    socket.on('connect', () => {
      socket.write(data);
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n').filter((l) => l.trim());
      if (lines.length > 0) {
        clearTimeout(timer);
        socket.destroy();
        resolve(lines[0]);
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ============================================================================
// Setup / Teardown
// ============================================================================

beforeEach(() => {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  VibeDaemon.resetInstance();
});

afterEach(() => {
  VibeDaemon.resetInstance();
});

// ============================================================================
// Scenario 1: Start daemon successfully
// ============================================================================

describe('Scenario 1: Start daemon successfully', () => {
  it('should create IPC server and listen on Unix socket', async () => {
    const config = makeTestConfig();
    const ipc = new DaemonIPC(config, noopLogger);

    ipc.registerMethod('test.echo', (params) => params);
    await ipc.generateAuthToken();
    await ipc.start();

    // Verify socket exists
    expect(fs.existsSync(config.socketPath)).toBe(true);

    await ipc.stop();
  });

  it('should generate auth token file', async () => {
    const config = makeTestConfig();
    const ipc = new DaemonIPC(config, noopLogger);

    const token = await ipc.generateAuthToken();

    expect(token).toHaveLength(64); // 32 bytes hex
    expect(fs.existsSync(config.tokenFile)).toBe(true);

    const storedToken = fs.readFileSync(config.tokenFile, 'utf-8');
    expect(storedToken).toBe(token);

    await ipc.stop();
  });
});

// ============================================================================
// Scenario 2: Stop daemon gracefully
// ============================================================================

describe('Scenario 2: Stop daemon gracefully', () => {
  it('should clean up socket and token on stop', async () => {
    const config = makeTestConfig();
    const ipc = new DaemonIPC(config, noopLogger);

    await ipc.generateAuthToken();
    await ipc.start();

    expect(fs.existsSync(config.socketPath)).toBe(true);

    await ipc.stop();

    expect(fs.existsSync(config.socketPath)).toBe(false);
    expect(fs.existsSync(config.tokenFile)).toBe(false);
  });
});

// ============================================================================
// Scenario 3: Check daemon status
// ============================================================================

describe('Scenario 3: Check daemon status', () => {
  it('should return health info via IPC', async () => {
    const config = makeTestConfig();
    const ipc = new DaemonIPC(config, noopLogger);

    ipc.registerMethod('daemon.health', () => ({
      status: 'running',
      uptime: 1000,
      activeSessions: 0,
      version: '0.1.0',
      pid: process.pid,
    }));

    const token = await ipc.generateAuthToken();
    await ipc.start();

    const result = await DaemonIPC.sendRequest(
      config.socketPath,
      'daemon.health',
      undefined,
      token
    ) as Record<string, unknown>;

    expect(result.status).toBe('running');
    expect(result.version).toBe('0.1.0');
    expect(result.pid).toBe(process.pid);

    await ipc.stop();
  });
});

// ============================================================================
// Scenario 4: IPC communication
// ============================================================================

describe('Scenario 4: IPC communication (JSON-RPC)', () => {
  it('should handle valid JSON-RPC request and return matching id', async () => {
    const config = makeTestConfig();
    const ipc = new DaemonIPC(config, noopLogger);

    ipc.registerMethod('test.echo', (params) => ({
      echo: params,
    }));

    const token = await ipc.generateAuthToken();
    await ipc.start();

    const result = await DaemonIPC.sendRequest(
      config.socketPath,
      'test.echo',
      { hello: 'world' },
      token
    ) as Record<string, unknown>;

    expect(result.echo).toEqual({ hello: 'world' });

    await ipc.stop();
  });

  it('should reject request with invalid auth token', async () => {
    const config = makeTestConfig();
    const ipc = new DaemonIPC(config, noopLogger);

    ipc.registerMethod('test.echo', () => 'ok');
    await ipc.generateAuthToken();
    await ipc.start();

    await expect(
      DaemonIPC.sendRequest(config.socketPath, 'test.echo', undefined, 'wrong-token')
    ).rejects.toThrow('Authentication failed');

    await ipc.stop();
  });

  it('should return error for unknown method', async () => {
    const config = makeTestConfig();
    const ipc = new DaemonIPC(config, noopLogger);

    const token = await ipc.generateAuthToken();
    await ipc.start();

    await expect(
      DaemonIPC.sendRequest(config.socketPath, 'nonexistent.method', undefined, token)
    ).rejects.toThrow('Method not found');

    await ipc.stop();
  });

  it('should reject oversized payloads', async () => {
    const config = makeTestConfig();
    config.maxPayloadBytes = 100; // Very small limit
    const ipc = new DaemonIPC(config, noopLogger);

    await ipc.generateAuthToken();
    await ipc.start();

    // Send oversized payload
    const bigData = 'x'.repeat(200);
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'test',
      params: { data: bigData },
      id: 1,
    };

    const rawResp = await sendRawRequest(
      config.socketPath,
      JSON.stringify(request) + '\n'
    );
    const resp: JsonRpcResponse = JSON.parse(rawResp);
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(RPC_ERROR_CODES.PARSE_ERROR);

    await ipc.stop();
  });

  it('should reject malformed JSON', async () => {
    const config = makeTestConfig();
    const ipc = new DaemonIPC(config, noopLogger);

    await ipc.generateAuthToken();
    await ipc.start();

    const rawResp = await sendRawRequest(
      config.socketPath,
      '{ invalid json\n'
    );
    const resp: JsonRpcResponse = JSON.parse(rawResp);
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(RPC_ERROR_CODES.PARSE_ERROR);

    await ipc.stop();
  });
});

// ============================================================================
// Scenario 5: Claude Code session pooling
// ============================================================================

describe('Scenario 5: Session pooling', () => {
  it('should reuse session for same project', () => {
    const config = makeTestConfig();
    const pool = new SessionPool(config, noopLogger);

    const session1 = pool.getOrCreateSession('/path/to/project');
    const session2 = pool.getOrCreateSession('/path/to/project');

    expect(session1.id).toBe(session2.id);
  });

  it('should create different sessions for different projects', () => {
    const config = makeTestConfig();
    const pool = new SessionPool(config, noopLogger);

    const session1 = pool.getOrCreateSession('/path/to/project-a');
    const session2 = pool.getOrCreateSession('/path/to/project-b');

    expect(session1.id).not.toBe(session2.id);
  });

  it('should enforce global session limit', () => {
    const config = makeTestConfig();
    config.maxGlobalSessions = 2;
    const pool = new SessionPool(config, noopLogger);

    pool.getOrCreateSession('/project-1');
    pool.getOrCreateSession('/project-2');

    // Third session should evict oldest idle
    const session3 = pool.getOrCreateSession('/project-3');
    expect(session3).toBeDefined();
    expect(pool.getActiveCount()).toBe(2);
  });
});

// ============================================================================
// Scenario 6: Idle session cleanup
// ============================================================================

describe('Scenario 6: Idle session cleanup', () => {
  it('should report active session count', () => {
    const config = makeTestConfig();
    const pool = new SessionPool(config, noopLogger);

    expect(pool.getActiveCount()).toBe(0);

    pool.getOrCreateSession('/project-1');
    expect(pool.getActiveCount()).toBe(1);

    pool.getOrCreateSession('/project-2');
    expect(pool.getActiveCount()).toBe(2);
  });

  it('should close specific session', () => {
    const config = makeTestConfig();
    const pool = new SessionPool(config, noopLogger);

    const session = pool.getOrCreateSession('/project-1');
    expect(pool.getActiveCount()).toBe(1);

    pool.closeSession(session.id);
    expect(pool.getActiveCount()).toBe(0);
  });
});

// ============================================================================
// Scenario 7: Daemon already running
// ============================================================================

describe('Scenario 7: Daemon already running', () => {
  it('should detect running daemon via PID file', () => {
    const config = makeTestConfig();

    // Write current PID (simulates running daemon)
    fs.writeFileSync(config.pidFile, String(process.pid));

    expect(VibeDaemon.isRunning(config)).toBe(true);

    // Cleanup
    fs.unlinkSync(config.pidFile);
  });
});

// ============================================================================
// Scenario 8: Zombie process detection
// ============================================================================

describe('Scenario 8: Zombie process detection', () => {
  it('should detect stale PID file with non-existent process', () => {
    const config = makeTestConfig();

    // Write a PID that doesn't exist (very high number)
    fs.writeFileSync(config.pidFile, '999999999');

    expect(VibeDaemon.isRunning(config)).toBe(false);

    // PID file should still exist (readPid is passive)
    // But getInstance will clean it up on start
    fs.unlinkSync(config.pidFile);
  });

  it('should return null for invalid PID file content', () => {
    const config = makeTestConfig();

    fs.writeFileSync(config.pidFile, 'not-a-number');

    expect(VibeDaemon.readPid(config)).toBe(null);

    fs.unlinkSync(config.pidFile);
  });
});

// ============================================================================
// Scenario 9: Session failure recovery
// ============================================================================

describe('Scenario 9: Session failure recovery', () => {
  it('should handle session request queue', async () => {
    const config = makeTestConfig();
    const pool = new SessionPool(config, noopLogger);

    const session = pool.getOrCreateSession('/project');
    const result = await pool.sendRequest(session.id, 'test message');

    expect(result).toContain('Request received');
  });

  it('should reject request for unknown session', async () => {
    const config = makeTestConfig();
    const pool = new SessionPool(config, noopLogger);

    await expect(pool.sendRequest('unknown-id', 'test')).rejects.toThrow('Session not found');
  });
});

// ============================================================================
// Scenario 10: IPC timeout handling
// ============================================================================

describe('Scenario 10: IPC timeout handling', () => {
  it('should timeout slow method execution', async () => {
    const config = makeTestConfig();
    config.ipcTimeoutMs = 500; // Very short timeout
    const ipc = new DaemonIPC(config, noopLogger);

    ipc.registerMethod('test.slow', async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return 'done';
    });

    const token = await ipc.generateAuthToken();
    await ipc.start();

    await expect(
      DaemonIPC.sendRequest(config.socketPath, 'test.slow', undefined, token, 3000)
    ).rejects.toThrow();

    await ipc.stop();
  });

  it('should timeout client connection', async () => {
    // Connect to non-existent socket should fail
    await expect(
      DaemonIPC.sendRequest('/tmp/nonexistent-vibe.sock', 'test', undefined, undefined, 1000)
    ).rejects.toThrow();
  });
});

// ============================================================================
// VibeDaemon Integration
// ============================================================================

describe('VibeDaemon singleton', () => {
  it('should create singleton instance', () => {
    const config = makeTestConfig();
    const daemon1 = VibeDaemon.getInstance(config);
    const daemon2 = VibeDaemon.getInstance();

    expect(daemon1).toBe(daemon2);

    VibeDaemon.resetInstance();
  });

  it('should provide health info', () => {
    const config = makeTestConfig();
    const daemon = VibeDaemon.getInstance(config);
    const health = daemon.getHealth();

    expect(health.version).toBe('0.1.0');
    expect(health.pid).toBe(process.pid);

    VibeDaemon.resetInstance();
  });
});
