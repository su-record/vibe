/**
 * ClaudeCodeBridge - Communicate with Claude Code via stream-json
 * Phase 4: External Interface
 *
 * Uses `claude -p --input-format stream-json --output-format stream-json --verbose`
 */

import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import {
  ClaudeStreamMessage,
  ClaudeSessionConfig,
  PermissionRequest,
  InterfaceLogger,
} from './types.js';

const CLAUDE_BIN = 'claude';

export class ClaudeCodeBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;
  private logger: InterfaceLogger;
  private config: ClaudeSessionConfig;
  private buffer: string = '';
  private restartCount: number = 0;
  private running: boolean = false;

  constructor(config: ClaudeSessionConfig, logger: InterfaceLogger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  /** Start a new Claude Code session */
  async start(): Promise<void> {
    if (this.running) return;

    const args = [
      '-p',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
    ];

    if (this.sessionId) {
      args.push('--resume', this.sessionId);
    }

    try {
      this.process = spawn(CLAUDE_BIN, args, {
        cwd: this.config.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      this.running = true;
      this.restartCount = 0;

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleData(data.toString());
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        this.logger('debug', `Claude stderr: ${data.toString().trim()}`);
      });

      this.process.on('close', (code: number | null) => {
        this.running = false;
        if (code !== 0 && code !== null) {
          this.logger('error', `Claude Code exited with code ${code}`);
          this.emit('crash', code);
          this.handleCrash(code);
        } else {
          this.emit('close');
        }
      });

      this.process.on('error', (err: Error) => {
        this.running = false;
        this.logger('error', `Claude Code process error: ${err.message}`);
        this.emit('error', err);
      });

      this.logger('info', 'Claude Code bridge started');
    } catch (err) {
      this.running = false;
      throw err;
    }
  }

  /** Send a user message */
  sendMessage(content: string): void {
    if (!this.process?.stdin?.writable) {
      throw new Error('Claude Code bridge not started');
    }

    const message: ClaudeStreamMessage = {
      type: 'user',
      message: {
        role: 'user',
        content,
      },
    };

    this.process.stdin.write(JSON.stringify(message) + '\n');
    this.logger('debug', `Sent message to Claude Code: ${content.slice(0, 100)}`);
  }

  /** Send permission response */
  sendPermissionResponse(approved: boolean): void {
    if (!this.process?.stdin?.writable) {
      throw new Error('Claude Code bridge not started');
    }

    const message = {
      type: 'permission_response',
      approved,
    };

    this.process.stdin.write(JSON.stringify(message) + '\n');
  }

  /** Stop the bridge */
  async stop(): Promise<void> {
    if (!this.process) return;

    this.running = false;

    if (this.process.stdin?.writable) {
      this.process.stdin.end();
    }

    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.process?.kill('SIGKILL');
        resolve();
      }, 5000);

      this.process!.on('close', () => {
        clearTimeout(timer);
        this.process = null;
        resolve();
      });

      this.process!.kill('SIGTERM');
    });
  }

  /** Get session ID for resumption */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /** Set session ID for multi-turn */
  setSessionId(id: string): void {
    this.sessionId = id;
  }

  isRunning(): boolean {
    return this.running;
  }

  // ========================================================================
  // Private
  // ========================================================================

  private handleData(data: string): void {
    this.buffer += data;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as ClaudeStreamMessage;
        this.handleMessage(message);
      } catch {
        this.logger('debug', `Non-JSON line from Claude: ${line.slice(0, 200)}`);
      }
    }
  }

  private handleMessage(message: ClaudeStreamMessage): void {
    switch (message.type) {
      case 'assistant':
        this.emit('response', message);
        break;

      case 'result':
        if (message.subtype === 'success') {
          this.emit('result', message.result || '');
        } else {
          this.emit('error', new Error(message.result || 'Unknown error'));
        }
        break;

      case 'permission_request':
        if (message.permission) {
          const request: PermissionRequest = {
            jobId: '',
            sessionId: this.sessionId || '',
            tool: message.permission.tool,
            description: message.permission.description,
            timestamp: new Date().toISOString(),
          };
          this.emit('permission_request', request);
        }
        break;

      default:
        this.emit('message', message);
    }
  }

  private async handleCrash(exitCode: number): Promise<void> {
    if (this.restartCount >= this.config.maxRetries) {
      this.logger('error', `Claude Code crashed ${this.restartCount} times, giving up`);
      this.emit('fatal', exitCode);
      return;
    }

    this.restartCount++;
    this.logger('warn', `Restarting Claude Code (attempt ${this.restartCount}/${this.config.maxRetries})`);

    await new Promise((r) => setTimeout(r, 1000 * this.restartCount));

    try {
      await this.start();
    } catch (err) {
      this.logger('error', 'Failed to restart Claude Code', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.emit('fatal', exitCode);
    }
  }
}
