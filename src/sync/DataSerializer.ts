/**
 * DataSerializer - Export/Import sync data
 * Phase 5: Sync & Portability
 *
 * Handles memory, policy, and settings serialization.
 * Credentials are always excluded from settings export.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { SerializedData, SyncTarget } from './types.js';
import { LogLevel } from '../daemon/types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');

/** Patterns for files that should NEVER be synced (credentials) */
const CREDENTIAL_PATTERNS = [
  /api[-_]?key/i,
  /token/i,
  /credential/i,
  /secret/i,
  /password/i,
  /private[-_]?key/i,
  /\.enc$/,
  /\.pem$/,
  /\.key$/,
  /vault/i,
  /oauth/i,
  /auth\.json$/,
];

export class DataSerializer {
  private logger: (level: LogLevel, message: string, data?: unknown) => void;

  constructor(logger: (level: LogLevel, message: string, data?: unknown) => void) {
    this.logger = logger;
  }

  /** Export memory data */
  exportMemory(since?: string): SerializedData {
    const items: SerializedData['items'] = [];
    const memoryDir = path.join(os.homedir(), '.claude', 'vibe');

    for (const file of ['memories.json', 'session-rag.db']) {
      const filePath = path.join(memoryDir, file);
      if (!fs.existsSync(filePath)) continue;

      const stat = fs.statSync(filePath);
      const modifiedAt = stat.mtime.toISOString();

      if (since && modifiedAt < since) continue;

      const content = fs.readFileSync(filePath);
      items.push({
        key: file,
        value: content.toString('base64'),
        modifiedAt,
        hlc: `${stat.mtimeMs}:0:local`,
      });
    }

    return {
      target: 'memory',
      items,
      exportedAt: new Date().toISOString(),
    };
  }

  /** Import memory data */
  importMemory(data: SerializedData): number {
    const memoryDir = path.join(os.homedir(), '.claude', 'vibe');
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }

    let imported = 0;
    for (const item of data.items) {
      if (!this.isSafePath(item.key, memoryDir)) {
        this.logger('warn', `Skipping unsafe path: ${item.key}`);
        continue;
      }
      const filePath = path.join(memoryDir, path.basename(item.key));

      // Backup existing
      if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, filePath + '.backup');
      }

      fs.writeFileSync(filePath, Buffer.from(item.value, 'base64'), { mode: 0o600 });
      imported++;
    }

    return imported;
  }

  /** Export policy files */
  exportPolicies(): SerializedData {
    const items: SerializedData['items'] = [];
    const policyDir = path.join(VIBE_DIR, 'policies');

    if (!fs.existsSync(policyDir)) {
      return { target: 'policy', items, exportedAt: new Date().toISOString() };
    }

    const files = fs.readdirSync(policyDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(policyDir, file);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');

      items.push({
        key: file,
        value: content,
        modifiedAt: stat.mtime.toISOString(),
        hlc: `${stat.mtimeMs}:0:local`,
      });
    }

    return {
      target: 'policy',
      items,
      exportedAt: new Date().toISOString(),
    };
  }

  /** Import policy files */
  importPolicies(data: SerializedData): number {
    const policyDir = path.join(VIBE_DIR, 'policies');
    if (!fs.existsSync(policyDir)) {
      fs.mkdirSync(policyDir, { recursive: true });
    }

    let imported = 0;
    for (const item of data.items) {
      if (!this.isSafePath(item.key, policyDir)) {
        this.logger('warn', `Skipping unsafe path: ${item.key}`);
        continue;
      }
      const filePath = path.join(policyDir, path.basename(item.key));
      if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, filePath + '.backup');
      }
      fs.writeFileSync(filePath, item.value, { mode: 0o600 });
      imported++;
    }

    return imported;
  }

  /** Export settings (excluding credentials) */
  exportSettings(): SerializedData {
    const items: SerializedData['items'] = [];

    // Config file
    const configPath = path.join(VIBE_DIR, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content) as Record<string, unknown>;

        // Strip credential fields
        const sanitized = this.stripCredentials(config);
        const stat = fs.statSync(configPath);

        items.push({
          key: 'config.json',
          value: JSON.stringify(sanitized),
          modifiedAt: stat.mtime.toISOString(),
          hlc: `${stat.mtimeMs}:0:local`,
        });
      } catch (err) {
        this.logger('warn', `Failed to export settings: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      target: 'settings',
      items,
      exportedAt: new Date().toISOString(),
    };
  }

  /** Import settings */
  importSettings(data: SerializedData): number {
    let imported = 0;
    for (const item of data.items) {
      if (item.key !== 'config.json') continue;
      const filePath = path.join(VIBE_DIR, 'config.json');
      if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, filePath + '.backup');
      }
      fs.writeFileSync(filePath, item.value, { mode: 0o600 });
      imported++;
    }
    return imported;
  }

  /** Check if a file is a credential file */
  isCredentialFile(filename: string): boolean {
    return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(filename));
  }

  /** Compute hash for change detection */
  computeHash(content: string | Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  // ========================================================================
  // Private
  // ========================================================================

  /** Validate path is safe (no directory traversal) */
  private isSafePath(key: string, baseDir: string): boolean {
    const basename = path.basename(key);
    if (basename !== key || key.includes('..') || key.startsWith('.')) {
      return false;
    }
    const resolved = path.resolve(baseDir, basename);
    return resolved.startsWith(baseDir + path.sep) || resolved === baseDir;
  }

  private stripCredentials(config: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      // Skip credential-like keys
      if (CREDENTIAL_PATTERNS.some((p) => p.test(key))) continue;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.stripCredentials(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
