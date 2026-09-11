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
    const server = spawn(process.execPath, [path.join(packageRoot(), 'mcpb', 'server', 'index.js')], { env: { ...process.env, HOME: dir, PATH: `${shim}:${process.env['PATH']}`, VIBE_PROJECT_DIR: project, VIBE_MCPB_VERSION: '9.9.9', VIBE_SKIP_SETUP: '1', VIBE_OFFLINE: '1' } });
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
    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'vibe', arguments: { operation: 'intent_draft', arguments: { intent: '# Hello\n\n## Why\nx\n', scenarios: '- { id: hi, then: x, check: { type: file, path: hi.txt, exists: true } }\n' } } } });
    send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'vibe', arguments: { operation: 'state' } } });
    send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope', arguments: {} } });
    send({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'vibe', arguments: { operation: 'discover', arguments: { operation: 'skill' } } } });
    send({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'vibe', arguments: { operation: 'guide', arguments: { name: 'extensions' } } } });
    send({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'vibe', arguments: { operation: 'skill', arguments: { action: 'create', value: 'pilot', check: 'file' } } } });
    send({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'vibe', arguments: { operation: 'skill', arguments: { action: 'delete-everything' } } } });
    send({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'vibe', arguments: { operation: 'brief' } } });
    send({ jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'vibe', arguments: { operation: 'knowledge', arguments: { title: 'Pilot decision', text: 'Use changed input; confirmed in the task.' } } } });
    send({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'vibe_state', arguments: {} } });
    send({ jsonrpc: '2.0', id: 13, method: 'tools/call', params: { name: 'vibe', arguments: { operation: 'performance', arguments: { action: 'report' } } } });
    send({ jsonrpc: '2.0', id: 14, method: 'tools/call', params: { name: 'vibe', arguments: { operation: 'performance', arguments: { action: 'publish' } } } });
    await waitFor(14);
    server.kill();
    const byId = Object.fromEntries(replies.map((r) => [r['id'] as number, r]));
    expect((byId[1]!['result'] as { serverInfo: { version: string } }).serverInfo.version).toBe('9.9.9');
    expect((byId[2]!['result'] as { tools: Array<{ name: string }> }).tools.map((t) => t.name)).toEqual(['vibe']);
    const draft = byId[3]!['result'] as { isError: boolean; content: Array<{ text: string }> };
    expect(draft.isError).toBe(false);
    expect(JSON.parse(draft.content[0]!.text)).toMatchObject({ ok: true, scenarios: [{ id: 'hi' }] });
    const state = JSON.parse((byId[4]!['result'] as { content: Array<{ text: string }> }).content[0]!.text) as { state: string };
    expect(state.state).toBe('DRAFT');
    expect(fs.existsSync(path.join(project, '.vibe', 'intent.md'))).toBe(true);
    expect((byId[5]!['error'] as { code: number }).code).toBe(-32602);
    const text = (id: number) => (byId[id]!['result'] as { content: Array<{ text: string }> }).content[0]!.text;
    expect(JSON.parse(text(6))[0].inputSchema.properties.action.enum).toContain('create');
    expect(JSON.parse(text(7)).text).toContain('skill search');
    expect(JSON.parse(text(8)).paths).toEqual(['.vibe/skills/installed/pilot/SKILL.md']);
    expect(fs.existsSync(path.join(project, '.claude', 'skills', 'pilot'))).toBe(false);
    expect((byId[9]!['error'] as { code: number }).code).toBe(-32602);
    expect(JSON.parse(text(10)).guidance).toContain("You are the user's FDE");
    expect(fs.readFileSync(path.join(project, '.vibe', 'knowledge', 'pilot-decision.md'), 'utf8')).toContain('confirmed in the task');
    expect(JSON.parse(text(12)).state).toBe('DRAFT');
    expect(JSON.parse(text(13))).toMatchObject({ runs: 0, checks: [] });
    expect((byId[14]!['error'] as { code: number }).code).toBe(-32602);
  }, 60_000); // The response poll is bounded at 10 seconds, beyond Vitest's default 5 seconds.

  it('mcpb: the server finds the CLI without PATH when the install setting names it, and says so when it cannot', async () => {
    const shim = path.join(dir, 'bin');
    fs.mkdirSync(shim);
    fs.writeFileSync(path.join(shim, 'vibe'), `#!/bin/sh\nexec node "${path.join(packageRoot(), 'dist', 'cli.js')}" "$@"\n`, { mode: 0o755 });
    const ask = (env: Record<string, string>): Promise<string> => new Promise((resolve) => {
      const server = spawn(process.execPath, [path.join(packageRoot(), 'mcpb', 'server', 'index.js')], { env: { ...env, PATH: '/nonexistent', HOME: dir, VIBE_PROJECT_DIR: dir, VIBE_SKIP_SETUP: '1', VIBE_OFFLINE: '1' } });
      let out = '';
      server.stdout.on('data', (c: Buffer) => void (out += c.toString()));
      server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`);
      setTimeout(() => {
        server.kill();
        resolve(out);
      }, 1500);
    });
    expect(await ask({ VIBE_CLI: path.join(shim, 'vibe') })).toContain(`CLI ${path.join(shim, 'vibe')}`);
    expect(await ask({})).toContain('CLI not found');
  });
});
