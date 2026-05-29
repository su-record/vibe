import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { showHelp, showStatus } from './info.js';

const originalCwd = process.cwd();

function captureLog(run: () => void): string {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((message?: unknown) => {
    lines.push(String(message ?? ''));
  });
  try {
    run();
  } finally {
    spy.mockRestore();
  }
  return lines.join('\n');
}

describe('CLI info commands', () => {
  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('describes all supported harnesses in help output', () => {
    const output = captureLog(showHelp);

    expect(output).toContain('Claude Code / Codex / Antigravity');
    expect(output).toContain('vibe init --antigravity');
    expect(output).not.toContain(['Claude Code', 'exclusive'].join(' '));
    expect(output).not.toContain(['Gemini', 'CLI'].join(' '));
  });

  it('detects .vibe as the project status directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-status-'));
    fs.mkdirSync(path.join(tempDir, '.vibe'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, '.vibe', 'config.json'),
      JSON.stringify({ language: 'ko', models: {} }),
    );

    process.chdir(tempDir);
    const output = captureLog(showStatus);

    expect(output).toContain(`Project: ✅ ${fs.realpathSync(tempDir)}`);
    expect(output).not.toContain('Not a core project');
  });
});
