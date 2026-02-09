/**
 * Rate limiter for agent tool calls using sliding window algorithm
 */

export interface RateLimitConfig {
  [toolName: string]: { rpm: number };
}

interface WindowEntry {
  timestamp: number;
}

/**
 * Sliding window rate limiter for agent tool calls
 */
export class RateLimiter {
  private windows: Map<string, WindowEntry[]> = new Map();
  private config: RateLimitConfig;

  constructor(config?: RateLimitConfig) {
    this.config = config ?? {
      claude_code: { rpm: 10 },
      web_browse: { rpm: 20 },
    };
  }

  /**
   * Get rate limit for a tool (default: 30 RPM)
   */
  private getLimit(toolName: string): number {
    return this.config[toolName]?.rpm ?? 30;
  }

  /**
   * Get window key for chatId and toolName
   */
  private getKey(chatId: string, toolName: string): string {
    return `${chatId}:${toolName}`;
  }

  /**
   * Clean up entries older than 60 seconds
   */
  private cleanupOldEntries(entries: WindowEntry[], now: number): WindowEntry[] {
    const cutoff = now - 60_000;
    return entries.filter((entry) => entry.timestamp > cutoff);
  }

  /**
   * Check if a tool call is allowed under rate limits
   */
  check(chatId: string, toolName: string): { allowed: boolean; message?: string } {
    const key = this.getKey(chatId, toolName);
    const limit = this.getLimit(toolName);
    const now = Date.now();

    const entries = this.windows.get(key) ?? [];
    const cleanedEntries = this.cleanupOldEntries(entries, now);
    this.windows.set(key, cleanedEntries);

    if (cleanedEntries.length >= limit) {
      return {
        allowed: false,
        message: `Rate limit exceeded: ${toolName} (${limit}/min)`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a tool call
   */
  record(chatId: string, toolName: string): void {
    const key = this.getKey(chatId, toolName);
    const now = Date.now();

    const entries = this.windows.get(key) ?? [];
    const cleanedEntries = this.cleanupOldEntries(entries, now);
    cleanedEntries.push({ timestamp: now });
    this.windows.set(key, cleanedEntries);
  }

  /**
   * Reset all rate limit windows
   */
  reset(): void {
    this.windows.clear();
  }
}
