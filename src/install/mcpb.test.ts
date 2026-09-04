import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { packageRoot } from '../core/paths.js';
import { buildMcpb, mcpbManifest, zipStore } from './mcpb.js';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-mcpb-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('mcpb — the Claude desktop bundle', () => {
  it('mcpb: the bundle is a valid zip with manifest, server and README; the manifest binds the project folder and carries the package version', () => {
    const out = path.join(dir, 'vibe.mcpb');
    const r = buildMcpb(out);
    expect(r.entries).toEqual(['manifest.json', 'server/index.js', 'README.md']);
    expect(r.bytes).toBeGreaterThan(1000);
    // python's zipfile is the independent reader: it validates headers and CRCs
    const listing = execFileSync('python3', ['-c', `import zipfile,json,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; m=json.loads(z.read('manifest.json')); print(m['version'], m['server']['mcp_config']['env']['VIBE_PROJECT_DIR'], m['user_config']['project']['type'], len(z.namelist()))`, out], { encoding: 'utf-8' }).trim();
    expect(listing).toBe(`${r.version} \${user_config.project} directory 3`);
    const manifest = mcpbManifest('1.2.3', 'd');
    expect(manifest['manifest_version']).toBe('0.3');
    expect(zipStore([]).length).toBe(22);
  });

  it('mcpb: the server speaks MCP over stdio — initialize, tools/list, tools/call — and calls the vibe CLI in the project folder', async () => {
    const shim = path.join(dir, 'bin');
    fs.mkdirSync(shim);
    fs.writeFileSync(path.join(shim, 'vibe'), `#!/bin/sh\nexec node "${path.join(packageRoot(), 'dist', 'cli.js')}" "$@"\n`, { mode: 0o755 });
    const project = path.join(dir, 'project');
    fs.mkdirSync(project);
    const server = spawn(process.execPath, [path.join(packageRoot(), 'mcpb', 'server', 'index.js')], { env: { ...process.env, PATH: `${shim}:${process.env['PATH']}`, VIBE_PROJECT_DIR: project, VIBE_MCPB_VERSION: '9.9.9', VIBE_SKIP_SETUP: '1', VIBE_OFFLINE: '1' } });
    const replies: Array<Record<string, unknown>> = [];
    let buffer = '';
    server.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const l of lines) if (l.trim()) replies.push(JSON.parse(l) as Record<string, unknown>);
    });
    const send = (msg: unknown): void => void server.stdin.write(`${JSON.stringify(msg)}\n`);
    const waitFor = async (n: number): Promise<void> => {
      for (let i = 0; i < 200 && replies.length < n; i += 1) await new Promise((r) => setTimeout(r, 50));
    };
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'vibe_intent_draft', arguments: { intent: '# Hello\n\n## Why\nx\n', scenarios: '- { id: hi, then: x, check: { type: file, path: hi.txt, exists: true } }\n' } } });
    send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'vibe_state', arguments: {} } });
    send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope', arguments: {} } });
    await waitFor(5);
    server.kill();
    const byId = Object.fromEntries(replies.map((r) => [r['id'] as number, r]));
    expect((byId[1]!['result'] as { serverInfo: { version: string } }).serverInfo.version).toBe('9.9.9');
    expect((byId[2]!['result'] as { tools: Array<{ name: string }> }).tools.map((t) => t.name)).toContain('vibe_check');
    const draft = byId[3]!['result'] as { isError: boolean; content: Array<{ text: string }> };
    expect(draft.isError).toBe(false);
    expect(JSON.parse(draft.content[0]!.text)).toMatchObject({ ok: true, scenarios: [{ id: 'hi' }] });
    const state = JSON.parse((byId[4]!['result'] as { content: Array<{ text: string }> }).content[0]!.text) as { state: string };
    expect(state.state).toBe('DRAFT');
    expect(fs.existsSync(path.join(project, '.vibe', 'intent.md'))).toBe(true);
    expect((byId[5]!['error'] as { code: number }).code).toBe(-32602);
  });
});
