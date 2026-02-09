/**
 * IMessageRpcClient - JSON-RPC 2.0 client for `imsg rpc` subprocess
 * Phase 4: External Interface
 *
 * Spawns `imsg rpc` as a child process and communicates via stdin/stdout.
 * Based on openclaw's proven approach - avoids Full Disk Access requirement
 * by delegating database access to the `imsg` binary.
 */

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';

export interface RpcNotification {
  method: string;
  params?: unknown;
}

export interface RpcClientOptions {
  cliPath?: string;
  dbPath?: string;
  onNotification?: (msg: RpcNotification) => void;
  onError?: (msg: string) => void;
}

interface RpcResponse {
  jsonrpc?: string;
  id?: string | number | null;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
  method?: string;
  params?: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 10000;

export class IMessageRpcClient {
  private readonly cliPath: string;
  private readonly dbPath?: string;
  private readonly onNotification?: (msg: RpcNotification) => void;
  private readonly onError?: (msg: string) => void;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly closed: Promise<void>;
  private closedResolve: (() => void) | null = null;
  private child: ChildProcessWithoutNullStreams | null = null;
  private reader: Interface | null = null;
  private nextId = 1;

  constructor(opts: RpcClientOptions = {}) {
    this.cliPath = opts.cliPath?.trim() || 'imsg';
    this.dbPath = opts.dbPath?.trim() || undefined;
    this.onNotification = opts.onNotification;
    this.onError = opts.onError;
    this.closed = new Promise((resolve) => {
      this.closedResolve = resolve;
    });
  }

  async start(): Promise<void> {
    if (this.child) return;

    const args = ['rpc'];
    if (this.dbPath) {
      args.push('--db', this.dbPath);
    }

    const child = spawn(this.cliPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    this.reader = createInterface({ input: child.stdout });

    this.reader.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      this.handleLine(trimmed);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        this.onError?.(`imsg rpc stderr: ${line.trim()}`);
      }
    });

    child.on('error', (err) => {
      this.failAll(err instanceof Error ? err : new Error(String(err)));
      this.closedResolve?.();
    });

    child.on('close', (code, signal) => {
      if (code !== 0 && code !== null) {
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        this.failAll(new Error(`imsg rpc exited (${reason})`));
      } else {
        this.failAll(new Error('imsg rpc closed'));
      }
      this.closedResolve?.();
    });
  }

  async stop(): Promise<void> {
    if (!this.child) return;

    this.reader?.close();
    this.reader = null;
    this.child.stdin?.end();
    const child = this.child;
    this.child = null;

    await Promise.race([
      this.closed,
      new Promise<void>((resolve) => {
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGTERM');
          }
          resolve();
        }, 500);
      }),
    ]);
  }

  async waitForClose(): Promise<void> {
    await this.closed;
  }

  async request<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T> {
    if (!this.child || !this.child.stdin) {
      throw new Error('imsg rpc not running');
    }

    const id = this.nextId++;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params: params ?? {},
    };
    const line = `${JSON.stringify(payload)}\n`;
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const response = new Promise<T>((resolve, reject) => {
      const key = String(id);
      const timer = timeout > 0
        ? setTimeout(() => {
            this.pending.delete(key);
            reject(new Error(`imsg rpc timeout (${method})`));
          }, timeout)
        : undefined;
      this.pending.set(key, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
    });

    this.child.stdin.write(line);
    return await response;
  }

  private handleLine(line: string): void {
    let parsed: RpcResponse;
    try {
      parsed = JSON.parse(line) as RpcResponse;
    } catch {
      this.onError?.(`imsg rpc: failed to parse: ${line}`);
      return;
    }

    // Response to a pending request
    if (parsed.id !== undefined && parsed.id !== null) {
      const key = String(parsed.id);
      const pending = this.pending.get(key);
      if (!pending) return;

      if (pending.timer) clearTimeout(pending.timer);
      this.pending.delete(key);

      if (parsed.error) {
        const msg = parsed.error.message ?? 'imsg rpc error';
        pending.reject(new Error(msg));
        return;
      }
      pending.resolve(parsed.result);
      return;
    }

    // Notification (no id)
    if (parsed.method) {
      this.onNotification?.({
        method: parsed.method,
        params: parsed.params,
      });
    }
  }

  private failAll(err: Error): void {
    for (const [key, pending] of this.pending.entries()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(err);
      this.pending.delete(key);
    }
  }
}

export async function createIMessageRpcClient(
  opts: RpcClientOptions = {},
): Promise<IMessageRpcClient> {
  const client = new IMessageRpcClient(opts);
  await client.start();
  return client;
}
