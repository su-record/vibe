/**
 * DaemonIPC - JSON-RPC 2.0 over Unix Socket
 * Phase 1: Agent Engine
 *
 * Features:
 * - NDJSON (newline-delimited JSON) framing
 * - Max payload 1MB
 * - Auth token verification
 * - Request timeout (30s)
 */

import * as net from 'node:net';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  RPC_ERROR_CODES,
  RpcMethodHandler,
  RpcMethodRegistry,
  DaemonConfig,
  LogLevel,
} from './types.js';

export class DaemonIPC {
  private server: net.Server | null = null;
  private methods: RpcMethodRegistry = {};
  private authToken: string = '';
  private readonly config: DaemonConfig;
  private logger: (level: LogLevel, message: string, data?: unknown) => void;

  constructor(
    config: DaemonConfig,
    logger: (level: LogLevel, message: string, data?: unknown) => void
  ) {
    this.config = config;
    this.logger = logger;
  }

  /** Register an RPC method handler */
  registerMethod(name: string, handler: RpcMethodHandler): void {
    this.methods[name] = handler;
  }

  /** Register multiple methods at once */
  registerMethods(methods: RpcMethodRegistry): void {
    for (const [name, handler] of Object.entries(methods)) {
      this.methods[name] = handler;
    }
  }

  /** Generate and store auth token */
  async generateAuthToken(): Promise<string> {
    this.authToken = crypto.randomBytes(32).toString('hex');
    const tokenDir = path.dirname(this.config.tokenFile);
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(this.config.tokenFile, this.authToken, { mode: 0o600 });
    this.logger('info', 'Auth token generated');
    return this.authToken;
  }

  /** Load existing auth token */
  loadAuthToken(): string | null {
    try {
      if (fs.existsSync(this.config.tokenFile)) {
        this.authToken = fs.readFileSync(this.config.tokenFile, 'utf-8').trim();
        return this.authToken;
      }
    } catch {
      this.logger('warn', 'Failed to load auth token');
    }
    return null;
  }

