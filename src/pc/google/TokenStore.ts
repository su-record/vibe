/**
 * TokenStore — SQLite 기반 per-user 토큰 저장소
 *
 * - Envelope encryption: KEK(master key) → DEK 암호화, DEK → 토큰 암호화
 * - Token family rotation: refresh token 갱신 시 family 내 generation 증가
 * - Reuse detection: 이전 generation token 사용 시 family 전체 폐기
 * - AsyncMutex: 동시 갱신 방지 (1회만 갱신, 나머지 대기)
 * - Preemptive refresh: 80% lifetime 시점에 자동 갱신
 */

import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import Database from 'better-sqlite3';
import type {
  DecryptedTokens,
  EncryptedTokenRow,
  TokenFamily,
  GoogleLogger,
  EnvelopeEncrypted,
} from './types.js';
import { createGoogleError } from './types.js';
import { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEK_VERSION = 1;

export class TokenStore {
  private db: Database.Database;
  private kek: Buffer;
  private logger: GoogleLogger;
  private refreshMutexes = new Map<string, Promise<DecryptedTokens>>();

  private ownsDb: boolean;

  constructor(logger: GoogleLogger, dbOrPath?: Database.Database | string) {
    this.logger = logger;

    if (dbOrPath && typeof dbOrPath !== 'string') {
      // 외부 DB 인스턴스 주입 (Dual DB 방지)
      this.db = dbOrPath;
      this.ownsDb = false;
    } else {
      const resolvedPath = (typeof dbOrPath === 'string' ? dbOrPath : undefined)
        ?? path.join(getGlobalConfigDir(), 'google-tokens.db');
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(resolvedPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.ownsDb = true;
    }
    this.kek = this.loadOrCreateKEK();
    this.initSchema();
  }

  // ════════════════════════════════════════════════════════════
  // Public API
  // ════════════════════════════════════════════════════════════

  /** 토큰 저장 (암호화 + family 생성) */
  save(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    scopes: string[],
  ): void {
    const familyId = this.createFamily(userId);
    const scopeHash = this.hashScopes(scopes);
    const expiresAt = Date.now() + expiresIn * 1000;

    const encAccess = this.envelopeEncrypt(accessToken);
    const encRefresh = this.envelopeEncrypt(refreshToken);

    this.db.prepare(`
      INSERT OR REPLACE INTO google_tokens
        (user_id, provider, scope_hash, scopes_json, access_token_enc, refresh_token_enc,
         expires_at, created_at, family_id, generation, dek_wrapped, kek_version)
      VALUES (?, 'google', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      userId, scopeHash, JSON.stringify(scopes),
      encAccess.ciphertext, encRefresh.ciphertext,
      expiresAt, new Date().toISOString(),
      familyId, encRefresh.dekWrapped, encRefresh.kekVersion,
    );

    this.logger('info', `Token saved for user ${userId}`);
  }

  /** 토큰 로드 (복호화) */
  load(userId: string): DecryptedTokens | null {
    const row = this.db.prepare(`
      SELECT * FROM google_tokens
      WHERE user_id = ? AND provider = 'google'
      ORDER BY expires_at DESC LIMIT 1
    `).get(userId) as EncryptedTokenRow | undefined;

    if (!row) return null;

    const family = this.getFamily(row.familyId);
    if (family?.compromised) {
      this.logger('warn', `Token family ${row.familyId} is compromised, refusing to load`);
      return null;
    }

    const accessToken = this.envelopeDecrypt(row.accessTokenEnc, row.dekWrapped, row.kekVersion);
    const refreshToken = this.envelopeDecrypt(row.refreshTokenEnc, row.dekWrapped, row.kekVersion);

    return {
      accessToken,
      refreshToken,
      expiresAt: row.expiresAt,
      scopes: this.parseScopesJson(row),
      familyId: row.familyId,
      generation: row.generation,
    };
  }

  /** 토큰 삭제 (사용자 전체) */
  revoke(userId: string): void {
    this.db.prepare('DELETE FROM google_tokens WHERE user_id = ?').run(userId);
    this.db.prepare('DELETE FROM token_families WHERE user_id = ?').run(userId);
    this.logger('info', `Tokens revoked for user ${userId}`);
  }

  /** Refresh token rotation: 새 토큰 저장 + generation 증가 */
  rotateToken(
    userId: string,
    familyId: string,
    oldGeneration: number,
    newAccessToken: string,
    newRefreshToken: string,
    expiresIn: number,
    scopes: string[],
  ): void {
    // Reuse detection: 이전 generation 사용 시도
    const currentRow = this.db.prepare(`
      SELECT generation FROM google_tokens
      WHERE user_id = ? AND family_id = ?
      ORDER BY generation DESC LIMIT 1
    `).get(userId, familyId) as { generation: number } | undefined;

    if (currentRow && oldGeneration < currentRow.generation) {
      this.invalidateFamily(familyId);
      throw createGoogleError('FAMILY_COMPROMISED',
        `Refresh token reuse detected for family ${familyId}. All tokens invalidated.`);
    }

    const scopeHash = this.hashScopes(scopes);
    const expiresAt = Date.now() + expiresIn * 1000;
    const newGeneration = oldGeneration + 1;

    const encAccess = this.envelopeEncrypt(newAccessToken);
    const encRefresh = this.envelopeEncrypt(newRefreshToken);

    this.db.prepare(`
      INSERT OR REPLACE INTO google_tokens
        (user_id, provider, scope_hash, scopes_json, access_token_enc, refresh_token_enc,
         expires_at, created_at, family_id, generation, dek_wrapped, kek_version)
      VALUES (?, 'google', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, scopeHash, JSON.stringify(scopes),
      encAccess.ciphertext, encRefresh.ciphertext,
      expiresAt, new Date().toISOString(),
      familyId, newGeneration, encRefresh.dekWrapped, encRefresh.kekVersion,
    );

    this.updateFamilyLastUsed(familyId);
    this.logger('info', `Token rotated for user ${userId}, generation ${newGeneration}`);
  }

  /** Family 전체 폐기 (compromised) */
  invalidateFamily(familyId: string): void {
    this.db.prepare(`
      UPDATE token_families SET compromised = 1 WHERE family_id = ?
    `).run(familyId);
    this.db.prepare(`
      DELETE FROM google_tokens WHERE family_id = ?
    `).run(familyId);
    this.logger('warn', `Token family ${familyId} invalidated (reuse detected)`);
  }

  /** 80% lifetime 체크 (preemptive refresh 판정) */
  needsPreemptiveRefresh(tokens: DecryptedTokens): boolean {
    const now = Date.now();
    const lifetime = tokens.expiresAt - (tokens.expiresAt - 3600_000);
    const elapsed = now - (tokens.expiresAt - 3600_000);
    return elapsed >= lifetime * 0.8;
  }

  /** AsyncMutex 래핑 refresh: 동시 요청 시 1회만 갱신 */
  async withRefreshMutex(
    userId: string,
    refreshFn: () => Promise<DecryptedTokens>,
  ): Promise<DecryptedTokens> {
    const existing = this.refreshMutexes.get(userId);
    if (existing) return existing;

    const promise = refreshFn().finally(() => {
      this.refreshMutexes.delete(userId);
    });
    this.refreshMutexes.set(userId, promise);
    return promise;
  }

  /** 만료 여부 체크 */
  isExpired(tokens: DecryptedTokens, marginMs: number = 60_000): boolean {
    return tokens.expiresAt <= Date.now() + marginMs;
  }

  /** DB 닫기 (외부 주입 DB는 닫지 않음) */
  close(): void {
    if (this.ownsDb) {
      this.db.close();
    }
  }

  /** 내부 DB 참조 (ScopeManager 등 공유용) */
  getDatabase(): Database.Database {
    return this.db;
  }

  // ════════════════════════════════════════════════════════════
  // Token Family Management
  // ════════════════════════════════════════════════════════════

  private createFamily(userId: string): string {
    const familyId = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO token_families (family_id, user_id, created_at, compromised, last_used_at)
      VALUES (?, ?, ?, 0, ?)
    `).run(familyId, userId, new Date().toISOString(), new Date().toISOString());
    return familyId;
  }

  private getFamily(familyId: string): TokenFamily | null {
    const row = this.db.prepare(
      'SELECT * FROM token_families WHERE family_id = ?',
    ).get(familyId) as TokenFamilyRow | undefined;

    if (!row) return null;
    return {
      familyId: row.family_id,
      userId: row.user_id,
      createdAt: row.created_at,
      compromised: Boolean(row.compromised),
      lastUsedAt: row.last_used_at,
    };
  }

  private updateFamilyLastUsed(familyId: string): void {
    this.db.prepare(
      'UPDATE token_families SET last_used_at = ? WHERE family_id = ?',
    ).run(new Date().toISOString(), familyId);
  }

  // ════════════════════════════════════════════════════════════
  // Envelope Encryption
  // ════════════════════════════════════════════════════════════

  private envelopeEncrypt(plaintext: string): EnvelopeEncrypted {
    const dek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const ciphertext = Buffer.concat([iv, authTag, encrypted]).toString('base64');

    // KEK로 DEK 보호
    const dekIv = crypto.randomBytes(IV_LENGTH);
    const dekCipher = crypto.createCipheriv(ALGORITHM, this.kek, dekIv);
    const dekEncrypted = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const dekAuthTag = dekCipher.getAuthTag();
    const dekWrapped = Buffer.concat([dekIv, dekAuthTag, dekEncrypted]).toString('base64');

    return { ciphertext, dekWrapped, kekVersion: KEK_VERSION };
  }

  private envelopeDecrypt(
    ciphertext: string,
    dekWrapped: string,
    _kekVersion: number,
  ): string {
    // DEK 복호화
    const dekBuf = Buffer.from(dekWrapped, 'base64');
    const dekIv = dekBuf.subarray(0, IV_LENGTH);
    const dekAuthTag = dekBuf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const dekEncrypted = dekBuf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const dekDecipher = crypto.createDecipheriv(ALGORITHM, this.kek, dekIv);
    dekDecipher.setAuthTag(dekAuthTag);
    const dek = Buffer.concat([dekDecipher.update(dekEncrypted), dekDecipher.final()]);

    // 데이터 복호화
    const dataBuf = Buffer.from(ciphertext, 'base64');
    const iv = dataBuf.subarray(0, IV_LENGTH);
    const authTag = dataBuf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = dataBuf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  // ════════════════════════════════════════════════════════════
  // KEK Management
  // ════════════════════════════════════════════════════════════

  private loadOrCreateKEK(): Buffer {
    // 로컬: 파일시스템, SaaS: 환경변수
    const envKey = process.env.VIBE_GOOGLE_MASTER_KEY;
    if (envKey) {
      return Buffer.from(envKey, 'base64');
    }

    const kekPath = path.join(getGlobalConfigDir(), '.google-kek');
    if (fs.existsSync(kekPath)) {
      return Buffer.from(fs.readFileSync(kekPath, 'utf-8'), 'base64');
    }

    const newKey = crypto.randomBytes(32);
    const dir = path.dirname(kekPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(kekPath, newKey.toString('base64'), { encoding: 'utf-8', mode: 0o600 });
    return newKey;
  }

  // ════════════════════════════════════════════════════════════
  // Scope Hashing
  // ════════════════════════════════════════════════════════════

  private hashScopes(scopes: string[]): string {
    const sorted = [...scopes].sort().join(',');
    return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 16);
  }

  private parseScopesJson(row: EncryptedTokenRow & { scopes_json?: string }): string[] {
    if (row.scopes_json) {
      try {
        const parsed: unknown = JSON.parse(row.scopes_json);
        if (Array.isArray(parsed) && parsed.every((s): s is string => typeof s === 'string')) {
          return parsed;
        }
      } catch {
        this.logger('warn', `Failed to parse scopes_json for user ${row.userId}`);
      }
    }
    return [];
  }

  // ════════════════════════════════════════════════════════════
  // Schema
  // ════════════════════════════════════════════════════════════

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS google_tokens (
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'google',
        scope_hash TEXT NOT NULL,
        scopes_json TEXT NOT NULL DEFAULT '[]',
        access_token_enc TEXT NOT NULL,
        refresh_token_enc TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        family_id TEXT NOT NULL,
        generation INTEGER NOT NULL DEFAULT 1,
        dek_wrapped TEXT NOT NULL,
        kek_version INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (user_id, provider)
      );

      CREATE TABLE IF NOT EXISTS token_families (
        family_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        compromised INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS oauth_states (
        state_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        scopes TEXT NOT NULL,
        verifier_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        used INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS user_scopes (
        user_id TEXT NOT NULL,
        scope TEXT NOT NULL,
        granted_at TEXT NOT NULL,
        PRIMARY KEY (user_id, scope)
      );
    `);
  }
}

// Internal DB row type
interface TokenFamilyRow {
  family_id: string;
  user_id: string;
  created_at: string;
  compromised: number;
  last_used_at: string;
}
