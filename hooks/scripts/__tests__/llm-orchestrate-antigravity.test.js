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

  // win32 skip: spawnCli가 cmd.exe /c 로 실행하는데 cmd.exe는 인자 내 LF에서 명령을
  // 절단하므로 멀티라인 프롬프트의 argv 전송 자체가 불가능하다 (프로덕션 결함 — codex/claude
  // 경로처럼 stdin 전송으로 전환할지는 agy CLI의 stdin 지원 확인 후 결정).
  it.skipIf(process.platform === 'win32')('calls agy -p for Antigravity text orchestration', () => {
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
          PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
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
