/**
 * vibe sync — AES-256-GCM 암호화/복호화
 */

import crypto from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const SALT_LEN = 16;
const PBKDF2_ITERATIONS = 100_000;

/**
 * 랜덤 32바이트 키 생성 (base64 반환)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LEN).toString('base64');
}

/**
 * 패스프레이즈로부터 키 유도 (PBKDF2)
 */
export function deriveKeyFromPassphrase(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LEN, 'sha256');
}

/**
 * AES-256-GCM 암호화
 * @param plaintext - 암호화할 데이터
 * @param keyBase64 - base64 인코딩된 32바이트 키 (또는 Buffer)
 * @param optionalSalt - 패스프레이즈 유도 시 사용한 salt (첫 16바이트가 payload 앞에 붙음)
 */
export function encrypt(plaintext: Buffer, keyBase64: string | Buffer): Buffer {
  const key = typeof keyBase64 === 'string' ? Buffer.from(keyBase64, 'base64') : keyBase64;
  if (key.length !== KEY_LEN) throw new Error('Encryption key must be 32 bytes');
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * AES-256-GCM 복호화
 */
export function decrypt(ciphertext: Buffer, keyBase64: string | Buffer): Buffer {
  const key = typeof keyBase64 === 'string' ? Buffer.from(keyBase64, 'base64') : keyBase64;
  if (key.length !== KEY_LEN) throw new Error('Decryption key must be 32 bytes');
  if (ciphertext.length < IV_LEN + TAG_LEN) throw new Error('Ciphertext too short');
  const iv = ciphertext.subarray(0, IV_LEN);
  const tag = ciphertext.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = ciphertext.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
