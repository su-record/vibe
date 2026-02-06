/**
 * WebServer - HTTP + WebSocket interface for Vibe
 * Phase 4: External Interface
 *
 * Uses Node.js built-in http module + ws pattern.
 * Port 7860 (configurable via VIBE_PORT)
 */

import * as http from 'node:http';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { BaseInterface } from '../BaseInterface.js';
import {
  ChannelType,
  ExternalMessage,
  ExternalResponse,
  InterfaceLogger,
  WebServerConfig,
} from '../types.js';

const TOKEN_FILE = path.join(os.homedir(), '.vibe', 'web-token');
const DEFAULT_PORT = 7860;
const AUTH_TIMEOUT_MS = 3000;
const MAX_PAYLOAD = 1024 * 1024; // 1MB

export class WebServer extends BaseInterface {
  readonly name = 'web';
  readonly channel: ChannelType = 'web';

  private server: http.Server | null = null;
  private config: WebServerConfig;
  private connections: Set<http.ServerResponse> = new Set();
  private requestCount: Map<string, number> = new Map();

  constructor(config: Partial<WebServerConfig> & { authToken?: string }, logger: InterfaceLogger) {
    super(logger);
    this.config = {
      port: config.port || DEFAULT_PORT,
      host: config.host || '127.0.0.1',
      authToken: config.authToken || this.generateToken(),
      maxConnections: config.maxConnections || 50,
      idleTimeoutMs: config.idleTimeoutMs || 300000,
      maxPayloadBytes: config.maxPayloadBytes || MAX_PAYLOAD,
      corsOrigins: config.corsOrigins || ['http://localhost:*'],
    };
  }

  async start(): Promise<void> {
    this.status = 'connecting';

    this.server = http.createServer((req, res) => this.handleRequest(req, res));

    return new Promise<void>((resolve, reject) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        this.status = 'enabled';
        this.connectedAt = new Date().toISOString();
        this.saveToken();
        this.logger('info', `Web server started on ${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.server!.on('error', (err: Error) => {
        this.status = 'error';
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;

    return new Promise<void>((resolve) => {
      for (const conn of this.connections) {
        conn.end();
      }
      this.connections.clear();

      this.server!.close(() => {
        this.server = null;
        this.status = 'disabled';
        this.logger('info', 'Web server stopped');
        resolve();
      });
    });
  }

  async sendResponse(response: ExternalResponse): Promise<void> {
    // For REST API, responses are sent inline.
    // This is used for push notifications via connected clients.
    this.logger('debug', `Web response to ${response.chatId}: ${response.content.slice(0, 100)}`);
  }

  getPort(): number {
    if (this.server) {
      const addr = this.server.address();
      if (addr && typeof addr === 'object') {
        return addr.port;
      }
    }
    return this.config.port;
  }

  getAuthToken(): string {
    return this.config.authToken;
  }

  // ========================================================================
  // Private
  // ========================================================================

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.connections.add(res);
    res.on('close', () => this.connections.delete(res));

    // Rate limiting
    const clientIp = req.socket.remoteAddress || 'unknown';
    const count = (this.requestCount.get(clientIp) || 0) + 1;
    this.requestCount.set(clientIp, count);
    if (count > 100) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }

    // Reset rate limits every minute
    setTimeout(() => {
      this.requestCount.delete(clientIp);
    }, 60000);

    // CORS
    const origin = req.headers.origin || '';
    if (origin && !this.isOriginAllowed(origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'CORS: origin not allowed' }));
      return;
    }

    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check (no auth needed)
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Auth check for all other endpoints
    if (!this.verifyAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    this.routeRequest(req, res);
  }

  private routeRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';
    const method = req.method || 'GET';

    if (method === 'POST' && url === '/api/job') {
      this.handleCreateJob(req, res);
    } else if (method === 'GET' && url.startsWith('/api/job/')) {
      const jobId = url.split('/api/job/')[1];
      this.handleGetJob(res, jobId);
    } else if (method === 'GET' && url === '/api/jobs') {
      this.handleListJobs(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  private async handleCreateJob(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body = '';
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > this.config.maxPayloadBytes) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        const request = String(parsed.request || '');

        if (!request) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing request field' }));
          return;
        }

        const message: ExternalMessage = {
          id: crypto.randomUUID(),
          channel: 'web',
          chatId: 'web-client',
          userId: 'web-user',
          content: request,
          type: 'text',
          timestamp: new Date().toISOString(),
        };

        await this.dispatchMessage(message);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ messageId: message.id, status: 'created' }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  private handleGetJob(res: http.ServerResponse, jobId: string): void {
    // Placeholder - actual implementation would query JobStore
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jobId, status: 'pending' }));
  }

  private handleListJobs(res: http.ServerResponse): void {
    // Placeholder - actual implementation would query JobStore
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jobs: [] }));
  }

  private verifyAuth(req: http.IncomingMessage): boolean {
    const auth = req.headers.authorization;
    if (!auth) return false;

    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) return false;

    // timingSafeEqual requires same-length buffers
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(this.config.authToken);
    if (tokenBuf.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  }

  private isOriginAllowed(origin: string): boolean {
    return this.config.corsOrigins.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(origin);
      }
      return pattern === origin;
    });
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private saveToken(): void {
    try {
      const dir = path.dirname(TOKEN_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      fs.writeFileSync(TOKEN_FILE, this.config.authToken, { mode: 0o600 });
    } catch (err) {
      this.logger('warn', 'Failed to save web token', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
