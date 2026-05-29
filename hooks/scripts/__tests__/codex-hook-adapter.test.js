import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADAPTER = path.resolve(__dirname, '..', 'codex-hook-adapter.js');

describe('codex-hook-adapter', () => {
  it('converts a PreToolUse denial into Codex permission output', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-codex-adapter-'));
    const payload = JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    });

    const result = spawnSync(process.execPath, [ADAPTER, 'PreToolUse'], {
      cwd,
      input: payload,
      encoding: 'utf-8',
      timeout: 5000,
    });

    expect(result.status).toBe(2);
    const output = JSON.parse(result.stdout.trim());
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput.permissionDecisionReason).toContain('Deleting root or home directory');
  });
});
