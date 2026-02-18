/**
 * VectorStore — SQLite 기반 벡터 저장소
 *
 * 메모리/세션 엔티티의 임베딩 벡터를 BLOB으로 저장.
 * 검색: 전체 로드 → 앱 레벨 코사인 유사도 → 정렬.
 * (메모리 수 천~만 건 수준이므로 앱 레벨 충분)
 */

import Database from 'better-sqlite3';
import {
  cosineSimilarity,
  serializeVector,
  deserializeVector,
} from './cosine.js';
import type { VectorSearchResult, SessionVectorSearchResult } from './types.js';

export class VectorStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_vectors (
        key TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        dimension INTEGER NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session_vectors (
        entityType TEXT NOT NULL,
        entityId INTEGER NOT NULL,
        embedding BLOB NOT NULL,
        dimension INTEGER NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (entityType, entityId)
      );
    `);
  }

  /**
   * 메모리 벡터 저장 (upsert)
   */
  public saveMemoryVector(key: string, embedding: number[]): void {
    const blob = serializeVector(embedding);
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT OR REPLACE INTO memory_vectors (key, embedding, dimension, updatedAt)
      VALUES (?, ?, ?, ?)
    `).run(key, blob, embedding.length, now);
  }

  /**
   * 세션 엔티티 벡터 저장 (upsert)
   */
  public saveSessionVector(
    entityType: string,
    entityId: number,
    embedding: number[],
  ): void {
    const blob = serializeVector(embedding);
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT OR REPLACE INTO session_vectors (entityType, entityId, embedding, dimension, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(entityType, entityId, blob, embedding.length, now);
  }

  /**
   * 메모리 벡터 삭제
   */
  public deleteMemoryVector(key: string): void {
    this.db.prepare('DELETE FROM memory_vectors WHERE key = ?').run(key);
  }

  /**
   * 세션 엔티티 벡터 삭제
   */
  public deleteSessionVector(entityType: string, entityId: number): void {
    this.db.prepare(
      'DELETE FROM session_vectors WHERE entityType = ? AND entityId = ?',
    ).run(entityType, entityId);
  }

  /**
   * 메모리 벡터 코사인 유사도 검색
   */
  public searchMemoryVectors(
    queryVec: number[],
    limit: number = 20,
  ): VectorSearchResult[] {
    const rows = this.db.prepare(
      'SELECT key, embedding FROM memory_vectors',
    ).all() as Array<{ key: string; embedding: Buffer }>;

    const queryFloat = new Float32Array(queryVec);

    return rows
      .map(row => ({
        key: row.key,
        similarity: cosineSimilarity(queryFloat, deserializeVector(row.embedding)),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * 세션 엔티티 벡터 코사인 유사도 검색
   */
  public searchSessionVectors(
    entityType: string,
    queryVec: number[],
    limit: number = 20,
  ): SessionVectorSearchResult[] {
    const rows = this.db.prepare(
      'SELECT entityId, embedding FROM session_vectors WHERE entityType = ?',
    ).all(entityType) as Array<{ entityId: number; embedding: Buffer }>;

    const queryFloat = new Float32Array(queryVec);

    return rows
      .map(row => ({
        entityType,
        entityId: row.entityId,
        similarity: cosineSimilarity(queryFloat, deserializeVector(row.embedding)),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * 저장된 메모리 벡터 수
   */
  public getMemoryVectorCount(): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM memory_vectors',
    ).get() as { cnt: number };
    return row.cnt;
  }

  /**
   * 저장된 세션 벡터 수
   */
  public getSessionVectorCount(entityType?: string): number {
    if (entityType) {
      const row = this.db.prepare(
        'SELECT COUNT(*) as cnt FROM session_vectors WHERE entityType = ?',
      ).get(entityType) as { cnt: number };
      return row.cnt;
    }
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM session_vectors',
    ).get() as { cnt: number };
    return row.cnt;
  }
}
