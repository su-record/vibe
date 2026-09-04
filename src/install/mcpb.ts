import fs from 'node:fs';
import path from 'node:path';
import { packageRoot } from '../core/paths.js';
import { readJson, readText } from '../core/store.js';

/**
 * `.mcpb` for the Claude desktop app — a zip of manifest.json + server/index.js + README, built
 * here without a zip library (store method, CRC-32). The manifest is generated from package.json
 * like every other plugin surface; the server is a cable to the `vibe` CLI on the machine.
 */
export function mcpbManifest(version: string, description: string): Record<string, unknown> {
  return {
    manifest_version: '0.3',
    name: 'vibe',
    display_name: 'vibe — AX/FDE harness',
    version,
    description,
    long_description: 'Interview, intent and scenarios, one approval, a verdict the harness runs itself, inbox and ledger — in the Claude desktop app, on a project folder you choose. Building the code stays with Claude Code, Codex or Hermes; they share the same .vibe/ state. Needs the vibe CLI: npm i -g @su-record/vibe.',
    author: { name: 'su-record', url: 'https://github.com/su-record' },
    repository: { type: 'git', url: 'https://github.com/su-record/vibe.git' },
    homepage: 'https://github.com/su-record/vibe',
    license: 'MIT',
    keywords: ['harness', 'ax', 'fde', 'verification'],
    server: {
      type: 'node',
      entry_point: 'server/index.js',
      mcp_config: { command: 'node', args: ['${__dirname}/server/index.js'], env: { VIBE_PROJECT_DIR: '${user_config.project}', VIBE_CLI: '${user_config.vibe_cli}', VIBE_MCPB_VERSION: version } },
    },
    user_config: {
      project: { type: 'directory', title: 'Project folder', description: 'The repository vibe works in — its .vibe/ holds the intent, scenarios, evidence and ledger.', required: true },
      vibe_cli: { type: 'file', title: 'vibe executable (optional)', description: 'Leave empty to search PATH and the usual npm locations (Homebrew, nvm, fnm, volta). Set it when the app reports the CLI was not found — `which vibe` in a terminal prints the path.', required: false },
    },
    tools: [
      { name: 'vibe_state', description: 'Where the project is' },
      { name: 'vibe_profile', description: 'Profile a sample table' },
      { name: 'vibe_intent_draft', description: 'Save intent and scenarios' },
      { name: 'vibe_intent_show', description: 'Show intent and scenarios' },
      { name: 'vibe_approve', description: 'Approve the intent' },
      { name: 'vibe_check', description: 'Run the checks — the verdict' },
      { name: 'vibe_evidence', description: 'What a run executed' },
      { name: 'vibe_ask', description: 'Ask the human' },
      { name: 'vibe_inbox', description: 'Inbox questions and answers' },
      { name: 'vibe_ledger', description: 'Ledger and why' },
      { name: 'vibe_research', description: 'What exists on GitHub' },
      { name: 'vibe_skill_suggest', description: 'Skill proposals' },
    ],
    compatibility: { claude_desktop: '>=0.10.0', platforms: ['darwin', 'win32'], runtimes: { node: '>=20.0.0' } },
  };
}

// ─── zip (store) ────────────────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): { time: number; date: number } {
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}

/** Minimal zip writer: local headers + central directory + end record, no compression. */
export function zipStore(files: Array<{ name: string; data: Buffer }>, now = new Date()): Buffer {
  const { time, date } = dosTime(now);
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf-8');
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // utf-8 names
    local.writeUInt16LE(0, 8); // store
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, f.data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(f.data.length, 20);
    entry.writeUInt32LE(f.data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + f.data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

export interface McpbReport {
  file: string;
  bytes: number;
  version: string;
  entries: string[];
}

/** Build vibe.mcpb from the package: generated manifest, the server, the README. */
export function buildMcpb(out: string, root: string = packageRoot()): McpbReport {
  const pkg = readJson<{ version: string; description: string }>(path.join(root, 'package.json'));
  const version = pkg?.version ?? '0.0.0';
  const server = readText(path.join(root, 'mcpb', 'server', 'index.js'));
  if (server === null) throw new Error('mcpb/server/index.js is missing from this install');
  const files = [
    { name: 'manifest.json', data: Buffer.from(`${JSON.stringify(mcpbManifest(version, pkg?.description ?? ''), null, 2)}\n`) },
    { name: 'server/index.js', data: Buffer.from(server) },
    { name: 'README.md', data: Buffer.from(readText(path.join(root, 'mcpb', 'README.md')) ?? '') },
  ];
  const zip = zipStore(files);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, zip);
  return { file: path.resolve(out), bytes: zip.length, version, entries: files.map((f) => f.name) };
}
