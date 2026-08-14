import type { IMemoryStorage } from './IMemoryStorage.js';
import Database from 'better-sqlite3';
import { VectorStore } from '../embedding/VectorStore.js';
import { EmbeddingProvider } from '../embedding/EmbeddingProvider.js';
import type { EmbeddingProviderType } from '../embedding/types.js';
export interface MemoryItem {
    key: string;
    value: string;
    category: string;
    timestamp: string;
    lastAccessed: string;
    priority?: number;
}
export declare class MemoryStorage implements IMemoryStorage {
    protected db: Database.Database;
    protected readonly dbPath: string;
    private recallStmt;
    private saveStmt;
    private recallSelectStmt;
    private recallUpdateStmt;
    private fts5Available;
    private vectorStore;
    private embeddingProvider;
    /**
     * 프로젝트 메모리 디렉토리 해석 — `utils.js:projectMemoryDir` 와 동일한 규칙.
     * `.vibe/memories/` (SSOT) 우선, legacy `.claude/memories/` fallback.
     */
    private static resolveMemoryDir;
    constructor(projectPath: string, embeddingPriority?: EmbeddingProviderType[]);
    private static readonly DAY_MS;
    private static readonly PRUNE_INTERVAL_MS;
    private static readonly SESSION_RETENTION_DAYS;
    /**
     * 테이블별 보존 기간. session_* / conversation_history 는 SessionRAGStore가
     * 같은 DB에 생성하므로 존재할 때만 prune (sqlite_master 확인).
     * - 세션 산출물 30일: 세션 회고/관찰의 참조 빈도는 수 주 내 0에 수렴
     * - session_summaries 90일: 장기 회고용으로 가장 오래 보존
     * - conversation_history 2일: 기존 cleanupOldConversationHistory(48h)와 동일 정책
     */
    private static readonly PRUNE_TARGETS;
    private pruneOldRows;
    private initializeDatabase;
    private initializeFTS5;
    private initializePreparedStatements;
    private migrateFromJSON;
    private initializeEmbedding;
    /**
     * VectorStore 인스턴스 (벡터 검색 불가 시 null)
     */
    getVectorStore(): VectorStore | null;
    /**
     * EmbeddingProvider 인스턴스 (API 키 없으면 null)
     */
    getEmbeddingProvider(): EmbeddingProvider | null;
    /**
     * 벡터 검색 사용 가능 여부
     */
    isVectorAvailable(): boolean;
    /**
     * 비동기 임베딩 생성 + 벡터 저장 (실패 무시)
     */
    private embedAndStoreAsync;
    /**
     * Save or update a memory item
     */
    save(key: string, value: string, category?: string, priority?: number): void;
    /**
     * Recall a memory item by key
     */
    recall(key: string): MemoryItem | null;
    /**
     * Delete a memory item
     */
    delete(key: string): boolean;
    /**
     * Update a memory item's value
     */
    update(key: string, value: string): boolean;
    /**
     * List all memories or filter by category
     */
    list(category?: string): MemoryItem[];
    /**
     * Search memories by keyword (FTS5 priority, LIKE fallback)
     */
    search(query: string): MemoryItem[];
    /**
     * Sanitize FTS5 query to prevent query syntax injection.
     * Removes special FTS5 operators and syntax characters.
     */
    static sanitizeFTS5Query(query: string): string;
    /**
     * Full-text search using FTS5 with bm25 ranking
     */
    searchFTS(query: string, limit?: number): MemoryItem[];
    /**
     * Check if FTS5 is available
     */
    isFTS5Available(): boolean;
    private searchLike;
    /**
     * Get memories by priority level
     */
    getByPriority(priority: number): MemoryItem[];
    /**
     * Update priority of a memory item
     */
    setPriority(key: string, priority: number): boolean;
    /**
     * Get memory statistics
     */
    getStats(): {
        total: number;
        byCategory: Record<string, number>;
    };
    /**
     * Get memories sorted by time
     */
    getTimeline(startDate?: string, endDate?: string, limit?: number): MemoryItem[];
    /**
     * Get database instance (for KnowledgeGraph)
     */
    getDatabase(): Database.Database;
    /**
     * Get database path
     */
    getDbPath(): string;
    /**
     * Close database connection
     */
    close(): void;
}
//# sourceMappingURL=MemoryStorage.d.ts.map