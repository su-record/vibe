/**
 * UI/UX Design Intelligence — Constants
 *
 * Stopwords, domain keyword map, domain-to-CSV file mapping, chart compatibility matrix
 */
import type { SearchDomain, DomainConfig, StackConfig } from './types.js';
export declare const STOPWORDS_EN: ReadonlySet<string>;
export declare const STOPWORDS_KO: ReadonlySet<string>;
export declare const STOPWORDS: ReadonlySet<string>;
export declare const BM25_K1 = 1.5;
export declare const BM25_B = 0.75;
export declare const MAX_QUERY_LENGTH = 200;
export declare const MAX_QUERY_TOKENS = 20;
export declare const MIN_TOKEN_LENGTH = 2;
export declare const LRU_MAX_SIZE = 100;
export declare const LRU_TTL_MS: number;
export declare const DEFAULT_MAX_RESULTS = 10;
export declare const MAX_RESULTS_UPPER_BOUND = 50;
export declare const DOMAIN_CONFIG: Record<SearchDomain, DomainConfig>;
export declare const STACK_CONFIG: Record<string, StackConfig>;
export declare const DOMAIN_KEYWORDS: Record<SearchDomain, readonly string[]>;
export declare const HOT_CACHE_DOMAINS: readonly SearchDomain[];
export declare const CHART_LIBRARY_COMPATIBILITY: Record<string, readonly string[]>;
export declare const UI_UX_TRIGGER_KEYWORDS: readonly string[];
export declare const DATAVIZ_TRIGGER_KEYWORDS: readonly string[];
export declare const HEX_COLOR_REGEX: RegExp;
export declare const DEFAULT_COLOR_PRIMARY = "#3B82F6";
export declare const DEFAULT_COLOR_SECONDARY = "#6366F1";
export declare const DEFAULT_COLOR_CTA = "#F97316";
export declare const DEFAULT_COLOR_BACKGROUND = "#FFFFFF";
export declare const DEFAULT_COLOR_TEXT = "#1E293B";
export declare const DEFAULT_COLOR_BORDER = "#E2E8F0";
export declare const PROJECT_NAME_REGEX: RegExp;
export declare const PAGE_NAME_REGEX: RegExp;
export declare const WINDOWS_RESERVED_NAMES: ReadonlySet<string>;
export declare const PRIORITY_SCORE_EXACT = 10;
export declare const PRIORITY_SCORE_KEYWORD = 3;
export declare const PRIORITY_SCORE_OTHER = 1;
//# sourceMappingURL=constants.d.ts.map