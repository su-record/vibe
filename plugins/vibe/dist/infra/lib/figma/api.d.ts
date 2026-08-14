/**
 * Figma REST API 클라이언트
 *
 * native fetch + exponential backoff retry
 */
export declare function loadToken(): string;
export declare function maskToken(token: string): string;
export declare function figmaFetch<T = unknown>(endpoint: string, token: string): Promise<T>;
//# sourceMappingURL=api.d.ts.map