  /** Start the IPC server on Unix socket */
  async start(): Promise<void> {
    // Security: check for symlink attack
    await this.safeCleanSocket();

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        this.logger('error', 'IPC server error', err);
        reject(err);
      });

      this.server.listen(this.config.socketPath, () => {
        // Set socket permissions to 0600
        try {
          fs.chmodSync(this.config.socketPath, 0o600);
        } catch {
          this.logger('warn', 'Could not set socket permissions');
        }
        this.logger('info', `IPC server listening on ${this.config.socketPath}`);
        resolve();
      });
    });
  }

  /** Stop the IPC server */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.cleanupSocket();
          this.cleanupToken();
          this.logger('info', 'IPC server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /** Send a JSON-RPC request to an existing daemon (client mode) */
  static async sendRequest(
    socketPath: string,
    method: string,
    params?: Record<string, unknown>,
    authToken?: string,
    timeoutMs: number = 30000
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(socketPath);
      let buffer = '';
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(new Error(`IPC request timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method,
        params,
        id: crypto.randomUUID(),
        auth: authToken,
      };

      socket.on('connect', () => {
        socket.write(JSON.stringify(request) + '\n');
      });

      socket.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const response: JsonRpcResponse = JSON.parse(line);
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              socket.destroy();
              if (response.error) {
                const err = new Error(response.error.message);
                (err as unknown as Record<string, unknown>).code = response.error.code;
                reject(err);
              } else {
                resolve(response.result);
              }
            }
          } catch {
            // Ignore parse errors in partial data
          }
        }
      });

      socket.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      socket.on('close', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error('Connection closed before response'));
        }
      });
    });
  }

  // ========================================================================
  // Private
  // ========================================================================

  private handleConnection(socket: net.Socket): void {
    this.logger('debug', 'Client connected');
    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();

      // Check payload size
      if (buffer.length > this.config.maxPayloadBytes) {
        const errorResp = this.makeError(
          null,
          RPC_ERROR_CODES.PARSE_ERROR,
          'Payload exceeds maximum size'
        );
        socket.write(JSON.stringify(errorResp) + '\n');
        socket.destroy();
        return;
      }

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        this.processMessage(line, socket);
      }
    });

    socket.on('error', (err) => {
      this.logger('debug', 'Client connection error', err.message);
    });

    socket.on('close', () => {
      this.logger('debug', 'Client disconnected');
    });
  }

  private async processMessage(raw: string, socket: net.Socket): Promise<void> {
    let request: JsonRpcRequest;

    try {
      request = JSON.parse(raw);
    } catch {
      const errorResp = this.makeError(null, RPC_ERROR_CODES.PARSE_ERROR, 'Parse error');
      socket.write(JSON.stringify(errorResp) + '\n');
      return;
    }

    // Validate JSON-RPC structure
    if (request.jsonrpc !== '2.0' || !request.method || request.id === undefined) {
      const errorResp = this.makeError(
        request.id ?? null,
        RPC_ERROR_CODES.INVALID_REQUEST,
        'Invalid JSON-RPC request'
      );
      socket.write(JSON.stringify(errorResp) + '\n');
      return;
    }

    // Auth check
    if (this.authToken && request.auth !== this.authToken) {
      const errorResp = this.makeError(
        request.id,
        RPC_ERROR_CODES.AUTH_FAILED,
        'Authentication failed'
      );
      socket.write(JSON.stringify(errorResp) + '\n');
      return;
    }

    // Find method
    const handler = this.methods[request.method];
    if (!handler) {
      const errorResp = this.makeError(
        request.id,
        RPC_ERROR_CODES.METHOD_NOT_FOUND,
        `Method not found: ${request.method}`
      );
      socket.write(JSON.stringify(errorResp) + '\n');
      return;
    }

    // Execute with timeout
    try {
      const result = await Promise.race([
        Promise.resolve(handler(request.params)),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Method execution timeout')),
            this.config.ipcTimeoutMs
          )
        ),
      ]);

      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        result,
        id: request.id,
      };
      socket.write(JSON.stringify(response) + '\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      const code = message.includes('timeout')
        ? RPC_ERROR_CODES.TIMEOUT
        : RPC_ERROR_CODES.INTERNAL_ERROR;

      const errorResp = this.makeError(request.id, code, message);
      socket.write(JSON.stringify(errorResp) + '\n');
    }
  }

  private makeError(
    id: string | number | null,
    code: number,
    message: string
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      error: { code, message },
      id,
    };
  }

  private async safeCleanSocket(): Promise<void> {
    const socketPath = this.config.socketPath;

    // Windows Named Pipes are managed by the OS — no file cleanup needed,
    // but we still check if another daemon is already listening.
    if (process.platform === 'win32') {
      try {
        await DaemonIPC.sendRequest(socketPath, 'daemon.health', undefined, undefined, 2000);
        throw new Error('Another daemon is already running');
      } catch (err) {
        if (err instanceof Error && err.message === 'Another daemon is already running') {
          throw err;
        }
        // No daemon listening — safe to proceed
      }
      return;
    }

    // Unix: file-based socket cleanup
    try {
      const stat = fs.lstatSync(socketPath);
      if (stat.isSymbolicLink()) {
        this.logger('warn', 'Symlink detected at socket path, removing');
        fs.unlinkSync(socketPath);
        return;
      }
      if (stat.isSocket()) {
        // Check if another daemon is listening
        try {
          await DaemonIPC.sendRequest(socketPath, 'daemon.health', undefined, undefined, 2000);
          throw new Error('Another daemon is already running');
        } catch (err) {
          if (err instanceof Error && err.message === 'Another daemon is already running') {
            throw err;
          }
          // Socket exists but no one listening - stale socket
          fs.unlinkSync(socketPath);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'Another daemon is already running') {
        throw err;
      }
      // File doesn't exist - that's fine
    }
  }

  private cleanupSocket(): void {
    // Windows Named Pipes are auto-cleaned by the OS when the server closes
    if (process.platform === 'win32') return;

    try {
      if (fs.existsSync(this.config.socketPath)) {
        fs.unlinkSync(this.config.socketPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private cleanupToken(): void {
    try {
      if (fs.existsSync(this.config.tokenFile)) {
        fs.unlinkSync(this.config.tokenFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
