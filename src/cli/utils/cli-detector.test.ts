import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { detectAntigravityCli, detectCodexCli } from './cli-detector.js';

describe('detectCodexCli', () => {
  const originalCodexHome = process.env.CODEX_HOME;
  const originalAntigravityApiKey = process.env.ANTIGRAVITY_API_KEY;
  const originalPath = process.env.PATH;
  const tempDirs: string[] = [];

  afterEach(() => {
    if (originalCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
    if (originalAntigravityApiKey === undefined) {
      delete process.env.ANTIGRAVITY_API_KEY;
    } else {
      process.env.ANTIGRAVITY_API_KEY = originalAntigravityApiKey;
    }
    process.env.PATH = originalPath;
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses CODEX_HOME when locating Codex config and plugins', () => {
    const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-codex-home-'));
    tempDirs.push(codexHome);
    process.env.CODEX_HOME = codexHome;

    const status = detectCodexCli();

    expect(status.configDir).toBe(codexHome);
    expect(status.pluginDir).toBe(path.join(codexHome, 'plugins', 'vibe'));
  });

  it('detects Antigravity CLI as an installed orchestration CLI', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-home-'));
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-bin-'));
    tempDirs.push(homeDir, binDir);
    vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
    const exeName = process.platform === 'win32' ? 'agy.cmd' : 'agy';
    fs.writeFileSync(path.join(binDir, exeName), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    process.env.PATH = binDir;
    process.env.ANTIGRAVITY_API_KEY = 'test-key';

    const status = detectAntigravityCli();

    expect(status.installed).toBe(true);
    expect(status.authenticated).toBe(true);
  });
});
