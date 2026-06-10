/**
 * VectorStore — SQLite 기반 벡터 저장소
 *
 * 메모리/세션 엔티티의 임베딩 벡터를 BLOB으로 저장.
 * 검색: 행 단위 iterate → 코사인 유사도 → 스트리밍 top-k 선택.
 * (메모리 수 천~만 건 수준이므로 인덱스 없는 선형 스캔으로 충분하나,
 *  전량 적재+전체 정렬은 피해 메모리 O(limit)·정렬 비용 제거)
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
   * 스트리밍 top-k 선택 — 전 행을 배열로 적재해 전체 정렬(O(V log V) + O(V) 메모리)
   * 하는 대신, iterate()로 한 행씩 스코어링하며 크기 limit의 정렬 배열만 유지한다.
   * limit은 통상 ≤20이므로 선형 삽입으로 충분 (O(V·limit), 메모리 O(limit)).
   */
  private static topKBySimilarity<T extends { similarity: number }>(
    rows: IterableIterator<unknown>,
    limit: number,
    score: (row: unknown) => T,
  ): T[] {
    const best: T[] = [];
    for (const row of rows) {
      const item = score(row);
      if (best.length >= limit && item.similarity <= best[best.length - 1].similarity) {
        continue;
      }
      let insertAt = best.length;
      while (insertAt > 0 && best[insertAt - 1].similarity < item.similarity) {
        insertAt--;
      }
      best.splice(insertAt, 0, item);
      if (best.length > limit) best.pop();
    }
    return best;
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
    ).iterate();

    const queryFloat = new Float32Array(queryVec);

    return VectorStore.topKBySimilarity(rows, limit, (raw) => {
      const row = raw as { key: string; embedding: Buffer };
      return {
        key: row.key,
        similarity: cosineSimilarity(queryFloat, deserializeVector(row.embedding)),
      };
    });
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
    ).iterate(entityType);

    const queryFloat = new Float32Array(queryVec);

    return VectorStore.topKBySimilarity(rows, limit, (raw) => {
      const row = raw as { entityId: number; embedding: Buffer };
      return {
        entityType,
        entityId: row.entityId,
        similarity: cosineSimilarity(queryFloat, deserializeVector(row.embedding)),
      };
    });
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
