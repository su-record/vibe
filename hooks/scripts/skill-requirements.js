#!/usr/bin/env node
/**
 * Skill Requirements Checker
 * Binary existence check + platform check + install hints
 */

import { spawnSync } from 'child_process';

// Binary existence cache (TTL: 5분)
const BINARY_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// Allowed binary name pattern (security)
const BINARY_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Check if a binary exists
 */
export function checkBinaryExists(name) {
  if (!BINARY_NAME_PATTERN.test(name)) {
    return false;
  }

  // Check cache
  const cached = BINARY_CACHE.get(name);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
    return cached.exists;
  }

  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = spawnSync(cmd, [name], {
      shell: false,
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const exists = result.status === 0;
    BINARY_CACHE.set(name, { exists, checkedAt: Date.now() });
    return exists;
  } catch {
    BINARY_CACHE.set(name, { exists: false, checkedAt: Date.now() });
    return false;
  }
}

/**
 * Check all required binaries
 */
export function checkAllRequirements(requires) {
  if (!requires || !Array.isArray(requires)) return [];

  return requires.map(name => ({
    name,
    exists: checkBinaryExists(name),
  }));
}

/**
 * Get install hint for current platform
 */
export function getInstallHint(install, platform) {
  if (!install || typeof install !== 'object') return null;
  platform = platform || process.platform;

  if (platform === 'darwin' && install.brew) return `brew install ${install.brew}`;
  if (platform === 'linux' && install.apt) return `apt install ${install.apt}`;
  if (platform === 'win32' && install.choco) return `choco install ${install.choco}`;
  if (install.npm) return `npm install -g ${install.npm}`;
  if (install.url) return `Download: ${install.url}`;

  // Try brew as fallback for darwin/linux
  if (install.brew && platform !== 'win32') return `brew install ${install.brew}`;

  return null;
}

/**
 * Check platform compatibility
 */
export function checkPlatform(os) {
  if (!os || !Array.isArray(os) || os.length === 0) return true;
  return os.includes(process.platform);
}
