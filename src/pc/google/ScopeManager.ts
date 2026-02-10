/**
 * ScopeManager — Incremental scope 관리
 *
 * Just-in-Time 요청: 필요한 scope만 점진적 추가.
 * 현재 승인된 scope 조회, 부족 scope 감지.
 */

import Database from 'better-sqlite3';
import type { GoogleLogger, ScopeAlias } from './types.js';
import { GOOGLE_SCOPE_MAP, createGoogleError } from './types.js';

export class ScopeManager {
  private db: Database.Database;
  private logger: GoogleLogger;

  constructor(db: Database.Database, logger: GoogleLogger) {
    this.db = db;
    this.logger = logger;
  }

  /** 사용자의 승인된 scope 목록 조회 */
  getGrantedScopes(userId: string): string[] {
    const rows = this.db.prepare(
      'SELECT scope FROM user_scopes WHERE user_id = ?',
    ).all(userId) as Array<{ scope: string }>;
    return rows.map(r => r.scope);
  }

  /** scope 승인 기록 */
  grantScopes(userId: string, scopes: string[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_scopes (user_id, scope, granted_at)
      VALUES (?, ?, ?)
    `);
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      for (const scope of scopes) {
        stmt.run(userId, scope, now);
      }
    });
    tx();
    this.logger('info', `Scopes granted for ${userId}: ${scopes.join(', ')}`);
  }

  /** scope 삭제 (revoke 시) */
  revokeScopes(userId: string): void {
    this.db.prepare('DELETE FROM user_scopes WHERE user_id = ?').run(userId);
  }

  /** 특정 기능에 필요한 scope가 승인되었는지 확인 */
  hasScope(userId: string, scopeAlias: ScopeAlias): boolean {
    const fullScope = GOOGLE_SCOPE_MAP[scopeAlias];
    if (!fullScope) return false;
    const row = this.db.prepare(
      'SELECT 1 FROM user_scopes WHERE user_id = ? AND scope = ?',
    ).get(userId, fullScope);
    return !!row;
  }

  /** 필요한 scope 중 미승인 목록 반환 */
  getMissingScopes(userId: string, required: ScopeAlias[]): string[] {
    const granted = new Set(this.getGrantedScopes(userId));
    const missing: string[] = [];
    for (const alias of required) {
      const fullScope = GOOGLE_SCOPE_MAP[alias];
      if (fullScope && !granted.has(fullScope)) {
        missing.push(fullScope);
      }
    }
    return missing;
  }

  /** scope alias → full URL 변환 */
  resolveScopes(aliases: ScopeAlias[]): string[] {
    return aliases.map(alias => {
      const full = GOOGLE_SCOPE_MAP[alias];
      if (!full) {
        throw createGoogleError('UNKNOWN_ERROR', `Unknown scope alias: ${alias}`);
      }
      return full;
    });
  }

  /** 부분 승인 감지: 요청한 scope 중 거절된 것 확인 */
  detectDeniedScopes(requested: string[], granted: string[]): string[] {
    const grantedSet = new Set(granted);
    return requested.filter(s => !grantedSet.has(s));
  }
}
