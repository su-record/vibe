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

  // 프롬프트는 argv가 아니라 stdin pipe로 전달한다 (agy 1.1.1+: -p 단독이면 stdin에서
  // 프롬프트를 읽음). argv 전송은 Windows cmd.exe /c가 인자 내 LF에서 명령을 절단해
  // 멀티라인 프롬프트가 구조적으로 깨지므로 금지 — 멀티라인 프롬프트로 이를 고정한다.
  it('calls agy -p with the prompt piped via stdin', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-agy-'));
    const binDir = path.join(root, 'bin');
    const homeDir = path.join(root, 'home');
    const capturePath = path.join(root, 'capture.json');
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });
    tempDirs.push(root);

    const mockJs = path.join(binDir, 'agy-mock.js');
    fs.writeFileSync(
      mockJs,
      [
        'const fs = require("fs");',
        'let stdin = "";',
        'try { stdin = fs.readFileSync(0, "utf8"); } catch { /* stdin closed */ }',
        'fs.writeFileSync(process.env.AGY_CAPTURE, JSON.stringify({ argv: process.argv.slice(2), stdin }));',
        'process.stdout.write("antigravity ok");',
        '',
      ].join('\n')
    );
    if (process.platform === 'win32') {
      fs.writeFileSync(
        path.join(binDir, 'agy.cmd'),
        `@echo off\r\n"${process.execPath}" "${mockJs}" %*\r\n`
      );
    } else {
      fs.writeFileSync(
        path.join(binDir, 'agy'),
        `#!/bin/sh\nexec "${process.execPath}" "${mockJs}" "$@"\n`,
        { mode: 0o755 }
      );
    }

    const scriptPath = path.resolve('hooks/scripts/llm-orchestrate.js');
    const output = execFileSync(
      process.execPath,
      [scriptPath, 'antigravity', 'orchestrate-json', 'System prompt', 'User prompt line 1\nline 2'],
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
    expect(capture.argv).toEqual(['-p']);
    expect(capture.stdin).toContain('[System]\nSystem prompt');
    expect(capture.stdin).toContain('[User]\nUser prompt line 1\nline 2');
    expect(capture.stdin).toContain('valid JSON only');
  });
});
