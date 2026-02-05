/**
 * Kimi CLI 명령어
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import type { VibeConfig } from '../types.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Kimi 상태 확인
 */
export function kimiStatus(): void {
  try {
    const kimiStoragePath = path.join(__dirname, '../../lib/kimi-storage.js');
    const kimiConstantsPath = path.join(__dirname, '../../lib/kimi-constants.js');

    const storage = require(kimiStoragePath);
    const { KIMI_MODELS } = require(kimiConstantsPath);

    const hasKey = storage.hasApiKey();

    if (!hasKey) {
      // 환경변수 확인
      const envKey = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY;
      if (envKey) {
        console.log(`
📊 Kimi Status

Auth: ✅ Environment variable
Key: ${storage.maskApiKey(envKey)}

Available models:
${Object.entries(KIMI_MODELS).map(([id, info]) => `  - ${id}: ${(info as { description: string }).description}`).join('\n')}
        `);
        return;
      }

      console.log(`
📊 Kimi Status

No API key configured

Setup: vibe kimi key <MOONSHOT_API_KEY>
Or set MOONSHOT_API_KEY environment variable
      `);
      return;
    }

    const apiKey = storage.loadApiKey();
    console.log(`
📊 Kimi Status

Auth: ✅ API Key
Key: ${storage.maskApiKey(apiKey)}

Available models:
${Object.entries(KIMI_MODELS).map(([id, info]) => `  - ${id}: ${(info as { description: string }).description}`).join('\n')}

Logout: vibe kimi logout
    `);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Status check failed:', message);
  }
}

/**
 * Kimi 로그아웃 (API Key 삭제)
 */
export function kimiLogout(): void {
  try {
    const kimiStoragePath = path.join(__dirname, '../../lib/kimi-storage.js');
    const storage = require(kimiStoragePath);

    const removed = storage.removeApiKey();

    if (!removed) {
      console.log('No Kimi API key stored.');
      return;
    }

    console.log(`
✅ Kimi API key removed

Setup again: vibe kimi key <MOONSHOT_API_KEY>
    `);

    // config.json 업데이트
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.models && 'kimi' in config.models) {
          delete (config.models as Record<string, unknown>)['kimi'];
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
      } catch { /* ignore: optional operation */ }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Logout failed:', message);
  }
}
