import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

describe('llm-orchestrate Antigravity provider', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('calls agy -p for Antigravity text orchestration', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-agy-'));
    const binDir = path.join(root, 'bin');
    const homeDir = path.join(root, 'home');
    const capturePath = path.join(root, 'capture.json');
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });
    tempDirs.push(root);

    fs.writeFileSync(
      path.join(binDir, 'agy'),
      [
        `#!${process.execPath}`,
        'const fs = require("fs");',
        'const stdin = fs.readFileSync(0, "utf8");',
        'fs.writeFileSync(process.env.AGY_CAPTURE, JSON.stringify({ argv: process.argv.slice(2), stdin }));',
        'process.stdout.write("antigravity ok");',
        '',
      ].join('\n'),
      { mode: 0o755 }
    );

    const scriptPath = path.resolve('hooks/scripts/llm-orchestrate.js');
    const output = execFileSync(
      process.execPath,
      [scriptPath, 'antigravity', 'orchestrate-json', 'System prompt', 'User prompt'],
      {
        cwd: root,
        env: {
          ...process.env,
          HOME: homeDir,
          PATH: `${binDir}:${process.env.PATH || ''}`,
          AGY_CAPTURE: capturePath,
        },
        encoding: 'utf8',
        timeout: 5000,
      }
    );

    const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
    expect(output).toContain('Antigravity response: antigravity ok');
    expect(capture.argv[0]).toBe('-p');
    expect(capture.argv[1]).toContain('[System]\nSystem prompt');
    expect(capture.argv[1]).toContain('[User]\nUser prompt');
    expect(capture.argv[1]).toContain('valid JSON only');
    expect(capture.stdin).toBe('');
  });
});
