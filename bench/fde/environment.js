import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentEnvironment } from '../workspace.js';

/** Credentials only. Operator projects, instructions, plugins and model config stay out of every arm. */
export function isolatedEnvironment(root, product, source = process.env) {
  const home = path.join(root, 'home');
  const shim = path.join(root, 'bin');
  fs.mkdirSync(shim, { recursive: true });
  for (const [dir, file] of [['.claude', '.credentials.json'], ['.codex', 'auth.json']]) {
    fs.mkdirSync(path.join(home, dir), { recursive: true });
    const original = path.join(os.homedir(), dir, file);
    if (fs.existsSync(original)) fs.copyFileSync(original, path.join(home, dir, file));
  }
  const driver = fileURLToPath(new URL('../vibe-shim.js', import.meta.url));
  const cli = path.join(product, 'dist/cli.js');
  if (process.platform === 'win32') fs.writeFileSync(path.join(shim, 'vibe.cmd'), `@echo off\r\n"${process.execPath}" "${driver}" "${cli}" %*\r\n`);
  else fs.writeFileSync(path.join(shim, 'vibe'), `#!/bin/sh\nexec '${process.execPath.replaceAll("'", "'\\''")}' '${driver.replaceAll("'", "'\\''")}' '${cli.replaceAll("'", "'\\''")}' "$@"\n`, { mode: 0o755 });
  const env = agentEnvironment({ ...source, HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex'),
    VIBE_HOME_DIR: home, VIBE_SKIP_SETUP: '1', PATH: `${shim}${path.delimiter}${source.PATH}`,
    VIBE_BENCH_SNAPSHOTS: path.join(root, 'product-approvals.jsonl') });
  for (const key of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_PROJECT_DIR', 'CODEX_THREAD_ID']) delete env[key];
  return env;
}
