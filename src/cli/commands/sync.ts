/**
 * vibe sync — Google Drive AppData 인증/메모리 동기화 CLI
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  runSyncLogin,
  loadSyncAuth,
  getSyncAuthPath,
  encrypt,
  decrypt,
  uploadAuthEnc,
  uploadMemoryEnc,
  downloadAuthEnc,
  downloadMemoryEnc,
} from '../../lib/sync/index.js';
import { getGlobalConfigDir } from '../../lib/llm/auth/ConfigManager.js';

const AUTH_FILES = [
  'gemini-auth.json',
  'gemini-apikey.json',
  'gpt-auth.json',
  'gpt-apikey.json',
  'nvidia-apikey.json',
  'kimi-apikey.json',
];

function getClaudeVibeDir(): string {
  return path.join(os.homedir(), '.claude', 'vibe');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function syncLogin(): Promise<void> {
  try {
    const { email } = await runSyncLogin();
    console.log('✅ vibe sync 로그인 완료.');
    if (email) console.log(`   계정: ${email}`);
  } catch (err) {
    console.error('❌', (err as Error).message);
    process.exit(1);
  }
}

export async function syncPush(only?: 'auth' | 'memory'): Promise<void> {
  const auth = loadSyncAuth();
  if (!auth?.encryptionKey) {
    console.error('❌ 로그인 필요: vibe sync login');
    process.exit(1);
  }
  const key = Buffer.from(auth.encryptionKey, 'base64');

  try {
    if (only !== 'memory') {
      const configDir = getGlobalConfigDir();
      const payload: Record<string, string> = {};
      for (const name of AUTH_FILES) {
        const p = path.join(configDir, name);
        if (fs.existsSync(p)) {
          payload[name] = fs.readFileSync(p, 'utf-8');
        }
      }
      const plain = Buffer.from(JSON.stringify(payload), 'utf-8');
      await uploadAuthEnc(encrypt(plain, key));
      console.log('✅ 인증 파일 업로드 완료.');
    }
    if (only !== 'auth') {
      const vibeDir = getClaudeVibeDir();
      const parts: Buffer[] = [];
      for (const name of ['session-rag.db', 'memories.json']) {
        const p = path.join(vibeDir, name);
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p);
          const nameBuf = Buffer.from(name, 'utf-8');
          const lenBuf = Buffer.allocUnsafe(4);
          lenBuf.writeUInt32LE(content.length, 0);
          parts.push(nameBuf, Buffer.from([0]), lenBuf, content);
        }
      }
      if (parts.length > 0) {
        await uploadMemoryEnc(encrypt(Buffer.concat(parts), key));
        console.log('✅ 전역 메모리 업로드 완료.');
      } else {
        console.log('   전역 메모리 파일 없음 (스킵).');
      }
    }
  } catch (err) {
    console.error('❌', (err as Error).message);
    process.exit(1);
  }
}

export async function syncPull(only?: 'auth' | 'memory'): Promise<void> {
  const auth = loadSyncAuth();
  if (!auth?.encryptionKey) {
    console.error('❌ 로그인 필요: vibe sync login');
    process.exit(1);
  }
  const key = Buffer.from(auth.encryptionKey, 'base64');

  try {
    if (only !== 'memory') {
      const enc = await downloadAuthEnc();
      if (enc) {
        const plain = decrypt(enc, key);
        const payload = JSON.parse(plain.toString('utf-8')) as Record<string, string>;
        const configDir = getGlobalConfigDir();
        ensureDir(configDir);
        for (const [name, content] of Object.entries(payload)) {
          const p = path.join(configDir, name);
          if (fs.existsSync(p)) {
            fs.copyFileSync(p, p + '.backup');
          }
          fs.writeFileSync(p, content, { mode: 0o600 });
        }
        console.log('✅ 인증 파일 복원 완료.');
      } else {
        console.log('   클라우드에 인증 파일 없음.');
      }
    }
    if (only !== 'auth') {
      const enc = await downloadMemoryEnc();
      if (enc) {
        const plain = decrypt(enc, key);
        const vibeDir = getClaudeVibeDir();
        ensureDir(vibeDir);
        let offset = 0;
        while (offset < plain.length) {
          const nul = plain.indexOf(0, offset);
          if (nul < 0) break;
          const name = plain.subarray(offset, nul).toString('utf-8');
          offset = nul + 1;
          if (offset + 4 > plain.length) break;
          const len = plain.readUInt32LE(offset);
          offset += 4;
          if (offset + len > plain.length) break;
          const content = plain.subarray(offset, offset + len);
          offset += len;
          const p = path.join(vibeDir, name);
          if (fs.existsSync(p)) fs.copyFileSync(p, p + '.backup');
          fs.writeFileSync(p, content, { mode: 0o600 });
        }
        console.log('✅ 전역 메모리 복원 완료.');
      } else {
        console.log('   클라우드에 메모리 파일 없음.');
      }
    }
  } catch (err) {
    console.error('❌', (err as Error).message);
    process.exit(1);
  }
}

export function syncStatus(): void {
  const auth = loadSyncAuth();
  if (!auth) {
    console.log('vibe sync: ⬚ 로그인 안 됨 (vibe sync login)');
    return;
  }
  console.log(`vibe sync: ✅ 로그인됨 ${auth.email ?? '(이메일 없음)'}`);
}

export function syncLogout(): void {
  const p = getSyncAuthPath();
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log('✅ vibe sync 로그아웃 완료.');
  } else {
    console.log('   이미 로그아웃 상태.');
  }
}
