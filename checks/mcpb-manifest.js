#!/usr/bin/env node
// The generated bundle manifest must carry the optional `vibe_cli` file setting mapped to VIBE_CLI.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const out = path.join(os.tmpdir(), `vibe-manifest-check-${process.pid}.mcpb`);
execFileSync('node', ['dist/cli.js', 'plugin', 'mcpb', '--out', out], { stdio: 'ignore', env: { ...process.env, VIBE_SKIP_SETUP: '1' } });
const buf = fs.readFileSync(out);
fs.rmSync(out, { force: true });
// manifest.json is the first stored entry: local header (30 bytes) + name, then the bytes
const nameLen = buf.readUInt16LE(26);
const size = buf.readUInt32LE(22);
const manifest = JSON.parse(buf.subarray(30 + nameLen, 30 + nameLen + size).toString('utf-8'));
const setting = manifest.user_config?.vibe_cli;
const env = manifest.server?.mcp_config?.env?.VIBE_CLI;
if (setting?.type !== 'file' || env !== '${user_config.vibe_cli}') {
  console.error(`manifest: vibe_cli ${JSON.stringify(setting)} · VIBE_CLI ${env}`);
  process.exit(1);
}
console.log(`manifest ${manifest.version}: vibe_cli file setting → VIBE_CLI`);
