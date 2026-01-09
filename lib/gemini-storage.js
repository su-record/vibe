/**
 * Gemini OAuth 토큰 저장/로드
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * 설정 디렉토리 경로 반환
 */
function getConfigDir() {
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
function getStoragePath() {
  return path.join(getConfigDir(), 'gemini-auth.json');
}

/**
 * 디렉토리 생성 (존재하지 않으면)
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 계정 정보 로드
 * @returns {Object|null} 계정 정보 또는 null
 */
function loadAccounts() {
  try {
    const storagePath = getStoragePath();
    if (!fs.existsSync(storagePath)) {
      return null;
    }
    const content = fs.readFileSync(storagePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('계정 정보 로드 실패:', error.message);
    return null;
  }
}

/**
 * 계정 정보 저장
 * @param {Object} storage 저장할 계정 정보
 */
function saveAccounts(storage) {
  try {
    const storagePath = getStoragePath();
    ensureDir(path.dirname(storagePath));
    fs.writeFileSync(storagePath, JSON.stringify(storage, null, 2), 'utf-8');
  } catch (error) {
    console.error('계정 정보 저장 실패:', error.message);
    throw error;
  }
}

/**
 * 새 계정 추가
 * @param {Object} account 계정 정보
 */
function addAccount(account) {
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
 * @returns {Object|null} 활성 계정 또는 null
 */
function getActiveAccount() {
  const storage = loadAccounts();
  if (!storage || !storage.accounts || storage.accounts.length === 0) {
    return null;
  }
  const activeIndex = Math.min(storage.activeIndex || 0, storage.accounts.length - 1);
  return storage.accounts[activeIndex];
}

/**
 * 모든 계정 목록 가져오기
 * @returns {Array} 계정 목록
 */
function getAllAccounts() {
  const storage = loadAccounts();
  if (!storage || !storage.accounts) {
    return [];
  }
  return storage.accounts;
}

/**
 * 계정 삭제
 * @param {string} email 삭제할 계정 이메일
 */
function removeAccount(email) {
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
function clearAccounts() {
  try {
    const storagePath = getStoragePath();
    if (fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
    }
  } catch (error) {
    console.error('계정 정보 삭제 실패:', error.message);
  }
}

/**
 * 토큰 만료 여부 확인
 * @param {Object} account 계정 정보
 * @returns {boolean} 만료 여부
 */
function isTokenExpired(account) {
  if (!account || !account.expires) {
    return true;
  }
  // 5분 여유를 두고 만료 확인
  return Date.now() > account.expires - 5 * 60 * 1000;
}

/**
 * 액세스 토큰 업데이트
 * @param {string} email 계정 이메일
 * @param {string} accessToken 새 액세스 토큰
 * @param {number} expires 만료 시간 (timestamp)
 */
function updateAccessToken(email, accessToken, expires) {
  const storage = loadAccounts();
  if (!storage || !storage.accounts) {
    return false;
  }

  const account = storage.accounts.find(a => a.email === email);
  if (!account) {
    return false;
  }

  account.accessToken = accessToken;
  account.expires = expires;
  account.lastUsed = Date.now();

  saveAccounts(storage);
  return true;
}

module.exports = {
  getConfigDir,
  getStoragePath,
  loadAccounts,
  saveAccounts,
  addAccount,
  getActiveAccount,
  getAllAccounts,
  removeAccount,
  clearAccounts,
  isTokenExpired,
  updateAccessToken,
};
