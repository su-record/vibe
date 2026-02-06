/**
 * WebhookHandler - Handle incoming webhooks
 * Phase 4: External Interface
 *
 * Supports GitHub and GitLab webhook verification.
 * HMAC-SHA256 signature verification with replay protection.
 */

import * as crypto from 'node:crypto';
import * as http from 'node:http';
import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { BaseInterface } from '../BaseInterface.js';
import {
  ChannelType,
  ExternalMessage,
  ExternalResponse,
  InterfaceLogger,
  WebhookConfig,
  WebhookEvent,
  WebhookProvider,
} from '../types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const NONCE_DB_PATH = path.join(VIBE_DIR, 'webhook-nonces.db');
const NONCE_RETENTION_HOURS = 1;

export class WebhookHandler extends BaseInterface {
  readonly name = 'webhook';
  readonly channel: ChannelType = 'webhook';

  private server: http.Server | null = null;
  private configs: Map<string, WebhookConfig> = new Map();
  private nonceDb: Database.Database | null = null;
  private port: number;

  constructor(port: number, logger: InterfaceLogger) {
    super(logger);
    this.port = port;
  }

  /** Add a webhook configuration */
  addWebhook(config: WebhookConfig): void {
    this.configs.set(config.name, config);
    this.logger('info', `Webhook added: ${config.name} (${config.provider})`);
  }

  /** Remove a webhook configuration */
  removeWebhook(name: string): boolean {
    return this.configs.delete(name);
  }

  /** List all webhook configurations */
  listWebhooks(): WebhookConfig[] {
    return Array.from(this.configs.values());
  }

