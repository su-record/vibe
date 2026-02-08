/**
 * WebServer - HTTP + WebSocket + SSE interface for Vibe
 * Phase 4: External Interface
 *
 * Features:
 * - REST API (existing endpoints preserved)
 * - WebSocket upgrade handler (RFC 6455)
 * - SSE streams (global + job-specific)
 * - JWT + local token auth
 * - Per-token rate limiting
 * - Event buffering for reconnection
 */

import * as http from 'node:http';
import * as crypto from 'node:crypto';
import * as net from 'node:net';
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
import {
  wsInboundSchema,
  type WsInboundMessage,
  type WsOutboundMessage,
  type WebSocketClient,
  type SseClient,
  type SseEvent,
  type JwtPayload,
  type RateLimitEntry,
  type BufferedEvent,
  WS_MAX_FRAME_SIZE,
  WS_MAX_CONNECTIONS,
  SSE_MAX_CONNECTIONS,
  WS_IDLE_TIMEOUT_MS,
  SSE_IDLE_TIMEOUT_MS,
  WS_PING_INTERVAL_MS,
  SSE_KEEPALIVE_INTERVAL_MS,
  WS_HANDSHAKE_TIMEOUT_MS,
  WS_BACKPRESSURE_LIMIT,
  SSE_BACKPRESSURE_LIMIT,
  SSE_EVENT_BUFFER_MAX_COUNT,
  SSE_EVENT_BUFFER_MAX_BYTES,
  SSE_EVENT_BUFFER_MAX_AGE_MS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  JWT_CLOCK_SKEW_SECONDS,
  WS_OPCODE_TEXT,
  WS_OPCODE_BINARY,
  WS_OPCODE_CLOSE,
  WS_OPCODE_PING,
  WS_OPCODE_PONG,
  WS_CLOSE_NORMAL,
  WS_CLOSE_PROTOCOL_ERROR,
  WS_CLOSE_UNSUPPORTED_DATA,
  WS_CLOSE_MESSAGE_TOO_BIG,
  WS_CLOSE_TRY_AGAIN_LATER,
  WS_MAGIC_GUID,
} from './types.js';

const TOKEN_FILE = path.join(os.homedir(), '.vibe', 'web-token');
const DEFAULT_PORT = 7860;
const MAX_PAYLOAD = 1024 * 1024; // 1MB

// ============================================================================
// Helper Functions (module-level)
// ============================================================================

/**
 * Generate monotonic ULID (timestamp + random)
 */
function generateUlid(): string {
  const timestamp = Date.now().toString(36).padStart(10, '0');
  const random = crypto.randomBytes(10).toString('base64url').slice(0, 10);
  return `${timestamp}${random}`;
}

/**
 * Parse base64url (RFC 7515)
 */
function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    input.length + ((4 - (input.length % 4)) % 4),
    '='
  );
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * XOR unmask WebSocket payload (RFC 6455)
 */
function unmaskPayload(payload: Uint8Array, maskKey: Uint8Array): Buffer {
  const unmasked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    unmasked[i] = payload[i] ^ maskKey[i % 4];
  }
  return unmasked;
}

// ============================================================================
// WebServer Class
// ============================================================================

export class WebServer extends BaseInterface {
  readonly name = 'web';
  readonly channel: ChannelType = 'web';

