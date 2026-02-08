import type {
  SearchDomain,
  SearchResult,
  SearchResultItem,
  CacheEntry,
} from './types.js';
import { CsvDataLoader } from './CsvDataLoader.js';
import { Bm25Engine } from './Bm25Engine.js';
import {
  DOMAIN_CONFIG,
  STACK_CONFIG,
  DOMAIN_KEYWORDS,
  HOT_CACHE_DOMAINS,
  MAX_QUERY_LENGTH,
  MAX_QUERY_TOKENS,
  DEFAULT_MAX_RESULTS,
  MAX_RESULTS_UPPER_BOUND,
  LRU_MAX_SIZE,
  LRU_TTL_MS,
} from './constants.js';

/**
 * Main search service combining CsvDataLoader and Bm25Engine
 * Features:
 * - 12 domain search + 13 stack search
 * - Auto domain detection from keywords
 * - LRU cache (max 100 entries, 5min TTL)
 * - Hot cache (products + ui-reasoning loaded eagerly)
 * - Lazy load (other domains on first access)
 */
export class SearchService {
  private loader: CsvDataLoader;
  private engines: Map<string, Bm25Engine>;
  private domainData: Map<string, Record<string, string>[]>;
  private cache: Map<string, CacheEntry<SearchResult>>;
  private initialized: boolean;

  constructor(loader?: CsvDataLoader) {
    this.loader = loader ?? new CsvDataLoader();
    this.engines = new Map();
    this.domainData = new Map();
    this.cache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize hot cache domains (products + ui-reasoning)
   */
  initialize(): void {
    if (this.initialized) return;

    for (const domain of HOT_CACHE_DOMAINS) {
      const config = DOMAIN_CONFIG[domain];
      if (config) {
        this.ensureDomainLoaded(domain, config);
      }
    }

    this.initialized = true;
  }

  /**
   * Search a specific domain
   */
  search(
    query: string,
    domain?: SearchDomain,
    maxResults: number = DEFAULT_MAX_RESULTS
  ): SearchResult {
    const sanitized = this.sanitizeQuery(query);
    const targetDomain = domain ?? this.detectDomain(sanitized);
    const clampedMax = Math.max(1, Math.min(maxResults, MAX_RESULTS_UPPER_BOUND));

    const cacheKey = this.buildCacheKey('domain', sanitized, targetDomain, clampedMax);
    const cached = this.cacheGet(cacheKey);
    if (cached) return cached;

    const config = DOMAIN_CONFIG[targetDomain];
    if (!config) {
      return { domain: targetDomain, query: sanitized, file: '', count: 0, results: [] };
    }

    const loaded = this.ensureDomainLoaded(targetDomain, config);
    if (!loaded) {
      return { domain: targetDomain, query: sanitized, file: config.file, count: 0, results: [] };
    }

    const engine = this.engines.get(targetDomain)!;
    const data = this.domainData.get(targetDomain)!;
    const scores = engine.score(sanitized);

    const items: SearchResultItem<Record<string, string>>[] = scores
      .slice(0, clampedMax)
      .map((s) => ({
        item: data[s.index],
        score: s.score,
        index: s.index,
      }));

    const result: SearchResult = {
      domain: targetDomain,
      query: sanitized,
      file: config.file,
      count: items.length,
      results: items,
    };

    this.cacheSet(cacheKey, result);
    return result;
  }

  /**
   * Search a specific stack
   */
  searchStack(
    query: string,
    stack: string,
    maxResults: number = DEFAULT_MAX_RESULTS
  ): SearchResult {
    const sanitized = this.sanitizeQuery(query);
    const clampedMax = Math.max(1, Math.min(maxResults, MAX_RESULTS_UPPER_BOUND));

    const cacheKey = this.buildCacheKey('stack', sanitized, stack, clampedMax);
    const cached = this.cacheGet(cacheKey);
    if (cached) return cached;

    const config = STACK_CONFIG[stack];
    if (!config) {
      return { domain: stack, query: sanitized, file: '', count: 0, results: [] };
    }

    const domainKey = `stack:${stack}`;
    const loaded = this.ensureDomainLoaded(domainKey, config);
    if (!loaded) {
      return { domain: stack, query: sanitized, file: config.file, count: 0, results: [] };
    }

    const engine = this.engines.get(domainKey)!;
    const data = this.domainData.get(domainKey)!;
    const scores = engine.score(sanitized);

    const items: SearchResultItem<Record<string, string>>[] = scores
      .slice(0, clampedMax)
      .map((s) => ({
        item: data[s.index],
        score: s.score,
        index: s.index,
      }));

    const result: SearchResult = {
      domain: stack,
      query: sanitized,
      file: config.file,
      count: items.length,
      results: items,
    };

    this.cacheSet(cacheKey, result);
    return result;
  }

  /**
   * Auto-detect domain from query keywords
   */
  detectDomain(query: string): SearchDomain {
    const tokens = query.toLowerCase().split(/\s+/);
    const domainScores = new Map<SearchDomain, number>();

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      let matchCount = 0;
      for (const token of tokens) {
        if (keywords.some((kw) => token.includes(kw) || kw.includes(token))) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        domainScores.set(domain as SearchDomain, matchCount);
      }
    }

    if (domainScores.size === 0) {
      return 'product';
    }

    let maxDomain: SearchDomain = 'product';
    let maxScore = 0;
    for (const [domain, score] of domainScores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        maxDomain = domain;
      }
    }

    return maxDomain;
  }

  /**
   * Sanitize query (truncate to 200 chars, limit to 20 tokens)
   */
  private sanitizeQuery(query: string): string {
    let sanitized = query.trim();
    if (sanitized.length > MAX_QUERY_LENGTH) {
      sanitized = sanitized.substring(0, MAX_QUERY_LENGTH);
    }

    const tokens = sanitized.split(/\s+/);
    if (tokens.length > MAX_QUERY_TOKENS) {
      sanitized = tokens.slice(0, MAX_QUERY_TOKENS).join(' ');
    }

    return sanitized;
  }

  /**
   * Ensure a domain's data and engine are loaded
   */
  private ensureDomainLoaded(
    domain: string,
    config: { file: string; searchColumns: string[] }
  ): boolean {
    if (this.engines.has(domain) && this.domainData.has(domain)) {
      return true;
    }

    const data = this.loader.load(config.file);
    if (!data || data.length === 0) {
      return false;
    }

    const documents = data.map((row) => this.buildSearchText(row, config.searchColumns));
    const engine = new Bm25Engine();
    engine.fit(documents);

    this.domainData.set(domain, data);
    this.engines.set(domain, engine);

    return true;
  }

  /**
   * Build searchable text from row's search columns
   */
  private buildSearchText(row: Record<string, string>, columns: string[]): string {
    return columns
      .map((col) => row[col] ?? '')
      .filter((val) => val.length > 0)
      .join(' ');
  }

  /**
   * LRU cache get with TTL
   */
  private cacheGet(key: string): SearchResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > LRU_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * LRU cache set with eviction
   */
  private cacheSet(key: string, value: SearchResult): void {
    if (this.cache.size >= LRU_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Build cache key
   */
  private buildCacheKey(
    type: string,
    query: string,
    domainOrStack: string,
    maxResults: number
  ): string {
    return `${type}:${query}:${domainOrStack}:${maxResults}`;
  }

  /**
   * Clear expired cache entries
   */
  clearCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > LRU_TTL_MS) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.cache.delete(key);
    }
  }
}
