/**
 * GPT OAuth 토큰 저장/로드
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Types
export interface GptAccount {
  email: string;
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  expires: number;
  accountId?: string;
  addedAt?: number;
  lastUsed?: number;
}

interface GptStorage {
  version: number;
  accounts: GptAccount[];
  activeIndex: number;
}

/**
 * 설정 디렉토리 경로 반환
 */
export function getConfigDir(): string {
  const platform = process.platform;
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe');
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdgConfig, 'vibe');
}

/**
 * 토큰 저장 경로 반환
 */
export function getStoragePath(): string {
  return path.join(getConfigDir(), 'gpt-auth.json');
}

/**
 * 디렉토리 생성 (존재하지 않으면)
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 계정 정보 로드
 */
export function loadAccounts(): GptStorage | null {
  try {
    const storagePath = getStoragePath();
    if (!fs.existsSync(storagePath)) {
      return null;
    }
    const content = fs.readFileSync(storagePath, 'utf-8');
    return JSON.parse(content) as GptStorage;
  } catch (error) {
    console.error('GPT account info load failed:', (error as Error).message);
    return null;
  }
}

/**
 * 계정 정보 저장
 */
export function saveAccounts(storage: GptStorage): void {
  try {
    const storagePath = getStoragePath();
    ensureDir(path.dirname(storagePath));
    fs.writeFileSync(storagePath, JSON.stringify(storage, null, 2), 'utf-8');
  } catch (error) {
    console.error('GPT account info save failed:', (error as Error).message);
    throw error;
  }
}

/**
 * 새 계정 추가
 */
export function addAccount(account: GptAccount): GptStorage {
  let storage = loadAccounts() || {
    version: 1,
    accounts: [],
    activeIndex: 0,
  };

  // 이메일로 중복 확인
  const existingIndex = storage.accounts.findIndex(a => a.email === account.email);
  if (existingIndex >= 0) {
    // 기존 계정 업데이트
    storage.accounts[existingIndex] = {
      ...storage.accounts[existingIndex],
      ...account,
      lastUsed: Date.now(),
    };
    storage.activeIndex = existingIndex;
  } else {
    // 새 계정 추가
    storage.accounts.push({
      ...account,
      addedAt: Date.now(),
      lastUsed: Date.now(),
    });
    storage.activeIndex = storage.accounts.length - 1;
  }

  saveAccounts(storage);
  return storage;
}

/**
 * 활성 계정 가져오기
 */
export function getActiveAccount(): GptAccount | null {
  const storage = loadAccounts();
  if (!storage || !storage.accounts || storage.accounts.length === 0) {
    return null;
  }
  const activeIndex = Math.min(storage.activeIndex || 0, storage.accounts.length - 1);
  return storage.accounts[activeIndex];
}

/**
 * 모든 계정 목록 가져오기
 */
export function getAllAccounts(): GptAccount[] {
  const storage = loadAccounts();
  if (!storage || !storage.accounts) {
    return [];
  }
  return storage.accounts;
}

/**
 * 계정 삭제
 */
export function removeAccount(email: string): boolean {
  const storage = loadAccounts();
  if (!storage || !storage.accounts) {
    return false;
  }

  const index = storage.accounts.findIndex(a => a.email === email);
  if (index < 0) {
    return false;
  }

  storage.accounts.splice(index, 1);
  if (storage.activeIndex >= storage.accounts.length) {
    storage.activeIndex = Math.max(0, storage.accounts.length - 1);
  }

  saveAccounts(storage);
  return true;
}

/**
 * 모든 계정 삭제
 */
export function clearAccounts(): void {
  try {
    const storagePath = getStoragePath();
    if (fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
    }
  } catch (error) {
    console.error('GPT account info deletion failed:', (error as Error).message);
  }
}

/**
 * 토큰 만료 여부 확인
 */
export function isTokenExpired(account: GptAccount | null): boolean {
  if (!account || !account.expires) {
    return true;
  }
  // 5분 여유를 두고 만료 확인
  return Date.now() > account.expires - 5 * 60 * 1000;
}

/**
 * 액세스 토큰 업데이트
 */
export function updateAccessToken(
  email: string,
  accessToken: string,
  refreshToken: string | null,
  expires: number
): boolean {
  const storage = loadAccounts();
  if (!storage || !storage.accounts) {
    return false;
  }

  const account = storage.accounts.find(a => a.email === email);
  if (!account) {
    return false;
  }

  account.accessToken = accessToken;
  if (refreshToken) {
    account.refreshToken = refreshToken;
  }
  account.expires = expires;
  account.lastUsed = Date.now();

  saveAccounts(storage);
  return true;
}
