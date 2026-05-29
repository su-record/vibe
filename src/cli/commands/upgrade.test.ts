import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { readInstalledLLMStatus } from './upgrade.js';

describe('upgrade command helpers', () => {
  it('reads LLM status from the newly installed package', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-upgrade-'));
    const authDir = path.join(tempRoot, '@su-record', 'vibe', 'dist', 'cli');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(
      path.join(authDir, 'auth.js'),
      'export function formatLLMStatus() { return "FRESH ANTIGRAVITY STATUS"; }\n',
    );

    expect(readInstalledLLMStatus(tempRoot)).toBe('FRESH ANTIGRAVITY STATUS');
  });
});
