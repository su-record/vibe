/**
 * Retry utilities for LLM operations
 */
import type { RetryStrategy } from '../types.js';
/**
 * Check if an error should trigger a retry
 */
export declare function shouldRetry(error: Error | string, strategy?: RetryStrategy): boolean;
/**
 * Calculate delay for exponential backoff
 */
export declare function calculateBackoffDelay(retryCount: number, strategy?: RetryStrategy): number;
/**
 * Sleep for a specified duration
 */
export declare function delay(ms: number): Promise<void>;
/**
 * Execute with retry logic
 */
export declare function executeWithRetry<T>(fn: () => Promise<T>, strategy?: RetryStrategy, onRetry?: (error: Error, attempt: number) => void): Promise<T>;
/**
 * Check if an error indicates we should skip retrying entirely
 */
export declare function shouldSkipRetry(errorMsg: string): boolean;
//# sourceMappingURL=retry.d.ts.map