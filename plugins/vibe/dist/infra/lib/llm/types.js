/**
 * LLM Provider Types - Shared types for GPT and Antigravity providers
 */
export const DEFAULT_RETRY_STRATEGY = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryablePatterns: [
        'rate limit',
        'too many requests',
        '429',
        'timeout',
        'ECONNRESET',
        'ETIMEDOUT',
    ],
};
//# sourceMappingURL=types.js.map