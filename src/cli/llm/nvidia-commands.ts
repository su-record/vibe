/**
 * NVIDIA NIM CLI 명령어
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
 * NVIDIA NIM 상태 확인
 */
export function nvidiaStatus(): void {
  try {
    const storagePath = path.join(__dirname, '../../lib/nvidia-storage.js');
    const constantsPath = path.join(__dirname, '../../lib/nvidia-constants.js');

    const storage = require(storagePath);
    const { NVIDIA_MODELS } = require(constantsPath);

    const hasKey = storage.hasApiKey();

    if (!hasKey) {
      // 환경변수 확인
      const envKey = process.env.NVIDIA_API_KEY || process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY;
      if (envKey) {
        console.log(`
📊 NVIDIA NIM Status

Auth: ✅ Environment variable
Key: ${storage.maskApiKey(envKey)}

Available models:
${Object.entries(NVIDIA_MODELS).map(([id, info]) => `  - ${id}: ${(info as { description: string }).description}`).join('\n')}
        `);
        return;
      }

      console.log(`
📊 NVIDIA NIM Status

No API key configured

Setup: vibe nvidia key <NVIDIA_API_KEY>
Get key: https://build.nvidia.com/
Or set NVIDIA_API_KEY environment variable
      `);
      return;
    }

    const apiKey = storage.loadApiKey();
    console.log(`
📊 NVIDIA NIM Status

Auth: ✅ API Key
Key: ${storage.maskApiKey(apiKey)}

Available models:
${Object.entries(NVIDIA_MODELS).map(([id, info]) => `  - ${id}: ${(info as { description: string }).description}`).join('\n')}

Logout: vibe nvidia logout
    `);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Status check failed:', message);
  }
}

/**
 * NVIDIA NIM 로그아웃 (API Key 삭제)
 */
export function nvidiaLogout(): void {
  try {
    const storagePath = path.join(__dirname, '../../lib/nvidia-storage.js');
    const storage = require(storagePath);

    const removed = storage.removeApiKey();

    if (!removed) {
      console.log('No NVIDIA API key stored.');
      return;
    }

    console.log(`
✅ NVIDIA API key removed

Setup again: vibe nvidia key <NVIDIA_API_KEY>
    `);

    // config.json 업데이트
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.models && 'nvidia' in config.models) {
          delete (config.models as Record<string, unknown>)['nvidia'];
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
      } catch { /* ignore: optional operation */ }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Logout failed:', message);
  }
}

// 하위 호환
/** @deprecated Use nvidiaStatus */
export const kimiStatus = nvidiaStatus;
/** @deprecated Use nvidiaLogout */
export const kimiLogout = nvidiaLogout;