  async start(): Promise<void> {
    this.initNonceDb();
    this.status = 'connecting';

    this.server = http.createServer((req, res) => this.handleRequest(req, res));

    return new Promise<void>((resolve, reject) => {
      this.server!.listen(this.port, '127.0.0.1', () => {
        this.status = 'enabled';
        this.connectedAt = new Date().toISOString();
        this.logger('info', `Webhook server started on port ${this.port}`);
        resolve();
      });

      this.server!.on('error', (err: Error) => {
        this.status = 'error';
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server!.close(() => {
          this.server = null;
          this.status = 'disabled';
          if (this.nonceDb) {
            this.nonceDb.close();
            this.nonceDb = null;
          }
          resolve();
        });
      });
    }
  }

  async sendResponse(response: ExternalResponse): Promise<void> {
    this.logger('debug', `Webhook response: ${response.content.slice(0, 100)}`);
  }

  /** Verify a webhook signature */
  verifySignature(
    rawBody: Buffer,
    signature: string,
    secret: string,
    provider: WebhookProvider
  ): boolean {
    try {
      if (provider === 'github') {
        const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      }

      if (provider === 'gitlab') {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(secret));
      }

      // Custom: HMAC-SHA256
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  /** Check if a delivery ID has already been processed (replay protection) */
  isReplay(deliveryId: string): boolean {
    if (!this.nonceDb) return false;

    const row = this.nonceDb.prepare(
      'SELECT id FROM nonces WHERE delivery_id = ?'
    ).get(deliveryId);

    return !!row;
  }

  /** Record a processed delivery ID */
  recordNonce(deliveryId: string): void {
    if (!this.nonceDb) return;

    this.nonceDb.prepare(
      'INSERT OR IGNORE INTO nonces (delivery_id, created_at) VALUES (?, ?)'
    ).run(deliveryId, new Date().toISOString());
  }

  /** Cleanup old nonces */
  cleanupNonces(): number {
    if (!this.nonceDb) return 0;

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - NONCE_RETENTION_HOURS);

    const result = this.nonceDb.prepare(
      'DELETE FROM nonces WHERE created_at < ?'
    ).run(cutoff.toISOString());

    return result.changes;
  }

  // ========================================================================
  // Private
  // ========================================================================

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        res.writeHead(413);
        res.end('Payload too large');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const rawBody = Buffer.concat(chunks);
      this.processWebhook(req, rawBody, res);
    });
  }

  private processWebhook(
    req: http.IncomingMessage,
    rawBody: Buffer,
    res: http.ServerResponse
  ): void {
    // Detect provider
    const provider = this.detectProvider(req);
    const deliveryId = this.getDeliveryId(req, provider);
    const signature = this.getSignature(req, provider);
    const eventType = this.getEventType(req, provider);

    // Find matching config
    const config = this.findConfig(provider);
    if (!config) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No webhook configured for this provider' }));
      return;
    }

    // Verify signature
    if (signature && !this.verifySignature(rawBody, signature, config.secret, provider)) {
      this.logger('warn', `Invalid webhook signature from ${provider}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid signature' }));
      return;
    }

    // Replay protection
    if (deliveryId && this.isReplay(deliveryId)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'already_processed' }));
      return;
    }

    if (deliveryId) {
      this.recordNonce(deliveryId);
    }

    // Parse payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const event: WebhookEvent = {
      provider,
      event: eventType,
      deliveryId: deliveryId || crypto.randomUUID(),
      payload,
      verified: !!signature,
    };

    // Create external message
    const message: ExternalMessage = {
      id: crypto.randomUUID(),
      channel: 'webhook',
      chatId: config.name,
      userId: provider,
      content: this.eventToIntent(event),
      type: 'text',
      metadata: { event: event.event, provider, deliveryId: event.deliveryId },
      timestamp: new Date().toISOString(),
    };

    this.dispatchMessage(message);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'accepted', deliveryId: event.deliveryId }));
  }

  private detectProvider(req: http.IncomingMessage): WebhookProvider {
    if (req.headers['x-github-event']) return 'github';
    if (req.headers['x-gitlab-event']) return 'gitlab';
    return 'custom';
  }

  private getDeliveryId(req: http.IncomingMessage, provider: WebhookProvider): string | undefined {
    if (provider === 'github') return req.headers['x-github-delivery'] as string;
    if (provider === 'gitlab') return req.headers['x-gitlab-delivery'] as string;
    return req.headers['x-delivery-id'] as string;
  }

  private getSignature(req: http.IncomingMessage, provider: WebhookProvider): string | undefined {
    if (provider === 'github') return req.headers['x-hub-signature-256'] as string;
    if (provider === 'gitlab') return req.headers['x-gitlab-token'] as string;
    return req.headers['x-signature'] as string;
  }

  private getEventType(req: http.IncomingMessage, provider: WebhookProvider): string {
    if (provider === 'github') return String(req.headers['x-github-event'] || 'unknown');
    if (provider === 'gitlab') return String(req.headers['x-gitlab-event'] || 'unknown');
    return String(req.headers['x-event-type'] || 'unknown');
  }

  private findConfig(provider: WebhookProvider): WebhookConfig | undefined {
    for (const config of this.configs.values()) {
      if (config.provider === provider) return config;
    }
    return undefined;
  }

  private eventToIntent(event: WebhookEvent): string {
    if (event.provider === 'github' && event.event === 'push') {
      const payload = event.payload;
      const ref = String(payload.ref || '');
      const commits = (payload.commits as Array<Record<string, unknown>>) || [];
      return `GitHub push to ${ref}: ${commits.length} commit(s)`;
    }

    return `${event.provider} ${event.event} webhook received`;
  }

  private initNonceDb(): void {
    try {
      if (!fs.existsSync(VIBE_DIR)) {
        fs.mkdirSync(VIBE_DIR, { recursive: true, mode: 0o700 });
      }

      this.nonceDb = new Database(NONCE_DB_PATH);
      this.nonceDb.pragma('journal_mode = WAL');
      this.nonceDb.exec(`
        CREATE TABLE IF NOT EXISTS nonces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          delivery_id TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_nonces_delivery ON nonces(delivery_id);
        CREATE INDEX IF NOT EXISTS idx_nonces_created ON nonces(created_at);
      `);
    } catch (err) {
      this.logger('warn', 'Failed to init nonce DB', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
