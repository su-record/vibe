/**
 * TokenRefresher - Centralized token refresh with file locking
 *
 * Prevents race conditions when multiple parallel agents attempt
 * to refresh the same token simultaneously.
 *
 * Uses:
 * - In-process dedupe: provider-scoped Promise map (single process)
 * - File lock: mkdir atomic pattern (cross-process)
 */
interface RefreshResult {
    accessToken: string;
    refreshToken?: string;
    expires: number;
}
type ReadCurrentTokenFn = () => {
    accessToken: string;
    expires: number;
} | null;
declare class TokenRefresher {
    /**
     * Refresh a token with in-process deduplication and cross-process file locking.
     *
     * @param provider - Provider identifier (e.g., 'gpt', 'antigravity')
     * @param refreshFn - The actual token refresh function
     * @param readCurrentToken - Optional callback to read current token from storage
     */
    refreshWithLock(provider: string, refreshFn: () => Promise<RefreshResult>, readCurrentToken?: ReadCurrentTokenFn): Promise<RefreshResult>;
    private doRefreshWithLock;
}
/** Singleton instance */
export declare const tokenRefresher: TokenRefresher;
export { TokenRefresher };
export type { RefreshResult, ReadCurrentTokenFn };
//# sourceMappingURL=TokenRefresher.d.ts.map