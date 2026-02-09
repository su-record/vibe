/**
 * VibeDaemon - Main Daemon Class (Singleton)
 * Phase 1: Agent Engine
 *
 * Features:
 * - Unix socket server with JSON-RPC
 * - PID file management
 * - Health check endpoint
 * - Logging with rotation (7 days)
 * - Session pool management
 * - Graceful shutdown
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  DaemonConfig,
  DaemonHealth,
  DaemonEvent,
  DaemonEventListener,
  LogLevel,
  LogEntry,
  RpcMethodRegistry,
} from './types.js';
import { DaemonIPC } from './DaemonIPC.js';
import { SessionPool } from './SessionPool.js';
import { InterfaceManager } from './InterfaceManager.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const VERSION = '0.1.0';

const DEFAULT_CONFIG: DaemonConfig = {
  socketPath: path.join(VIBE_DIR, 'daemon.sock'),
  pidFile: path.join(VIBE_DIR, 'daemon.pid'),
  tokenFile: path.join(VIBE_DIR, 'daemon.token'),
  logDir: path.join(VIBE_DIR, 'logs'),
  logFile: path.join(VIBE_DIR, 'logs', 'daemon.log'),
  maxPayloadBytes: 1024 * 1024, // 1MB
  ipcTimeoutMs: 30000,
  gracefulShutdownMs: 10000,
  maxGlobalSessions: 5,
  maxSessionsPerProject: 1,
  idleSessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  sessionReconnectMaxRetries: 3,
};

export class VibeDaemon {
  private static instance: VibeDaemon | null = null;

  private readonly config: DaemonConfig;
  private ipc: DaemonIPC;
  private sessionPool: SessionPool;
  private interfaceManager: InterfaceManager;
  private startTime: number = 0;
  private stopping = false;
  private listeners: DaemonEventListener[] = [];
  private logStream: fs.WriteStream | null = null;

  private constructor(config?: Partial<DaemonConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ipc = new DaemonIPC(this.config, this.log.bind(this));
    this.sessionPool = new SessionPool(this.config, this.log.bind(this));
    this.interfaceManager = new InterfaceManager(this.log.bind(this));
  }

  /** Get or create singleton instance */
  static getInstance(config?: Partial<DaemonConfig>): VibeDaemon {
    if (!VibeDaemon.instance) {
      VibeDaemon.instance = new VibeDaemon(config);
    }
    return VibeDaemon.instance;
  }

  /** Reset singleton (for testing) */
  static resetInstance(): void {
    VibeDaemon.instance = null;
  }

  /** Get daemon config */
  getConfig(): DaemonConfig {
    return { ...this.config };
  }

  /** Get session pool */
  getSessionPool(): SessionPool {
    return this.sessionPool;
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /** Start the daemon */
  async start(): Promise<void> {
    this.ensureDirectories();
    this.initLogging();

    // Check for existing daemon
    if (this.isAlreadyRunning()) {
      throw new Error('Daemon is already running');
    }

    this.startTime = Date.now();

    // Generate auth token
    await this.ipc.generateAuthToken();

    // Register RPC methods
    this.registerBuiltinMethods();

    // Start IPC server
    await this.ipc.start();

    // Start session pool
    this.sessionPool.start();

    // Write PID file
    this.writePidFile();

    // Setup signal handlers
    this.setupSignalHandlers();

    // Start enabled interfaces (slack, imessage, telegram, etc.)
    await this.interfaceManager.startEnabledInterfaces();

    this.log('info', `Vibe Daemon v${VERSION} started (PID: ${process.pid})`);
    this.emit({ type: 'started', pid: process.pid });
  }

  /** Stop the daemon gracefully */
  async stop(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;

    this.log('info', 'Daemon stopping...');
    this.emit({ type: 'stopping' });

    // Stop accepting new connections, wait for ongoing work
    const shutdownPromise = (async () => {
      await this.interfaceManager.stopAll();
      await this.sessionPool.stop();
      await this.ipc.stop();
    })();

    // Enforce timeout
    await Promise.race([
      shutdownPromise,
      new Promise<void>((resolve) =>
        setTimeout(() => {
          this.log('warn', 'Graceful shutdown timeout, forcing stop');
          resolve();
        }, this.config.gracefulShutdownMs)
      ),
    ]);

    this.removePidFile();
    this.closeLogging();
    this.emit({ type: 'stopped' });
    this.log('info', 'Daemon stopped');

    VibeDaemon.instance = null;
  }

  // ========================================================================
  // Health & Status
  // ========================================================================

  /** Get daemon health info */
  getHealth(): DaemonHealth {
    return {
      status: this.stopping ? 'stopping' : 'running',
      uptime: Date.now() - this.startTime,
      memory: process.memoryUsage(),
      activeSessions: this.sessionPool.getActiveCount(),
      version: VERSION,
      pid: process.pid,
    };
  }

  // ========================================================================
  // Events
  // ========================================================================

  /** Subscribe to daemon events */
  on(listener: DaemonEventListener): void {
    this.listeners.push(listener);
  }

  /** Remove event listener */
  off(listener: DaemonEventListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  private emit(event: DaemonEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        this.log('error', 'Event listener error', err);
      }
    }
  }

  // ========================================================================
  // RPC Methods Registration
  // ========================================================================

  /** Register additional RPC methods (for Phase 2+) */
  registerMethods(methods: RpcMethodRegistry): void {
    this.ipc.registerMethods(methods);
  }

  private registerBuiltinMethods(): void {
    this.ipc.registerMethod('daemon.health', () => {
      return {
        ...this.getHealth(),
        interfaces: this.interfaceManager.getActiveInterfaces(),
      };
    });

    this.ipc.registerMethod('daemon.stop', async () => {
      // Schedule stop after responding
      setTimeout(() => this.stop(), 100);
      return { success: true };
    });

    this.ipc.registerMethod('daemon.sessions', () => {
      return this.sessionPool.getActiveSessions();
    });
  }

  // ========================================================================
  // PID Management
  // ========================================================================

  private writePidFile(): void {
    fs.writeFileSync(this.config.pidFile, String(process.pid), { mode: 0o600 });
  }

  private removePidFile(): void {
    try {
      if (fs.existsSync(this.config.pidFile)) {
        fs.unlinkSync(this.config.pidFile);
      }
    } catch {
      // Ignore
    }
  }

  /** Check if a daemon is already running by PID file */
  private isAlreadyRunning(): boolean {
    try {
      if (!fs.existsSync(this.config.pidFile)) return false;

      const pid = parseInt(fs.readFileSync(this.config.pidFile, 'utf-8').trim(), 10);
      if (isNaN(pid)) {
        // Invalid PID file, clean it up
        this.removePidFile();
        return false;
      }

      // Check if process exists
      try {
        process.kill(pid, 0); // Signal 0 = check existence
        return true; // Process exists
      } catch {
        // Process doesn't exist - stale PID file
        this.log('info', `Removing stale PID file (PID ${pid} not running)`);
        this.removePidFile();
        return false;
      }
    } catch {
      return false;
    }
  }

  /** Static helper: Read PID from file */
  static readPid(config?: Partial<DaemonConfig>): number | null {
    const pidFile = config?.pidFile || DEFAULT_CONFIG.pidFile;
    try {
      if (!fs.existsSync(pidFile)) return null;
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  /** Static helper: Check if daemon is running */
  static isRunning(config?: Partial<DaemonConfig>): boolean {
    const pid = VibeDaemon.readPid(config);
    if (pid === null) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /** Static helper: Get daemon status */
  static async getStatus(config?: Partial<DaemonConfig>): Promise<{
    running: boolean;
    pid?: number;
    health?: DaemonHealth;
  }> {
    const merged = { ...DEFAULT_CONFIG, ...config };
    const pid = VibeDaemon.readPid(merged);

    if (pid === null) return { running: false };

    try {
      process.kill(pid, 0);
    } catch {
      return { running: false };
    }

    // Try to get health via IPC
    try {
      const token = fs.existsSync(merged.tokenFile)
        ? fs.readFileSync(merged.tokenFile, 'utf-8').trim()
        : undefined;

      const health = (await DaemonIPC.sendRequest(
        merged.socketPath,
        'daemon.health',
        undefined,
        token,
        5000
      )) as DaemonHealth;

      return { running: true, pid, health };
    } catch {
      return { running: true, pid };
    }
  }

  // ========================================================================
  // Logging
  // ========================================================================

  private initLogging(): void {
    // Ensure log directory
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true, mode: 0o700 });
    }

    // Rotate old logs
    this.rotateLogs();

    // Open log file
    this.logStream = fs.createWriteStream(this.config.logFile, { flags: 'a' });
  }

  private closeLogging(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }

  private rotateLogs(): void {
    const maxAgeDays = 7;
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    try {
      const files = fs.readdirSync(this.config.logDir);
      for (const file of files) {
        if (!file.startsWith('daemon') || !file.endsWith('.log')) continue;
        const filePath = path.join(this.config.logDir, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      }
    } catch {
      // Ignore rotation errors
    }
  }

  log(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data !== undefined ? data : undefined,
    };

    const line = JSON.stringify(entry);

    if (this.logStream) {
      this.logStream.write(line + '\n');
    }

    // Also log to stderr in development
    if (process.env.VIBE_DAEMON_DEBUG === '1') {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
      process.stderr.write(`${prefix} ${message}\n`);
    }
  }

  // ========================================================================
  // Setup
  // ========================================================================

  private ensureDirectories(): void {
    const dirs = [VIBE_DIR, this.config.logDir];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
    }
  }

  private setupSignalHandlers(): void {
    const handler = () => {
      this.stop().then(() => process.exit(0));
    };

    process.on('SIGTERM', handler);
    process.on('SIGINT', handler);
    process.on('uncaughtException', (err) => {
      this.log('error', 'Uncaught exception', err.message);
      this.stop().then(() => process.exit(1));
    });
    process.on('unhandledRejection', (reason) => {
      this.log('error', 'Unhandled rejection', String(reason));
    });
  }
}

// ============================================================================
// Daemon Entry Point (for child_process.fork)
// ============================================================================

/** Start daemon when this file is run directly */
if (process.argv[1] && process.argv[1].endsWith('VibeDaemon.js')) {
  const daemon = VibeDaemon.getInstance();
  daemon.start().catch((err) => {
    process.stderr.write(`Failed to start daemon: ${err.message}\n`);
    process.exit(1);
  });
}
