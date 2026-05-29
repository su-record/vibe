import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { detectCodexCli } from './cli-detector.js';

describe('detectCodexCli', () => {
  const originalCodexHome = process.env.CODEX_HOME;
  const tempDirs: string[] = [];

  afterEach(() => {
    if (originalCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
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
});