  private server: http.Server | null = null;
  private config: WebServerConfig;
  private connections: Set<http.ServerResponse> = new Set();
  private wsClients: Map<string, WebSocketClient> = new Map();
  private sseClients: Map<string, SseClient> = new Map();
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private eventBuffer: BufferedEvent[] = [];
  private eventBufferSize = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<WebServerConfig> & { authToken?: string }, logger: InterfaceLogger) {
    super(logger);
    this.config = {
      port: config.port || DEFAULT_PORT,
      host: config.host || '127.0.0.1',
      authToken: config.authToken || this.generateToken(),
      maxConnections: config.maxConnections || WS_MAX_CONNECTIONS,
      maxSseConnections: config.maxSseConnections || SSE_MAX_CONNECTIONS,
      idleTimeoutMs: config.idleTimeoutMs || WS_IDLE_TIMEOUT_MS,
      maxPayloadBytes: config.maxPayloadBytes || MAX_PAYLOAD,
      corsOrigins: config.corsOrigins || ['http://localhost:*'],
      authMode: config.authMode || 'local',
      jwtSecret: config.jwtSecret,
      jwtIssuer: config.jwtIssuer,
      jwtAudience: config.jwtAudience,
    };
  }

  async start(): Promise<void> {
    this.status = 'connecting';

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket as net.Socket, head));

    this.heartbeatInterval = setInterval(() => this.heartbeat(), WS_PING_INTERVAL_MS);
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);

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

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    for (const client of this.wsClients.values()) {
      this.wsClose(client.socket, WS_CLOSE_NORMAL, 'Server shutdown');
    }
    this.wsClients.clear();

    for (const client of this.sseClients.values()) {
      client.response.end();
    }
    this.sseClients.clear();

    for (const conn of this.connections) {
      conn.end();
    }
    this.connections.clear();

    return new Promise<void>((resolve) => {
      this.server!.close(() => {
        this.server = null;
        this.status = 'disabled';
        this.logger('info', 'Web server stopped');
        resolve();
      });
    });
  }

  async sendResponse(response: ExternalResponse): Promise<void> {
    this.logger('debug', `Web response to ${response.chatId}: ${response.content.slice(0, 100)}`);
  }

  /**
   * Broadcast progress event to SSE/WS clients
   */
  broadcastProgress(event: {
    type: string;
    jobId: string;
    data: unknown;
    timestamp: string;
  }): void {
    const sseEvent: SseEvent = {
      id: generateUlid(),
      type: this.mapEventType(event.type),
      jobId: event.jobId,
      data: event.data,
      timestamp: event.timestamp,
    };

    this.bufferEvent(sseEvent);

    // Send to SSE clients
    for (const client of this.sseClients.values()) {
      if (!client.jobId || client.jobId === event.jobId) {
        this.sseSend(client, sseEvent);
      }
    }

    // Send to WS clients
    for (const client of this.wsClients.values()) {
      if (client.authenticated && client.subscribedJobs.has(event.jobId)) {
        const wsMsg: WsOutboundMessage = {
          type: event.type,
          jobId: event.jobId,
          data: event.data,
          timestamp: event.timestamp,
        };
        this.wsSendText(client, JSON.stringify(wsMsg));
      }
    }
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
  // HTTP Request Handler
  // ========================================================================

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.connections.add(res);
    res.on('close', () => this.connections.delete(res));

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

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // SSE endpoints (auth via query param or header)
    if (req.url?.startsWith('/api/stream')) {
      this.handleSseRequest(req, res);
      return;
    }

    // Auth check for other endpoints
    const token = this.extractToken(req);
    if (!token || !this.verifyToken(token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Rate limiting
    if (!this.checkRateLimit(token)) {
      const retryAfter = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
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
      const jobId = url.split('/api/job/')[1]?.split('?')[0] || '';
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jobId, status: 'pending' }));
  }

  private handleListJobs(res: http.ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jobs: [] }));
  }

  // ========================================================================
  // WebSocket Upgrade Handler
  // ========================================================================

  private handleUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
    if (this.wsClients.size >= this.config.maxConnections) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key || typeof key !== 'string') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const acceptKey = this.generateAcceptKey(key);

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
      '\r\n'
    );

    const clientId = generateUlid();
    const client: WebSocketClient = {
      id: clientId,
      socket,
      authenticated: false,
      subscribedJobs: new Set(),
      lastActivity: Date.now(),
      lastPong: Date.now(),
      writeBufferSize: 0,
    };

    this.wsClients.set(clientId, client);

    const handshakeTimeout = setTimeout(() => {
      if (!client.authenticated) {
        this.wsClose(socket, WS_CLOSE_PROTOCOL_ERROR, 'Auth timeout');
        this.wsClients.delete(clientId);
      }
    }, WS_HANDSHAKE_TIMEOUT_MS);

    const chunks: Buffer[] = head.length > 0 ? [head] : [];

    socket.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      let buffer = Buffer.concat(chunks);
      chunks.length = 0;

      while (buffer.length > 0) {
        const result = this.wsParseFrame(buffer);
        if (!result) break;

        const { frame, consumed } = result;
        buffer = buffer.subarray(consumed);

        this.wsHandleFrame(client, frame);
      }

      if (buffer.length > 0) {
        chunks.push(buffer);
      }
    });

    socket.on('close', () => {
      clearTimeout(handshakeTimeout);
      this.wsClients.delete(clientId);
    });

    socket.on('error', (err) => {
      this.logger('debug', `WS socket error: ${err.message}`);
      this.wsClients.delete(clientId);
    });
  }

  private generateAcceptKey(key: string): string {
    const hash = crypto.createHash('sha1');
    hash.update(key + WS_MAGIC_GUID);
    return hash.digest('base64');
  }

  // ========================================================================
  // WebSocket Frame Parser
  // ========================================================================

  private wsParseFrame(buffer: Buffer): { frame: WsFrame; consumed: number } | null {
    if (buffer.length < 2) return null;

    const fin = (buffer[0] & 0x80) !== 0;
    const rsv = buffer[0] & 0x70;
    const opcode = buffer[0] & 0x0f;

    // RFC 6455 §5.2: RSV1-3 must be 0 unless extension negotiated
    if (rsv !== 0) {
      return {
        frame: { opcode: WS_OPCODE_CLOSE, payload: Buffer.from([]), masked: false },
        consumed: buffer.length,
      };
    }

    const masked = (buffer[1] & 0x80) !== 0;
    let payloadLen = buffer[1] & 0x7f;
    let offset = 2;

    if (payloadLen === 126) {
      if (buffer.length < 4) return null;
      payloadLen = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLen === 127) {
      if (buffer.length < 10) return null;
      const high = buffer.readUInt32BE(2);
      const low = buffer.readUInt32BE(6);
      payloadLen = high * 0x100000000 + low;
      offset = 10;
    }

    if (payloadLen > WS_MAX_FRAME_SIZE) {
      return {
        frame: { opcode: WS_OPCODE_CLOSE, payload: Buffer.from([]), masked: false },
        consumed: buffer.length,
      };
    }

    let maskKey: Buffer | undefined;
    if (masked) {
      if (buffer.length < offset + 4) return null;
      maskKey = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    if (buffer.length < offset + payloadLen) return null;

    const rawPayload = buffer.subarray(offset, offset + payloadLen);
    const payload = (masked && maskKey)
      ? unmaskPayload(rawPayload, maskKey)
      : Buffer.from(rawPayload);

    return {
      frame: { opcode, payload, masked },
      consumed: offset + payloadLen,
    };
  }

  private wsHandleFrame(client: WebSocketClient, frame: WsFrame): void {
    client.lastActivity = Date.now();

    if (frame.opcode === WS_OPCODE_CLOSE) {
      this.wsClose(client.socket, WS_CLOSE_NORMAL, 'Client close');
      this.wsClients.delete(client.id);
      return;
    }

    if (frame.opcode === WS_OPCODE_PING) {
      this.wsSendFrame(client.socket, WS_OPCODE_PONG, frame.payload);
      return;
    }

    if (frame.opcode === WS_OPCODE_PONG) {
      client.lastPong = Date.now();
      return;
    }

    if (frame.opcode === WS_OPCODE_BINARY) {
      this.wsClose(client.socket, WS_CLOSE_UNSUPPORTED_DATA, 'Binary not supported');
      this.wsClients.delete(client.id);
      return;
    }

    if (frame.opcode === WS_OPCODE_TEXT) {
      const text = frame.payload.toString('utf8');
      this.wsHandleMessage(client, text);
    }
  }

  private wsHandleMessage(client: WebSocketClient, text: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.wsSendText(client, JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const result = wsInboundSchema.safeParse(parsed);
    if (!result.success) {
      this.wsSendText(client, JSON.stringify({ error: 'Invalid message schema' }));
      return;
    }

    const msg = result.data as WsInboundMessage;

    if (msg.type === 'auth') {
      if (!this.verifyToken(msg.token)) {
        this.wsClose(client.socket, WS_CLOSE_PROTOCOL_ERROR, 'Auth failed');
        this.wsClients.delete(client.id);
        return;
      }

      if (!this.checkRateLimit(msg.token)) {
        this.wsClose(client.socket, WS_CLOSE_TRY_AGAIN_LATER, 'Rate limit');
        this.wsClients.delete(client.id);
        return;
      }

      client.authenticated = true;
      this.wsSendText(client, JSON.stringify({ type: 'connected', clientId: client.id }));
      return;
    }

    if (!client.authenticated) {
      this.wsClose(client.socket, WS_CLOSE_PROTOCOL_ERROR, 'Not authenticated');
      this.wsClients.delete(client.id);
      return;
    }

    if (msg.type === 'message') {
      const extMsg: ExternalMessage = {
        id: crypto.randomUUID(),
        channel: 'web',
        chatId: client.id,
        userId: client.id,
        content: msg.content,
        type: 'text',
        timestamp: new Date().toISOString(),
        metadata: { jobId: msg.jobId },
      };
      this.dispatchMessage(extMsg).catch((err) => {
        this.logger('error', 'Failed to dispatch WS message', err);
      });
    } else if (msg.type === 'subscribe') {
      client.subscribedJobs.add(msg.jobId);
    } else if (msg.type === 'unsubscribe') {
      client.subscribedJobs.delete(msg.jobId);
    } else if (msg.type === 'ping') {
      this.wsSendText(client, JSON.stringify({ type: 'pong' }));
    }
  }

  // ========================================================================
  // WebSocket Frame Writer
  // ========================================================================

  private wsSendFrame(socket: net.Socket, opcode: number, payload: Buffer): void {
    if (socket.writableLength > WS_BACKPRESSURE_LIMIT) {
      socket.destroy();
      return;
    }

    const len = payload.length;
    let header: Buffer;

    if (len < 126) {
      header = Buffer.allocUnsafe(2);
      header[0] = 0x80 | opcode;
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.allocUnsafe(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.allocUnsafe(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(len, 6);
    }

    socket.write(Buffer.concat([header, payload]));
  }

  private wsSendText(client: WebSocketClient, text: string): void {
    const payload = Buffer.from(text, 'utf8');
    if (payload.length > WS_MAX_FRAME_SIZE) {
      this.wsClose(client.socket, WS_CLOSE_MESSAGE_TOO_BIG, 'Message too big');
      this.wsClients.delete(client.id);
      return;
    }
    this.wsSendFrame(client.socket, WS_OPCODE_TEXT, payload);
  }

  private wsClose(socket: net.Socket, code: number, reason: string): void {
    const payload = Buffer.allocUnsafe(2 + Buffer.byteLength(reason));
    payload.writeUInt16BE(code, 0);
    payload.write(reason, 2, 'utf8');
    this.wsSendFrame(socket, WS_OPCODE_CLOSE, payload);
    socket.end();
  }

  // ========================================================================
  // SSE Handler
  // ========================================================================

  private handleSseRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '';
    const token = this.extractToken(req);

    if (!token || !this.verifyToken(token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    if (!this.checkRateLimit(token)) {
      const retryAfter = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }

    if (this.sseClients.size >= this.config.maxSseConnections) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many SSE connections' }));
      return;
    }

    const jobIdMatch = url.match(/^\/api\/stream\/([^/?]+)/);
    const jobId = jobIdMatch ? jobIdMatch[1] : undefined;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const clientId = generateUlid();
    const client: SseClient = {
      id: clientId,
      response: res,
      jobId,
      lastActivity: Date.now(),
      token,
    };

    this.sseClients.set(clientId, client);

    const lastEventId = req.headers['last-event-id'];
    if (lastEventId && typeof lastEventId === 'string') {
      this.sseReplayEvents(client, lastEventId);
    }

    const keepaliveInterval = setInterval(() => {
      if (!res.writable) {
        clearInterval(keepaliveInterval);
        return;
      }
      res.write(':keep-alive\n\n');
    }, SSE_KEEPALIVE_INTERVAL_MS);

    res.on('close', () => {
      clearInterval(keepaliveInterval);
      this.sseClients.delete(clientId);
    });
  }

  private sseSend(client: SseClient, event: SseEvent): void {
    if (!client.response.writable) {
      this.sseClients.delete(client.id);
      return;
    }

    if (client.response.writableLength > SSE_BACKPRESSURE_LIMIT) {
      client.response.end();
      this.sseClients.delete(client.id);
      return;
    }

    client.lastActivity = Date.now();

    const data = JSON.stringify(event.data);
    const message = `id: ${event.id}\nevent: ${event.type}\ndata: ${data}\n\n`;
    client.response.write(message);
  }

  private sseReplayEvents(client: SseClient, lastEventId: string): void {
    const now = Date.now();
    const cutoff = now - SSE_EVENT_BUFFER_MAX_AGE_MS;

    for (const buffered of this.eventBuffer) {
      if (buffered.timestamp < cutoff) continue;
      if (buffered.id <= lastEventId) continue;

      const message = `id: ${buffered.id}\nevent: ${buffered.event}\ndata: ${buffered.data}\n\n`;
      client.response.write(message);
    }
  }

  private bufferEvent(event: SseEvent): void {
    const data = JSON.stringify(event.data);
    const size = Buffer.byteLength(data) + Buffer.byteLength(event.id) + Buffer.byteLength(event.type);

    const buffered: BufferedEvent = {
      id: event.id,
      event: event.type,
      data,
      timestamp: Date.now(),
      size,
    };

    this.eventBuffer.push(buffered);
    this.eventBufferSize += size;

    while (
      this.eventBuffer.length > SSE_EVENT_BUFFER_MAX_COUNT ||
      this.eventBufferSize > SSE_EVENT_BUFFER_MAX_BYTES
    ) {
      const removed = this.eventBuffer.shift();
      if (removed) this.eventBufferSize -= removed.size;
    }
  }

  // ========================================================================
  // Auth Helpers
  // ========================================================================

  private extractToken(req: http.IncomingMessage): string | null {
    const auth = req.headers.authorization;
    if (auth) {
      const [scheme, token] = auth.split(' ');
      if (scheme === 'Bearer' && token) return token;
    }

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const queryToken = url.searchParams.get('token');
    if (queryToken) return queryToken;

    return null;
  }

  private verifyToken(token: string): boolean {
    if (this.config.authMode === 'cloud') {
      return this.verifyJwt(token);
    }

    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(this.config.authToken);
    if (tokenBuf.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  }

  private verifyJwt(token: string): boolean {
    if (!this.config.jwtSecret) return false;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const [headerB64, payloadB64, signatureB64] = parts;
      const header = JSON.parse(base64urlDecode(headerB64)) as { alg?: string };
      if (header.alg !== 'HS256') return false;

      const payload = JSON.parse(base64urlDecode(payloadB64)) as JwtPayload;

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now - JWT_CLOCK_SKEW_SECONDS) return false;
      if (payload.iat && payload.iat > now + JWT_CLOCK_SKEW_SECONDS) return false;
      if (payload.nbf && payload.nbf > now + JWT_CLOCK_SKEW_SECONDS) return false;

      if (!payload.sub) return false;
      if (this.config.jwtIssuer && payload.iss !== this.config.jwtIssuer) return false;
      if (this.config.jwtAudience && payload.aud !== this.config.jwtAudience) return false;

      const hmac = crypto.createHmac('sha256', this.config.jwtSecret);
      hmac.update(`${headerB64}.${payloadB64}`);
      const expectedSignature = hmac.digest('base64url');

      return crypto.timingSafeEqual(
        Buffer.from(signatureB64),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  // ========================================================================
  // Rate Limiting (per-token, sliding window)
  // ========================================================================

  private checkRateLimit(token: string): boolean {
    const now = Date.now();
    let entry = this.rateLimits.get(token);

    if (!entry) {
      entry = {
        tokens: 0,
        lastRefill: now,
        windowStart: now,
        requestTimestamps: [],
      };
      this.rateLimits.set(token, entry);
    }

    entry.requestTimestamps = entry.requestTimestamps.filter(
      (ts) => ts > now - RATE_LIMIT_WINDOW_MS
    );

    if (entry.requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }

    entry.requestTimestamps.push(now);
    return true;
  }

  // ========================================================================
  // Maintenance
  // ========================================================================

  private heartbeat(): void {
    const now = Date.now();

    for (const [id, client] of this.wsClients.entries()) {
      if (now - client.lastActivity > this.config.idleTimeoutMs) {
        this.wsClose(client.socket, WS_CLOSE_NORMAL, 'Idle timeout');
        this.wsClients.delete(id);
        continue;
      }

      if (now - client.lastPong > WS_PING_INTERVAL_MS * 2) {
        this.wsClose(client.socket, WS_CLOSE_NORMAL, 'No pong');
        this.wsClients.delete(id);
        continue;
      }

      this.wsSendFrame(client.socket, WS_OPCODE_PING, Buffer.from('ping'));
    }
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [id, client] of this.sseClients.entries()) {
      if (now - client.lastActivity > SSE_IDLE_TIMEOUT_MS) {
        client.response.end();
        this.sseClients.delete(id);
      }
    }

    const cutoff = now - SSE_EVENT_BUFFER_MAX_AGE_MS;
    this.eventBuffer = this.eventBuffer.filter((e) => e.timestamp >= cutoff);

    for (const [token, entry] of this.rateLimits.entries()) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
        this.rateLimits.delete(token);
      }
    }
  }

  // ========================================================================
  // Utility
  // ========================================================================

  private mapEventType(type: string): 'job:created' | 'job:progress' | 'job:chunk' | 'job:complete' | 'job:error' | 'permission:request' {
    const mapping: Record<string, 'job:created' | 'job:progress' | 'job:chunk' | 'job:complete' | 'job:error' | 'permission:request'> = {
      'job_created': 'job:created',
      'job_progress': 'job:progress',
      'job_chunk': 'job:chunk',
      'job_complete': 'job:complete',
      'job_error': 'job:error',
      'permission_request': 'permission:request',
    };
    return mapping[type] || 'job:progress';
  }

  private isOriginAllowed(origin: string): boolean {
    return this.config.corsOrigins.some((pattern) => {
      if (pattern.includes('*')) {
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
        const regex = new RegExp('^' + escaped + '$');
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

// ============================================================================
// Internal Types
// ============================================================================

interface WsFrame {
  opcode: number;
  payload: Buffer;
  masked: boolean;
}
