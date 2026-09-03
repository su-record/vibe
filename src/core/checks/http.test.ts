import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { httpCheck } from './http.js';

let root: string;
let base: string;
let server: http.Server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/ok') return void res.writeHead(200, { 'content-type': 'application/json' }).end('{"total": 12, "rows": 3}');
    if (req.url === '/slow') return void setTimeout(() => res.writeHead(200).end('late'), 300);
    if (req.url === '/text') return void res.writeHead(200).end('not json');
    res.writeHead(500).end('boom');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(() => void server.close());
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-http-'));
  fs.writeFileSync(path.join(root, 'schema.json'), JSON.stringify({ type: 'object', required: ['total'], properties: { total: { type: 'number' } } }));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('http check — the harness makes the request', () => {
  it('http: status, schema and latency ceiling all pass', async () => {
    const r = await httpCheck({ type: 'http', url: `${base}/ok`, expect: { status: 200, schema: 'schema.json', maxMs: 5000 } }, root);
    expect(r).toMatchObject({ pass: true, exit: 200 });
    expect(r.tail).toContain('"total"');
  });

  it('http: a wrong status, a slow answer, a schema mismatch and a dead host each fail with a reason', async () => {
    expect((await httpCheck({ type: 'http', url: `${base}/nope` }, root))).toMatchObject({ pass: false, exit: 500, reason: 'status 500, expected 200' });
    expect((await httpCheck({ type: 'http', url: `${base}/slow`, expect: { maxMs: 50 } }, root)).reason).toMatch(/^\d+ms, limit 50ms$/);
    expect((await httpCheck({ type: 'http', url: `${base}/text`, expect: { schema: 'schema.json' } }, root)).reason).toContain('parse failed');
    const dead = await httpCheck({ type: 'http', url: 'http://127.0.0.1:1', timeoutMs: 2000 }, root);
    expect(dead).toMatchObject({ pass: false, exit: null });
    expect(dead.reason).toContain('request failed');
  });
});
