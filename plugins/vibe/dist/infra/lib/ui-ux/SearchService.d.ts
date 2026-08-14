import type { SearchDomain, SearchResult } from './types.js';
import { CsvDataLoader } from './CsvDataLoader.js';
/**
 * Main search service combining CsvDataLoader and Bm25Engine
 * Features:
 * - 12 domain search + 13 stack search
 * - Auto domain detection from keywords
 * - LRU cache (max 100 entries, 5min TTL)
 * - Hot cache (products + ui-reasoning loaded eagerly)
 * - Lazy load (other domains on first access)
 */
export declare class SearchService {
    private loader;
    private engines;
    private domainData;
    private cache;
    private initialized;
    constructor(loader?: CsvDataLoader);
    /**
     * Initialize hot cache domains (products + ui-reasoning)
     */
    initialize(): void;
    /**
     * Search a specific domain
     */
    search(query: string, domain?: SearchDomain, maxResults?: number): SearchResult;
    /**
     * Search a specific stack
     */
    searchStack(query: string, stack: string, maxResults?: number): SearchResult;
    /**
     * Auto-detect domain from query keywords
     */
    detectDomain(query: string): SearchDomain;
    /**
     * Sanitize query (truncate to 200 chars, limit to 20 tokens)
     */
    private sanitizeQuery;
    /**
     * Ensure a domain's data and engine are loaded
     */
    private ensureDomainLoaded;
    /**
     * Build searchable text from row's search columns
     */
    private buildSearchText;
    /**
     * LRU cache get with TTL
     */
    private cacheGet;
    /**
     * LRU cache set with eviction
     */
    private cacheSet;
    /**
     * Build cache key
     */
    private buildCacheKey;
    /**
     * Clear expired cache entries
     */
    clearCache(): void;
}
//# sourceMappingURL=SearchService.d.ts.map