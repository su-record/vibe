/**
 * Azure Foundry CLI 명령어
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
 * AZ 상태 확인
 */
export function azStatus(): void {
  try {
    const storagePath = path.join(__dirname, '../../lib/az-storage.js');
    const constantsPath = path.join(__dirname, '../../lib/az-constants.js');

    const storage = require(storagePath);
    const { AZ_MODELS } = require(constantsPath);

    const hasKey = storage.hasApiKey();

    if (!hasKey) {
      // 환경변수 확인
      const envKey = process.env.AZ_API_KEY;
      if (envKey) {
        console.log(`
📊 AZ Status

Auth: ✅ Environment variable
Key: ${storage.maskApiKey(envKey)}

Available models:
${Object.entries(AZ_MODELS).map(([id, info]) => `  - ${id}: ${(info as { description: string }).description}`).join('\n')}
        `);
        return;
      }

      console.log(`
📊 AZ Status

No API key configured

Setup: vibe az key <AZ_API_KEY>
Or set AZ_API_KEY environment variable
      `);
      return;
    }

    const apiKey = storage.loadApiKey();
    console.log(`
📊 AZ Status

Auth: ✅ API Key
Key: ${storage.maskApiKey(apiKey)}

Available models:
${Object.entries(AZ_MODELS).map(([id, info]) => `  - ${id}: ${(info as { description: string }).description}`).join('\n')}

Logout: vibe az logout
    `);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Status check failed:', message);
  }
}

/**
 * AZ 로그아웃 (API Key 삭제)
 */
export function azLogout(): void {
  try {
    const storagePath = path.join(__dirname, '../../lib/az-storage.js');
    const storage = require(storagePath);

    const removed = storage.removeApiKey();

    if (!removed) {
      console.log('No AZ API key stored.');
      return;
    }

    console.log(`
✅ AZ API key removed

Setup again: vibe az key <AZ_API_KEY>
    `);

    // config.json 업데이트
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.models && 'az' in config.models) {
          delete (config.models as Record<string, unknown>)['az'];
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
      } catch { /* ignore: optional operation */ }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Logout failed:', message);
  }
}

