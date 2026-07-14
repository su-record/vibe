import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { detectLlmAvailability, resetLlmAvailabilityCache } from './llm-availability.js';

describe('detectLlmAvailability', () => {
  const originalAntigravityApiKey = process.env.ANTIGRAVITY_API_KEY;
  const originalPath = process.env.PATH;
  const tempDirs: string[] = [];

  afterEach(() => {
    resetLlmAvailabilityCache();
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

  it('reports Antigravity CLI availability', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-home-'));
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-bin-'));
    tempDirs.push(homeDir, binDir);
    vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
    const exeName = process.platform === 'win32' ? 'agy.cmd' : 'agy';
    fs.writeFileSync(path.join(binDir, exeName), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    process.env.PATH = binDir;
    process.env.ANTIGRAVITY_API_KEY = 'test-key';

    const availability = detectLlmAvailability();

    expect(availability.antigravity).toBe(true);
  });
});
