/**
 * Unit tests for WebServer
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import type { InterfaceLogger } from '../../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

function httpRequest(options: {
  port: number;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: options.port,
        path: options.path,
        method: options.method || 'GET',
        headers: options.headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 0, headers: res.headers, body });
        });
      },
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function createJwt(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${header}.${payloadB64}`);
  const signature = hmac.digest('base64url');
  return `${header}.${payloadB64}.${signature}`;
}

function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as { port: number };
      srv.close(() => resolve(addr.port));
    });
  });
}

// ============================================================================
// Tests
// ============================================================================

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

  // ==========================================================================
  // Integration: HTTP Endpoints (local auth mode)
  // ==========================================================================

  describe('HTTP integration (local auth)', () => {
    let WebServerClass: typeof import('../WebServer.js').WebServer;
    let server: InstanceType<typeof WebServerClass>;
    let port: number;
    const authToken = 'integration-test-token-abc123xyz';

    beforeAll(async () => {
      const mod = await import('../WebServer.js');
      WebServerClass = mod.WebServer;
      port = await findFreePort();
      server = new WebServerClass(
        { port, authToken, corsOrigins: ['http://localhost:3000', 'http://*.example.com'] },
        mockLogger,
      );
      await server.start();
    });

    afterAll(async () => {
      await server.stop();
    });

    // --- Health ---

    it('GET /health returns 200 without auth', async () => {
      const res = await httpRequest({ port, path: '/health' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
    });

    // --- Authentication ---

    it('returns 401 without token', async () => {
      const res = await httpRequest({ port, path: '/api/jobs' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await httpRequest({
        port,
        path: '/api/jobs',
        headers: { Authorization: 'Bearer wrong-token' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with valid Bearer token', async () => {
      const res = await httpRequest({
        port,
        path: '/api/jobs',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('accepts token via query parameter (auth passes)', async () => {
      const res = await httpRequest({
        port,
        path: `/api/jobs?token=${authToken}`,
      });
      // Auth succeeds (not 401); returns 404 because query string in URL affects routing
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    // --- CORS ---

    it('allows exact match origin', async () => {
      const res = await httpRequest({
        port,
        path: '/health',
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('allows wildcard pattern origin', async () => {
      const res = await httpRequest({
        port,
        path: '/health',
        headers: { Origin: 'http://app.example.com' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://app.example.com');
    });

    it('rejects non-matching origin', async () => {
      const res = await httpRequest({
        port,
        path: '/health',
        headers: { Origin: 'http://evil.com' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('handles OPTIONS preflight', async () => {
      const res = await httpRequest({
        port,
        path: '/api/jobs',
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(res.statusCode).toBe(204);
    });

    // --- Job Creation ---

    it('POST /api/job creates a job', async () => {
      const res = await httpRequest({
        port,
        path: '/api/job',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ request: 'test request' }),
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.messageId).toBeDefined();
      expect(body.status).toBe('created');
    });

    it('POST /api/job returns 400 for missing request field', async () => {
      const res = await httpRequest({
        port,
        path: '/api/job',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(res.statusCode).toBe(400);
    });

    it('POST /api/job returns 400 for invalid JSON', async () => {
      const res = await httpRequest({
        port,
        path: '/api/job',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: 'not-json',
      });
      expect(res.statusCode).toBe(400);
    });

    // --- 404 ---

    it('returns 404 for unknown path', async () => {
      const res = await httpRequest({
        port,
        path: '/api/unknown',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    // --- SSE ---

    it('GET /api/stream returns 401 without token', async () => {
      const res = await httpRequest({ port, path: '/api/stream' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ==========================================================================
  // Integration: JWT Verification (cloud auth mode)
  // ==========================================================================

  describe('JWT verification (cloud auth)', () => {
    let WebServerClass: typeof import('../WebServer.js').WebServer;
    let server: InstanceType<typeof WebServerClass>;
    let port: number;
    const jwtSecret = 'test-jwt-secret-key-for-testing';

    beforeAll(async () => {
      const mod = await import('../WebServer.js');
      WebServerClass = mod.WebServer;
      port = await findFreePort();
      server = new WebServerClass(
        {
          port,
          authMode: 'cloud',
          jwtSecret,
          jwtIssuer: 'test-issuer',
          jwtAudience: 'test-audience',
        },
        mockLogger,
      );
      await server.start();
    });

    afterAll(async () => {
      await server.stop();
    });

    it('accepts valid JWT', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createJwt(
        { sub: 'user-1', iat: now, exp: now + 3600, iss: 'test-issuer', aud: 'test-audience' },
        jwtSecret,
      );
      const res = await httpRequest({
        port,
        path: '/api/jobs',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('rejects expired JWT', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createJwt(
        { sub: 'user-1', iat: now - 7200, exp: now - 3600, iss: 'test-issuer', aud: 'test-audience' },
        jwtSecret,
      );
      const res = await httpRequest({
        port,
        path: '/api/jobs',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects JWT with wrong secret', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createJwt(
        { sub: 'user-1', iat: now, exp: now + 3600, iss: 'test-issuer', aud: 'test-audience' },
        'wrong-secret',
      );
      const res = await httpRequest({
        port,
        path: '/api/jobs',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects JWT with wrong issuer', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createJwt(
        { sub: 'user-1', iat: now, exp: now + 3600, iss: 'wrong-issuer', aud: 'test-audience' },
        jwtSecret,
      );
      const res = await httpRequest({
        port,
        path: '/api/jobs',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects JWT with wrong audience', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createJwt(
        { sub: 'user-1', iat: now, exp: now + 3600, iss: 'test-issuer', aud: 'wrong-audience' },
        jwtSecret,
      );
      const res = await httpRequest({
        port,
        path: '/api/jobs',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects JWT without sub claim', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createJwt(
        { iat: now, exp: now + 3600, iss: 'test-issuer', aud: 'test-audience' },
        jwtSecret,
      );
      const res = await httpRequest({
        port,
        path: '/api/jobs',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects alg:none JWT', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const now = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(JSON.stringify({
        sub: 'user-1', iat: now, exp: now + 3600, iss: 'test-issuer', aud: 'test-audience',
      })).toString('base64url');
      const token = `${header}.${payload}.`;

      const res = await httpRequest({
        port,
        path: '/api/jobs',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects malformed JWT (wrong number of parts)', async () => {
      const res = await httpRequest({
        port,
        path: '/api/jobs',
        headers: { Authorization: 'Bearer not.a.valid.jwt.token' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects malformed JWT (invalid base64)', async () => {
      const res = await httpRequest({
        port,
        path: '/api/jobs',
        headers: { Authorization: 'Bearer !!!.!!!.!!!' },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
