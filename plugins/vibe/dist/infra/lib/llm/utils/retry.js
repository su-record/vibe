/**
 * Retry utilities for LLM operations
 */
import { DEFAULT_RETRY_STRATEGY } from '../types.js';
/**
 * Check if an error should trigger a retry
 */
export function shouldRetry(error, strategy = DEFAULT_RETRY_STRATEGY) {
    const errorMsg = typeof error === 'string' ? error : error.message;
    const lowerMsg = errorMsg.toLowerCase();
    return strategy.retryablePatterns.some(pattern => lowerMsg.includes(pattern.toLowerCase()));
}
/**
 * Calculate delay for exponential backoff
 */
export function calculateBackoffDelay(retryCount, strategy = DEFAULT_RETRY_STRATEGY) {
    const delay = Math.min(strategy.baseDelayMs * Math.pow(2, retryCount), strategy.maxDelayMs);
    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
}
/**
 * Sleep for a specified duration
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Execute with retry logic
 */
export async function executeWithRetry(fn, strategy = DEFAULT_RETRY_STRATEGY, onRetry) {
    let lastError = null;
    for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < strategy.maxRetries && shouldRetry(lastError, strategy)) {
                const backoffDelay = calculateBackoffDelay(attempt, strategy);
                onRetry?.(lastError, attempt + 1);
                await delay(backoffDelay);
            }
            else {
                break;
            }
        }
    }
    throw lastError;
}
/**
 * Patterns that indicate we should NOT retry
 */
const NON_RETRYABLE_PATTERNS = [
    'invalid api key',
    'authentication failed',
    'unauthorized',
    'forbidden',
    'quota exceeded',
    'billing',
    'invalid request',
    'bad request',
    'not found',
];
/**
 * Check if an error indicates we should skip retrying entirely
 */
export function shouldSkipRetry(errorMsg) {
    const lowerMsg = errorMsg.toLowerCase();
    return NON_RETRYABLE_PATTERNS.some(pattern => lowerMsg.includes(pattern));
}
//# sourceMappingURL=retry.js.map