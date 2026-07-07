import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { writeHookPackageJson } from './GlobalInstaller.js';

describe('GlobalInstaller', () => {
  it('writes an ESM marker package.json next to copied hooks', (): void => {
    const globalCoreDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-global-core-'));
    fs.writeFileSync(
      path.join(globalCoreDir, 'package.json'),
      JSON.stringify({ dependencies: { puppeteer: '^25.2.1' } }, null, 2),
    );

    writeHookPackageJson(globalCoreDir);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(globalCoreDir, 'package.json'), 'utf-8'),
    ) as { dependencies?: { puppeteer?: unknown }; type?: unknown };

    expect(packageJson.dependencies?.puppeteer).toBe('^25.2.1');
    expect(packageJson.type).toBe('module');
  });
});
