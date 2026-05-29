import { describe, it, expect } from 'vitest';
import path from 'path';
import { getProjectConfigPath } from './GlobalConfigManager.js';

describe('GlobalConfigManager project config path', () => {
  it('uses .vibe/config.json as the project config SSOT', () => {
    expect(getProjectConfigPath('/repo')).toBe(path.join('/repo', '.vibe', 'config.json'));
  });
});
